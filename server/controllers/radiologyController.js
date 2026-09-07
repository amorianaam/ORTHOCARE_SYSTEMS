const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const deleteUnlinkedFiles = (oldJsonStr, newFilesArray) => {
  if (!oldJsonStr || typeof oldJsonStr !== 'string' || !oldJsonStr.startsWith('[')) return;
  try {
    const oldFiles = JSON.parse(oldJsonStr);
    const newUrls = (Array.isArray(newFilesArray) ? newFilesArray : []).map(f => f.url).filter(Boolean);
    oldFiles.forEach(oldFile => {
      if (oldFile.url && !newUrls.includes(oldFile.url)) {
        // __dirname is server/controllers, so .. goes to server/
        // oldFile.url is /uploads/radiology/...
        // we remove the leading slash if it exists so path.join works predictably on windows
        const relUrl = oldFile.url.startsWith('/') ? oldFile.url.substring(1) : oldFile.url;
        const filePath = path.join(__dirname, '..', relUrl);
        if (fs.existsSync(filePath)) {
           fs.unlinkSync(filePath);
        }
      }
    });
  } catch (e) {
    console.error('GC Error:', e);
  }
};

// 1. Get requests based on tab (pending, in_progress, completed)
exports.getRequests = async (req, res) => {
  const { tab = 'pending', startDate, endDate } = req.query;
  try {
    let statusFilter = "('paid')";
    if (tab === 'in_progress') statusFilter = "('in_progress')";
    if (tab === 'completed') statusFilter = "('completed')";
    if (tab === 'pending') statusFilter = "('paid')";

    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = `AND (SELECT MIN(requested_at) FROM visit_radiology_requests WHERE visit_id = v.id) BETWEEN ? AND ?`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const query = `
      SELECT DISTINCT 
        v.id as visit_id, 
        v.visit_number, 
        p.full_name, 
        p.age, 
        p.gender,
        (SELECT MIN(requested_at) FROM visit_radiology_requests WHERE visit_id = v.id AND status IN ${statusFilter}) as requested_at,
        (SELECT COUNT(*) FROM visit_radiology_requests WHERE visit_id = v.id AND status IN ${statusFilter}) as total_tests,
        (SELECT COUNT(*) FROM visit_radiology_requests WHERE visit_id = v.id AND status IN ${statusFilter} AND with_film = 1) as tests_with_film
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN visit_radiology_requests vrr ON v.id = vrr.visit_id
      WHERE vrr.status IN ${statusFilter} ${dateFilter}
      ORDER BY requested_at ${tab === 'completed' ? 'DESC' : 'ASC'}
    `;
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('getRequests error:', error);
    res.status(500).json({ message: 'فشل تحميل الطلبات' });
  }
};

// 2. Get details for a specific visit, including film groups
exports.getVisitDetails = async (req, res) => {
  const { visitId } = req.params;
  try {
    const visitQuery = `
      SELECT v.id as visit_id, v.visit_number, p.full_name, p.age, p.gender, p.allergies, p.chronic_diseases
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = ?
    `;
    const [visitRows] = await db.query(visitQuery, [visitId]);
    if (visitRows.length === 0) return res.status(404).json({ message: 'الزيارة غير موجودة' });

    const requestsQuery = `
      SELECT vrr.id, vrr.status, vrr.with_film, vrr.result_file, vrr.result_notes, vrr.radiology_film_id, rt.name, rc.name as category_name
      FROM visit_radiology_requests vrr
      JOIN radiology_tests rt ON vrr.radiology_test_id = rt.id
      LEFT JOIN radiology_categories rc ON rt.category_id = rc.id
      WHERE vrr.visit_id = ? AND vrr.status IN ('paid', 'in_progress', 'completed')
      ORDER BY vrr.id ASC
    `;
    const [requests] = await db.query(requestsQuery, [visitId]);

    const filmsQuery = `SELECT id, film_size, created_at FROM visit_radiology_films WHERE visit_id = ?`;
    const [films] = await db.query(filmsQuery, [visitId]);

    res.json({
      visit: visitRows[0],
      requests,
      films
    });
  } catch (error) {
    console.error('getVisitDetails error:', error);
    res.status(500).json({ message: 'فشل تحميل تفاصيل الزيارة' });
  }
};

// 3. Update status (e.g. start all)
exports.updateRequestStatus = async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  try {
    // Phase 3: Backend Security Guard
    // If trying to mark a scan as 'completed', enforce the film business rule:
    // A scan that requires a film (with_film = 1) CANNOT be completed unless it is linked to one.
    let visitId, patientName, msgText;
    if (status === 'completed') {
      const [[scanRow]] = await db.query(
        `SELECT vrr.with_film, vrr.radiology_film_id, vrr.visit_id, p.full_name as patientName 
         FROM visit_radiology_requests vrr
         JOIN visits v ON vrr.visit_id = v.id
         JOIN patients p ON v.patient_id = p.id
         WHERE vrr.id = ?`,
        [requestId]
      );
      if (scanRow && scanRow.with_film === 1 && !scanRow.radiology_film_id) {
        return res.status(400).json({
          message: 'لا يمكن تسليم هذه الدراسة بشكل منفرد — يجب إدراجها في فيلم أولاً'
        });
      }
      if (scanRow) {
        visitId = scanRow.visit_id;
        patientName = scanRow.patientName;
        msgText = (scanRow.with_film === 1 && scanRow.radiology_film_id) 
            ? 'تم تجهيز فحص الأشعة للمريض' 
            : 'تم تجهيز الفحص الإشعاعي للمريض';
      }
    }

    await db.query("UPDATE visit_radiology_requests SET status = ?, performed_by = ? WHERE id = ?", [status, req.user.id, requestId]);
    
    if (status === 'completed' && visitId) {
      const io = req.app.get('io');
      if (io) {
        io.to('doctor').emit('radiology:completed', { message: msgText, patientName, visitId });
        io.emit('radiology:updated', { visitId });
      }
    }

    res.json({ message: 'تم تحديث الحالة بنجاح' });
  } catch (error) {
    console.error('updateRequestStatus error:', error);
    res.status(500).json({ message: 'فشل تحديث الحالة' });
  }
};

// Start all pending requests for a visit
exports.startAllRequests = async (req, res) => {
  const { visitId } = req.params;
  try {
    await db.query("UPDATE visit_radiology_requests SET status = 'in_progress', performed_by = ? WHERE visit_id = ? AND status = 'paid'", [req.user.id, visitId]);
    
    const io = req.app.get('io');
    if (io) io.emit('radiology:updated', { visitId });

    res.json({ message: 'تم بدء التنفيذ لجميع طلبات الأشعة' });
  } catch (error) {
    console.error('startAllRequests error:', error);
    res.status(500).json({ message: 'فشل بدء التنفيذ' });
  }
};

// Film Grouping Management
exports.createFilmGroup = async (req, res) => {
  const { visitId } = req.params;
  const { filmSize, requestIds } = req.body; // array of vrr.id
  try {
    if (!requestIds || requestIds.length === 0) return res.status(400).json({ message: 'يجب تحديد فحص واحد على الأقل' });
    
    if (filmSize === 'large' && requestIds.length > 6) {
      return res.status(400).json({ message: 'الفيلم الكبير لا يمكنه احتواء أكثر من 6 فحوصات' });
    }
    if (filmSize === 'small' && requestIds.length > 2) {
      return res.status(400).json({ message: 'الفيلم الصغير لا يمكنه احتواء أكثر من فحصين' });
    }
    
    // Insert film
    const [insertRes] = await db.query("INSERT INTO visit_radiology_films (visit_id, film_size) VALUES (?, ?)", [visitId, filmSize]);
    const filmId = insertRes.insertId;

    // Link requests to this film
    const idsString = requestIds.join(',');
    await db.query(`UPDATE visit_radiology_requests SET radiology_film_id = ? WHERE id IN (${idsString}) AND visit_id = ?`, [filmId, visitId]);

    res.json({ message: 'تم تجميع الأشعة في الفيلم بنجاح', filmId });
  } catch (error) {
    console.error('createFilmGroup error:', error);
    res.status(500).json({ message: 'فشل إنشاء الفيلم' });
  }
};

exports.deleteFilmGroup = async (req, res) => {
  const { filmId } = req.params;
  try {
    // Phase 3: Revert completed status back to in_progress before deletion
    await db.query(`
      UPDATE visit_radiology_requests 
      SET status = 'in_progress' 
      WHERE radiology_film_id = ? AND status = 'completed'
    `, [filmId]);

    // ON DELETE SET NULL constraint will automatically unlink the requests
    await db.query("DELETE FROM visit_radiology_films WHERE id = ?", [filmId]);
    res.json({ message: 'تم حذف الفيلم وفك ارتباط الفحوصات وإعادتها لحالة قيد الإجراء' });
  } catch (error) {
    console.error('deleteFilmGroup error:', error);
    res.status(500).json({ message: 'فشل حذف الفيلم' });
  }
};

// 4. Upload result (FormData multipart: files via Multer + resultNotes)
exports.uploadResult = async (req, res) => {
  const { requestId } = req.params;
  const { resultNotes, existingFiles } = req.body;
  
  let filesArray = [];
  if (existingFiles) {
    try { filesArray = JSON.parse(existingFiles); } catch(e) {}
  }
  
  if (req.files && req.files.length > 0) {
    const newFiles = req.files.map(file => ({
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      type: file.mimetype,
      url: '/uploads/radiology/' + file.filename,
      size: file.size
    }));
    filesArray = [...filesArray, ...newFiles];
  }
  
  // Fallback for legacy uploads (Base64 JSON sent directly in resultFile)
  if (req.body.resultFile && filesArray.length === 0) {
    try { filesArray = JSON.parse(req.body.resultFile); } catch(e) { filesArray = req.body.resultFile; }
  }

  const filePayload = (Array.isArray(filesArray) && filesArray.length > 0) ? JSON.stringify(filesArray) : (typeof filesArray === 'string' && filesArray ? filesArray : null);

  try {
    const [[oldRequest]] = await db.query('SELECT result_file FROM visit_radiology_requests WHERE id = ?', [requestId]);

    await db.query(`
      UPDATE visit_radiology_requests 
      SET result_file = ?, result_notes = ?, performed_by = ?, performed_at = NOW() 
      WHERE id = ?`, 
      [filePayload, resultNotes || null, req.user.id, requestId]
    );
    
    if (oldRequest) {
      deleteUnlinkedFiles(oldRequest.result_file, filesArray || []);
    }
    
    // Notify on result update
    const [[scanRow]] = await db.query(
      `SELECT vrr.status, vrr.visit_id, p.full_name as patientName 
       FROM visit_radiology_requests vrr
       JOIN visits v ON vrr.visit_id = v.id
       JOIN patients p ON v.patient_id = p.id
       WHERE vrr.id = ?`,
      [requestId]
    );

    const io = req.app.get('io');
    if (io && scanRow) {
       io.emit('radiology:updated', { visitId: scanRow.visit_id });
       if (scanRow.status === 'completed') {
          io.to('doctor').emit('radiology:completed', { message: 'تم تحديث الفحص الإشعاعي للمريض', patientName: scanRow.patientName, visitId: scanRow.visit_id });
       }
    }

    res.json({ message: 'تم حفظ النتيجة بنجاح' });
  } catch (error) {
    console.error('uploadResult error:', error);
    res.status(500).json({ message: 'فشل حفظ النتيجة' });
  }
};

// 4b. Upload shared result for a film (FormData multipart)
exports.uploadFilmResult = async (req, res) => {
  const { filmId } = req.params;
  const { resultNotes, existingFiles } = req.body;
  
  let filesArray = [];
  if (existingFiles) {
    try { filesArray = JSON.parse(existingFiles); } catch(e) {}
  }
  
  if (req.files && req.files.length > 0) {
    const newFiles = req.files.map(file => ({
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      type: file.mimetype,
      url: '/uploads/radiology/' + file.filename,
      size: file.size
    }));
    filesArray = [...filesArray, ...newFiles];
  }
  
  if (req.body.resultFile && filesArray.length === 0) {
    try { filesArray = JSON.parse(req.body.resultFile); } catch(e) { filesArray = req.body.resultFile; }
  }

  const filePayload = (Array.isArray(filesArray) && filesArray.length > 0) ? JSON.stringify(filesArray) : (typeof filesArray === 'string' && filesArray ? filesArray : null);

  try {
    const [[oldRequest]] = await db.query('SELECT result_file FROM visit_radiology_requests WHERE radiology_film_id = ? LIMIT 1', [filmId]);

    await db.query(`
      UPDATE visit_radiology_requests 
      SET result_file = ?, result_notes = ?, performed_by = ?, performed_at = NOW() 
      WHERE radiology_film_id = ?
    `, [filePayload, resultNotes || null, req.user.id, filmId]);

    if (oldRequest) {
      deleteUnlinkedFiles(oldRequest.result_file, filesArray || []);
    }
    
    // Notify on film result update
    const [scans] = await db.query(
      `SELECT vrr.status, vrr.visit_id, p.full_name as patientName 
       FROM visit_radiology_requests vrr
       JOIN visits v ON vrr.visit_id = v.id
       JOIN patients p ON v.patient_id = p.id
       WHERE vrr.radiology_film_id = ? LIMIT 1`,
      [filmId]
    );

    const io = req.app.get('io');
    if (io && scans.length > 0) {
       const scanRow = scans[0];
       io.emit('radiology:updated', { visitId: scanRow.visit_id });
       if (scanRow.status === 'completed') {
          io.to('doctor').emit('radiology:completed', { message: 'تم تحديث فحص الأشعة للمريض', patientName: scanRow.patientName, visitId: scanRow.visit_id });
       }
    }

    res.json({ message: 'تم رفع النتيجة المشتركة للفيلم' });
  } catch (error) {
    console.error('uploadFilmResult error:', error);
    res.status(500).json({ message: 'فشل حفظ النتيجة المشتركة' });
  }
};

// 5. Complete all radiology work for a visit and notify doctor
exports.completeVisitRadiology = async (req, res) => {
  const { visitId } = req.params;
  try {
    // Validate if any with_film=1 is still unassigned to a film
    const [unassigned] = await db.query("SELECT id FROM visit_radiology_requests WHERE visit_id = ? AND with_film = 1 AND radiology_film_id IS NULL AND status IN ('paid', 'in_progress', 'completed')", [visitId]);
    if (unassigned.length > 0) {
      return res.status(400).json({ message: 'لا يمكن الإنهاء: توجد فحوصات مع أفلام لم يتم تجميعها أو تحديد حجم فيلم لها' });
    }

    const [rows] = await db.query(`
      SELECT p.full_name as patientName 
      FROM visits v
      JOIN patients p ON v.patient_id = p.id 
      WHERE v.id = ?`, [visitId]);
    const patientName = rows.length > 0 ? rows[0].patientName : '';

    const io = req.app.get('io');
    if (io) {
      io.to('doctor').emit('radiology:completed', { message: 'تم تجهيز أشعة المريض', patientName, visitId });
      io.emit('radiology:updated', { visitId });
    }
    res.json({ message: 'تم إنهاء الزيارة وإشعار الطبيب' });
  } catch (error) {
    console.error('completeVisitRadiology error:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء إنهاء الزيارة' });
  }
};

// 6. Reports & Stats
exports.getStats = async (req, res) => {
  const { startDate, endDate, quickStats } = req.query;
  try {
    let fastFilmFilter = '';
    let tableFilmFilter = '';
    let dateFilterReq = '';
    let dateFilterReqUnion = '';
    const params = [];
    const tableParams = [];
    if (startDate && endDate) {
      fastFilmFilter = `AND created_at BETWEEN ? AND ?`;
      tableFilmFilter = `WHERE f.created_at BETWEEN ? AND ?`;
      dateFilterReq = `AND performed_at BETWEEN ? AND ?`;
      dateFilterReqUnion = `AND vrr.performed_at BETWEEN ? AND ?`;
      
      const startStr = `${startDate} 00:00:00`;
      const endStr = `${endDate} 23:59:59`;
      params.push(startStr, endStr);
      tableParams.push(startStr, endStr, startStr, endStr);
    }

    // Fast Stats
    const [[{ large_films }]] = await db.query(`SELECT COUNT(*) as large_films FROM visit_radiology_films WHERE film_size = 'large' ${fastFilmFilter}`, params);
    const [[{ small_films }]] = await db.query(`SELECT COUNT(*) as small_films FROM visit_radiology_films WHERE film_size = 'small' ${fastFilmFilter}`, params);
    
    const [[{ without_film }]] = await db.query(`SELECT COUNT(*) as without_film FROM visit_radiology_requests WHERE status = 'completed' AND (with_film = 0 OR with_film IS NULL) ${dateFilterReq}`, params);
    
    // Tab Counters
    let tabDateFilter = '';
    const tabParams = [];
    if (startDate && endDate) {
      tabDateFilter = `AND requested_at BETWEEN ? AND ?`;
      tabParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }
    
    const [[{ pendingVisits }]] = await db.query(`SELECT COUNT(DISTINCT visit_id) as pendingVisits FROM visit_radiology_requests WHERE status = 'paid' ${tabDateFilter}`, tabParams);
    const [[{ inProgressVisits }]] = await db.query(`SELECT COUNT(DISTINCT visit_id) as inProgressVisits FROM visit_radiology_requests WHERE status = 'in_progress' ${tabDateFilter}`, tabParams);
    const [[{ completedVisits }]] = await db.query(`SELECT COUNT(DISTINCT visit_id) as completedVisits FROM visit_radiology_requests WHERE status = 'completed' ${tabDateFilter}`, tabParams);
    
    // Detailed Table Stats
    const tableQuery = `
      SELECT 
        v.id as visit_id, v.visit_number, p.full_name as patient_name, p.age as patient_age, p.gender as patient_gender, f.created_at as date, f.film_size,
        COUNT(vrr.id) as scans_in_film,
        GROUP_CONCAT(rt.name SEPARATOR ' - ') as scan_names
      FROM visit_radiology_films f
      JOIN visits v ON f.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      LEFT JOIN visit_radiology_requests vrr ON vrr.radiology_film_id = f.id
      LEFT JOIN radiology_tests rt ON vrr.radiology_test_id = rt.id
      ${tableFilmFilter}
      GROUP BY f.id
      
      UNION ALL
      
      SELECT 
        v.id as visit_id, v.visit_number, p.full_name as patient_name, p.age as patient_age, p.gender as patient_gender, vrr.performed_at as date, 'none' as film_size,
        1 as scans_in_film,
        rt.name as scan_names
      FROM visit_radiology_requests vrr
      JOIN visits v ON vrr.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      JOIN radiology_tests rt ON vrr.radiology_test_id = rt.id
      WHERE vrr.status = 'completed' AND (vrr.with_film = 0 OR vrr.with_film IS NULL)
      ${dateFilterReqUnion}
      
      ORDER BY date DESC
    `;
    // Skip heavy tableQuery for dashboard quick-stats requests
    if (quickStats === '1') {
      return res.json({
        summary: {
          large_films: large_films || 0,
          small_films: small_films || 0,
          without_film: without_film || 0,
          total_operations: (large_films || 0) + (small_films || 0) + (without_film || 0)
        },
        tabCounters: {
          pending: pendingVisits || 0,
          in_progress: inProgressVisits || 0,
          completed: completedVisits || 0,
        }
      });
    }

    const [tableData] = await db.query(tableQuery, tableParams);

    res.json({
      summary: {
        large_films: large_films || 0,
        small_films: small_films || 0,
        without_film: without_film || 0,
        total_operations: (large_films || 0) + (small_films || 0) + (without_film || 0)
      },
      tabCounters: {
        pending: pendingVisits || 0,
        in_progress: inProgressVisits || 0,
        completed: completedVisits || 0,
      },
      tableData
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ message: 'فشل تحميل الإحصائيات' });
  }
};
