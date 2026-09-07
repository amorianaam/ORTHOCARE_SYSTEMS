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
        const relUrl = oldFile.url.startsWith('/') ? oldFile.url.substring(1) : oldFile.url;
        const filePath = path.join(__dirname, '..', relUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });
  } catch (e) { console.error('Lab GC Error:', e); }
};

// 1. Get all distinct visits based on tab
exports.getRequests = async (req, res) => {
  const { tab = 'pending', startDate, endDate } = req.query;
  try {
    let statusFilter = "('paid')";
    if (tab === 'in_progress') statusFilter = "('in_progress', 'result_uploaded')";
    if (tab === 'completed') statusFilter = "('completed')";

    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      if (tab === 'completed') {
        dateFilter = `AND (SELECT MAX(performed_at) FROM visit_lab_requests WHERE visit_id = v.id AND status = 'completed') BETWEEN ? AND ?`;
      } else {
        dateFilter = `AND (SELECT MIN(requested_at) FROM visit_lab_requests WHERE visit_id = v.id) BETWEEN ? AND ?`;
      }
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const query = `
      SELECT DISTINCT 
        v.id as visit_id, 
        v.visit_number, 
        p.full_name, 
        p.age, 
        p.gender,
        (SELECT MIN(requested_at) FROM visit_lab_requests WHERE visit_id = v.id AND status IN ${statusFilter}) as requested_at,
        (SELECT COUNT(*) FROM visit_lab_requests WHERE visit_id = v.id AND status IN ${statusFilter}) as total_tab_tests,
        (SELECT COUNT(*) FROM visit_lab_requests WHERE visit_id = v.id AND status = 'in_progress') as total_in_progress,
        (SELECT COUNT(*) FROM visit_lab_requests WHERE visit_id = v.id AND status = 'completed') as total_completed_tests
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN visit_lab_requests vlr ON v.id = vlr.visit_id
      WHERE vlr.status IN ${statusFilter}
      ${dateFilter}
      ORDER BY total_in_progress DESC, requested_at ASC
    `;
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('getRequests error:', error);
    res.status(500).json({ message: 'فشل تحميل الطلبات' });
  }
};

// 2. Get details for a specific visit (only the requested lab tests)
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
      SELECT vlr.id, vlr.status, vlr.result_file, vlr.result_notes, lt.name, lc.name as category_name
      FROM visit_lab_requests vlr
      JOIN lab_tests lt ON vlr.lab_test_id = lt.id
      LEFT JOIN lab_categories lc ON lt.category_id = lc.id
      WHERE vlr.visit_id = ? AND vlr.status IN ('paid', 'in_progress', 'result_uploaded', 'completed')
      ORDER BY vlr.id ASC
    `;
    const [requests] = await db.query(requestsQuery, [visitId]);

    res.json({
      visit: visitRows[0],
      requests
    });
  } catch (error) {
    console.error('getVisitDetails error:', error);
    res.status(500).json({ message: 'فشل تحميل تفاصيل الزيارة' });
  }
};

// 3. Update status (e.g. to in_progress)
exports.updateRequestStatus = async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  try {
    const [[currentReq]] = await db.query("SELECT status FROM visit_lab_requests WHERE id = ?", [requestId]);
    if (currentReq && currentReq.status === 'pending_payment' && (status === 'in_progress' || status === 'completed')) {
      return res.status(403).json({ message: 'لا يمكن تحديث حالة طلب غير مدفوع' });
    }

    await db.query("UPDATE visit_lab_requests SET status = ?, performed_by = ? WHERE id = ?", [status, req.user.id, requestId]);
    const io = req.app.get('io');
    if (io) io.emit('lab:update');
    res.json({ message: 'تم تحديث الحالة بنجاح' });
  } catch (error) {
    console.error('updateRequestStatus error:', error);
    res.status(500).json({ message: 'فشل تحديث الحالة' });
  }
};

// 3b. Start all requests for a visit
exports.startAllRequests = async (req, res) => {
  const { visitId } = req.params;
  try {
    await db.query("UPDATE visit_lab_requests SET status = 'in_progress', performed_by = ? WHERE visit_id = ? AND status = 'paid'", [req.user.id, visitId]);
    const io = req.app.get('io');
    if (io) io.emit('lab:update');
    res.json({ message: 'تم استلام كافة العينات بنجاح' });
  } catch (error) {
    console.error('startAllRequests error:', error);
    res.status(500).json({ message: 'فشل استلام العينات' });
  }
};

// 4. Upload result (FormData multipart: files via Multer + resultNotes)
exports.uploadResult = async (req, res) => {
  const { requestId } = req.params;
  const { resultNotes, existingFiles } = req.body;

  // Build file array: start with preserved existing server files
  let filesArray = [];
  if (existingFiles) {
    try { filesArray = JSON.parse(existingFiles); } catch(e) {}
  }

  // Append newly uploaded disk files from Multer
  if (req.files && req.files.length > 0) {
    const newFiles = req.files.map(file => ({
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      type: file.mimetype,
      url: '/uploads/lab/' + file.filename,
      size: file.size
    }));
    filesArray = [...filesArray, ...newFiles];
  }

  // Legacy fallback: accept old Base64 payload if no new files
  if (req.body.resultFile && filesArray.length === 0) {
    try { filesArray = JSON.parse(req.body.resultFile); } catch(e) { filesArray = req.body.resultFile; }
  }

  const filePayload = (Array.isArray(filesArray) && filesArray.length > 0)
    ? JSON.stringify(filesArray)
    : (typeof filesArray === 'string' && filesArray ? filesArray : null);

  try {
    // Fetch current record for GC and status logic
    const [[currentReq]] = await db.query(`
      SELECT vlr.status, vlr.visit_id, vlr.result_file, p.full_name as patient_name
      FROM visit_lab_requests vlr
      JOIN visits v ON vlr.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      WHERE vlr.id = ?
    `, [requestId]);

    if (!currentReq) return res.status(404).json({ message: "الطلب غير موجود" });

    const newStatus = (currentReq.status === 'completed') ? 'completed' : 'result_uploaded';

    await db.query(`
      UPDATE visit_lab_requests
      SET status = ?, result_notes = ?, result_file = ?, performed_by = ?, performed_at = NOW()
      WHERE id = ?`,
      [newStatus, resultNotes || null, filePayload, req.user.id, requestId]
    );

    // Garbage-collect orphaned disk files (only fires on disk-stored files, safe for Base64 legacy)
    deleteUnlinkedFiles(currentReq.result_file, filesArray || []);

    const io = req.app.get('io');
    if (io) {
      io.emit('lab:update', { visitId: currentReq.visit_id });
      if (currentReq.status === 'completed') {
        io.to('doctor').emit('lab:completed', {
          message: 'تم تعديل تقرير مختبر',
          visitId: currentReq.visit_id,
          patientName: currentReq.patient_name
        });
      }
    }

    res.json({ message: 'تم حفظ النتيجة بنجاح' });
  } catch (error) {
    console.error('uploadResult error:', error);
    res.status(500).json({ message: 'فشل حفظ النتيجة' });
  }
};

// 5. Complete all lab work for a visit and notify doctor
exports.completeVisitLab = async (req, res) => {
  const { visitId } = req.params;
  try {
    // Ensure all requests that are uploaded become fully completed
    await db.query(`
      UPDATE visit_lab_requests 
      SET status = 'completed' 
      WHERE visit_id = ? AND status = 'result_uploaded'`, [visitId]);

    const [rows] = await db.query(`
      SELECT p.full_name as patientName 
      FROM visits v
      JOIN patients p ON v.patient_id = p.id 
      WHERE v.id = ?`, [visitId]);
    const patientName = rows.length > 0 ? rows[0].patientName : '';

    const io = req.app.get('io');
    if (io) {
      io.to('doctor').emit('lab:completed', { message: `تم تجهيز تحاليل المريض`, patientName, visitId });
      io.emit('lab:update');
    }
    res.json({ message: 'تم إنهاء الزيارة وإشعار الطبيب' });
  } catch (error) {
    console.error('completeVisitLab error:', error);
    res.status(500).json({ message: 'تعذر تحديث حالة انتهاء المختبر' });
  }
};

// 6. Reports & Stats
exports.getStats = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = `WHERE requested_at BETWEEN ? AND ?`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const [[{ total_requests }]] = await db.query(`SELECT COUNT(*) as total_requests FROM visit_lab_requests ${dateFilter}`, params);
    const [[{ completed }]] = await db.query(`SELECT COUNT(*) as completed FROM visit_lab_requests WHERE status = 'completed' ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    const [[{ pending }]] = await db.query(`SELECT COUNT(*) as pending FROM visit_lab_requests WHERE status IN ('paid', 'in_progress') ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    
    const [[{ pendingVisits }]] = await db.query(`SELECT COUNT(DISTINCT visit_id) as pendingVisits FROM visit_lab_requests WHERE status = 'paid' ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    const [[{ inProgressVisits }]] = await db.query(`SELECT COUNT(DISTINCT visit_id) as inProgressVisits FROM visit_lab_requests WHERE status IN ('in_progress', 'result_uploaded') ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    const [[{ completedVisits }]] = await db.query(`SELECT COUNT(DISTINCT visit_id) as completedVisits FROM visit_lab_requests WHERE status = 'completed' ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    
    const tableQuery = `
      SELECT 
        v.id as visit_id,
        v.visit_number, 
        p.full_name as patient_name, 
        MAX(vlr.requested_at) as date,
        COUNT(vlr.id) as total_tests,
        SUM(CASE WHEN vlr.status = 'completed' THEN 1 ELSE 0 END) as completed_tests
      FROM visit_lab_requests vlr
      JOIN visits v ON vlr.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      ${dateFilter.replace('requested_at', 'vlr.requested_at')}
      GROUP BY v.id
      ORDER BY date DESC
    `;
    const [tableData] = await db.query(tableQuery, params);

    res.json({
      summary: {
        total_requests: total_requests || 0,
        completed: completed || 0,
        pending: pending || 0,
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
