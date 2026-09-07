const db = require('../database/db');

// GET /api/doctor/queue - Waiting patients for doctor
exports.getQueue = async (req, res) => {
  try {
    const [visits] = await db.execute(`
      SELECT v.id as visitId, v.visit_number, v.status, v.entity, v.created_at, v.is_follow_up, v.is_exempt,
             p.id as patient_id, p.full_name, p.age, p.gender, p.chronic_diseases, p.allergies, p.current_medications, p.phone
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE DATE(v.created_at) = CURRENT_DATE OR v.status IN ('waiting', 'with_doctor', 'post_surgery')
      ORDER BY v.created_at ASC
    `);

    const result = [];
    for (const v of visits) {
      // Lab requests
      const [labs] = await db.execute(`
        SELECT lr.id, lr.status, lr.price, lr.discount_percentage, lr.discount_amount, lr.final_price, lr.is_free, lr.result_notes, lr.result_file, lr.performed_at, lt.name, lt.id AS test_id
        FROM visit_lab_requests lr
        JOIN lab_tests lt ON lr.lab_test_id = lt.id
        WHERE lr.visit_id = ?
      `, [v.visitId]);

      // Radiology requests
      const [rads] = await db.execute(`
        SELECT rr.id, rr.status, rr.price, rr.discount_percentage, rr.discount_amount, rr.final_price, rr.is_free, rr.with_film, rr.result_notes, rr.result_file, rr.performed_at, rt.name, rt.id AS test_id
        FROM visit_radiology_requests rr
        JOIN radiology_tests rt ON rr.radiology_test_id = rt.id
        WHERE rr.visit_id = ?
      `, [v.visitId]);

      // Clinical requests
      const [clinicals] = await db.execute(`
        SELECT cr.id, cr.status, cr.price, cr.discount_percentage, cr.discount_amount, cr.final_price, cr.is_free, cs.name, cs.id AS test_id
        FROM visit_clinical_service_requests cr
        JOIN clinical_services cs ON cr.service_id = cs.id
        WHERE cr.visit_id = ?
      `, [v.visitId]);

      result.push({
        ...v,
        labRequests: labs,
        radiologyRequests: rads,
        clinicalRequests: clinicals
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// PUT /api/doctor/visit/:visitId/start - Doctor starts examining
exports.startExamination = async (req, res) => {
  try {
    const { visitId } = req.params;
    await db.execute(
      `UPDATE visits SET status = 'with_doctor' WHERE id = ? AND status IN ('waiting', 'awaiting_lab', 'awaiting_radiology', 'pending_payment', 'awaiting_service_payment')`, [visitId]
    );
    res.json({ message: 'تم استدعاء المريض' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
};

// POST /api/doctor/visit/:visitId/order-services - Order lab/radiology/clinical
exports.orderServices = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { visitId } = req.params;
    const { labTests = [], radiologyTests = [], clinicalServices = [] } = req.body;

    const [[visitRow]] = await conn.execute(`SELECT is_exempt FROM visits WHERE id = ?`, [visitId]);
    const isExemptVisit = visitRow ? (visitRow.is_exempt === 1 || visitRow.is_exempt === true) : false;

    let hasNonFree = false;

    // Helper
    const calc = (price, discPercent, isFree) => {
      if (isFree || isExemptVisit) return { discount_amount: price, final_price: 0, is_free: 1 };
      const discAmt = (price * (discPercent || 0)) / 100;
      return { discount_amount: discAmt, final_price: price - discAmt, is_free: 0 };
    };

    // Lab
    for (const test of labTests) {
      const { final_price, discount_amount, is_free } = calc(test.price, test.discount_percentage, test.is_free);
      if (!is_free) hasNonFree = true;
      
      const status = is_free ? 'paid' : 'pending_payment';
      await conn.execute(
        `INSERT INTO visit_lab_requests (visit_id, lab_test_id, price, discount_percentage, discount_amount, final_price, is_free, requested_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [visitId, test.id, test.price, test.discount_percentage || 0, discount_amount, final_price, is_free, req.user.id, status]
      );

      if (is_free) {
        await conn.execute(
          `INSERT INTO financial_transactions (type, category, amount, visit_id, description, performed_by) VALUES (?, ?, ?, ?, ?, ?)`,
          ['income', 'lab', 0, visitId, `تحليل مجاني بواسطة الدكتور (السعر الأصلي: ${test.price}) - ${test.name}`, req.user.id]
        );
      }
    }

    // Radiology
    for (const test of radiologyTests) {
      const testPrice = test.price !== undefined ? test.price : (test.price_with_film || 0);
      const { final_price, discount_amount, is_free } = calc(testPrice, test.discount_percentage, test.is_free);
      if (!is_free) hasNonFree = true;
      
      const status = is_free ? 'paid' : 'pending_payment';
      await conn.execute(
        `INSERT INTO visit_radiology_requests (visit_id, radiology_test_id, with_film, price, discount_percentage, discount_amount, final_price, is_free, requested_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [visitId, test.id, test.withFilm ? 1 : 0, testPrice, test.discount_percentage || 0, discount_amount, final_price, is_free, req.user.id, status]
      );

      if (is_free) {
        await conn.execute(
          `INSERT INTO financial_transactions (type, category, amount, visit_id, description, performed_by) VALUES (?, ?, ?, ?, ?, ?)`,
          ['income', 'radiology', 0, visitId, `أشعة مجانية بواسطة الدكتور (السعر الأصلي: ${testPrice}) - ${test.name}`, req.user.id]
        );
      }
    }

    // Clinical Services
    for (const test of clinicalServices) {
      const { final_price, discount_amount, is_free } = calc(test.price, test.discount_percentage, test.is_free);
      if (!is_free) hasNonFree = true;
      
      const status = is_free ? 'paid' : 'pending_payment';
      await conn.execute(
        `INSERT INTO visit_clinical_service_requests (visit_id, service_id, price, discount_percentage, discount_amount, final_price, is_free, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [visitId, test.id, test.price, test.discount_percentage || 0, discount_amount, final_price, is_free, status]
      );

      if (is_free) {
        await conn.execute(
          `INSERT INTO financial_transactions (type, category, amount, visit_id, description, performed_by) VALUES (?, ?, ?, ?, ?, ?)`,
          ['income', 'clinical', 0, visitId, `خدمة سريرية مجانية بواسطة الدكتور (السعر الأصلي: ${test.price}) - ${test.name}`, req.user.id]
        );
      }
    }

    if (hasNonFree) {
      await conn.execute(`UPDATE visits SET status = 'awaiting_service_payment' WHERE id = ?`, [visitId]);
    } else {
      // If all were free, they are considered paid. We emit events to lab/rad if needed.
      // But we just leave status as 'with_doctor' or 'completed_admin_pending_services'
      // Keep it 'with_doctor' so doctor can still see it in queue.
    }

    await conn.commit();
    
    // Notifications
    const io = req.app.get('io');
    if (io) {
      if (hasNonFree) {
        io.to('cashier').emit('request:new', { message: 'طلبات خدمات جديدة بانتظار الدفع' });
        io.to('cashier').emit('cashier:update');
      }
      if (labTests.some(t => t.is_free)) io.to('lab').emit('request:new', { message: 'طلب تحاليل جديد' });
      if (radiologyTests.some(t => t.is_free)) io.to('radiology').emit('request:new', { message: 'طلب أشعة جديدة' });
      io.emit('cashier:update');
    }

    res.json({ message: 'تم طلب الخدمات بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// PUT /api/doctor/visit/:visitId/close - Close visit
exports.closeVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    await db.execute(
      `UPDATE visits SET status = 'completed', closed_at = NOW() WHERE id = ?`, [visitId]
    );
    res.json({ message: 'تم إغلاق الزيارة' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// PUT /api/doctor/visit/:visitId/refer-surgery - Refer to surgery center
exports.referToSurgery = async (req, res) => {
  try {
    const { visitId } = req.params;
    
    // 1. Get patient_id from visit
    const [visitRows] = await db.execute(`SELECT patient_id FROM visits WHERE id = ?`, [visitId]);
    if (visitRows.length === 0) {
      return res.status(404).json({ message: 'الزيارة غير موجودة' });
    }
    const patientId = visitRows[0].patient_id;

    // 2. Insert into surgeries if not exists
    const [existing] = await db.execute(`SELECT id FROM surgeries WHERE visit_id = ?`, [visitId]);
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO surgeries (visit_id, patient_id, status) VALUES (?, ?, 'planned')`,
        [visitId, patientId]
      );
    }

    // 3. Update visit status
    await db.execute(
      `UPDATE visits SET status = 'transferred_to_center' WHERE id = ?`, [visitId]
    );

    // 4. Emit socket event for the coordinator
    const io = req.app.get('io');
    if (io) {
      io.emit('surgery:new_referral', { message: 'تحويل مريض جديد إلى العمليات' });
      io.to('cashier').emit('cashier:update');
    }

    res.json({ message: 'تم تحويل المريض للعمليات بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// GET /api/doctor/patient/:patientId/history - Get patient timeline/history
exports.getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Fetch visits
    const [visits] = await db.execute(`
      SELECT id, visit_number, created_at, status, closed_at, is_exempt, is_follow_up
      FROM visits 
      WHERE patient_id = ? 
      ORDER BY created_at DESC
    `, [patientId]);

    // For each visit, fetch lab, radiology, clinical, and surgeries
    for (let visit of visits) {
      // Lab
      const [lab] = await db.execute(`
        SELECT r.id, l.name, r.status, r.result_notes, r.result_file,
               r.price, r.discount_percentage, r.discount_amount, r.final_price, r.is_free
        FROM visit_lab_requests r
        JOIN lab_tests l ON l.id = r.lab_test_id
        WHERE r.visit_id = ?
      `, [visit.id]);
      visit.labTests = lab;

      // Radiology
      const [rad] = await db.execute(`
        SELECT r.id, rad.name, r.status, r.result_notes, r.result_file, r.with_film, r.radiology_film_id, f.film_size,
               r.price, r.discount_percentage, r.discount_amount, r.final_price, r.is_free
        FROM visit_radiology_requests r
        JOIN radiology_tests rad ON rad.id = r.radiology_test_id
        LEFT JOIN visit_radiology_films f ON f.id = r.radiology_film_id
        WHERE r.visit_id = ?
      `, [visit.id]);
      visit.radiologyTests = rad;

      // Clinical
      const [clin] = await db.execute(`
        SELECT r.id, c.name, r.status,
               r.price, r.discount_percentage, r.discount_amount, r.final_price, r.is_free
        FROM visit_clinical_service_requests r
        JOIN clinical_services c ON c.id = r.service_id
        WHERE r.visit_id = ?
      `, [visit.id]);
      visit.clinicalServices = clin;

      // Surgeries
      const [surg] = await db.execute(`
        SELECT surgery_type, status, scheduled_date
        FROM surgeries
        WHERE visit_id = ?
      `, [visit.id]);
      visit.surgeries = surg;

      // Prescriptions
      const [presc] = await db.execute(`
        SELECT id FROM prescriptions WHERE visit_id = ?
      `, [visit.id]);
      if (presc.length > 0) {
        const [items] = await db.execute(`
          SELECT medication_name, dosage, duration, instructions
          FROM prescription_items
          WHERE prescription_id = ?
          ORDER BY id ASC
        `, [presc[0].id]);
        visit.prescriptionItems = items;
      } else {
        visit.prescriptionItems = [];
      }
    }

    res.json(visits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب السجل الطبي' });
  }
};

// ── Doctor Admin Routes ───────────────────────────────────────────
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, full_name, username, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { fullName, username, role, password } = req.body;
    if (!fullName || !username || !role || !password)
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

    const hash = await bcrypt.hash(password, 10);
    await db.execute(
      `INSERT INTO users (full_name, username, role, password_hash, must_change_password, created_by) VALUES (?, ?, ?, ?, true, ?)`,
      [fullName, username, role, hash, req.user.id]
    );
    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ message: 'اسم المستخدم مستخدم بالفعل' });
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === req.user.id)
      return res.status(400).json({ message: 'لا يمكنك تعطيل حسابك الخاص' });
    await db.execute('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
    res.json({ message: 'تم تحديث حالة المستخدم' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const hash = await bcrypt.hash(newPassword, 10);
    await db.execute(
      'UPDATE users SET password_hash = ?, must_change_password = true WHERE id = ?', [hash, id]
    );
    res.json({ message: 'تم إعادة تعيين كلمة المرور' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ── Admin: Lab/Radiology Catalog ─────────────────────────────────
exports.getLabTests = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT t.*, c.name as category_name FROM lab_tests t
      LEFT JOIN lab_categories c ON t.category_id = c.id
      WHERE t.is_active = true AND t.is_deleted = 0 ORDER BY c.name, t.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.getRadiologyTests = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT t.*, c.name as category_name FROM radiology_tests t
      LEFT JOIN radiology_categories c ON t.category_id = c.id
      WHERE t.is_active = true AND t.is_deleted = 0 ORDER BY c.name, t.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ── Settings (read/write from DB) ─────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ message: 'مفتاح وقيمة مطلوبان' });
    await db.execute(
      `INSERT INTO settings (setting_key, setting_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by), updated_at=NOW()`,
      [key, String(value), req.user.id]
    );
    // Log audit
    await db.execute(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, new_values) VALUES (?, 'update', 'settings', NULL, ?)`,
      [req.user.id, JSON.stringify({ key, value })]
    );
    res.json({ message: 'تم حفظ الإعداد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ── Audit Log (real DB) ───────────────────────────────────────────
exports.getAuditLog = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const [rows] = await db.execute(`
      SELECT al.*, u.full_name AS user_name, u.role AS user_role
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// GET /api/doctor/dashboard-stats - Today stats for Doctor Dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // 1. Patient flow (Today)
    const [[patientsFlow]] = await db.execute(`
      SELECT 
        COUNT(id) as total,
        SUM(CASE WHEN status IN ('waiting', 'with_doctor') THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM visits
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // 2. Medical procedures (Today ordered by this doctor)
    // Lab tests today
    const [[labStats]] = await db.execute(`
      SELECT 
        COUNT(id) as total,
        SUM(CASE WHEN status IN ('pending_payment', 'paid', 'in_progress') THEN 1 ELSE 0 END) as awaiting,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM visit_lab_requests
      WHERE requested_by = ? AND DATE(requested_at) = CURRENT_DATE
    `, [doctorId]);

    // Radiology tests today
    const [[radStats]] = await db.execute(`
      SELECT 
        COUNT(id) as total,
        SUM(CASE WHEN status IN ('pending_payment', 'paid', 'in_progress') THEN 1 ELSE 0 END) as awaiting,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM visit_radiology_requests
      WHERE requested_by = ? AND DATE(requested_at) = CURRENT_DATE
    `, [doctorId]);

    // Clinical services today
    const [[clinStats]] = await db.execute(`
      SELECT 
        COUNT(vr.id) as total,
        SUM(CASE WHEN vr.status IN ('pending_payment', 'paid') THEN 1 ELSE 0 END) as awaiting,
        SUM(CASE WHEN vr.status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM visit_clinical_service_requests vr
      JOIN visits v ON vr.visit_id = v.id
      WHERE v.created_by = ? AND DATE(vr.created_at) = CURRENT_DATE
    `, [doctorId]);

    const totalOrdered = (labStats.total || 0) + (radStats.total || 0) + (clinStats.total || 0);
    const awaitingResults = (labStats.awaiting || 0) + (radStats.awaiting || 0) + (clinStats.awaiting || 0);
    const completedResults = (labStats.completed || 0) + (radStats.completed || 0) + (clinStats.completed || 0);

    // 3. Financial Activity (Today)
    // Total discounts granted today in visits, labs, rads, clinicals
    const [[visitDiscounts]] = await db.execute(`
      SELECT SUM(discount_amount) as total
      FROM visits
      WHERE DATE(created_at) = CURRENT_DATE
    `);
    const [[labDiscounts]] = await db.execute(`
      SELECT SUM(discount_amount) as total
      FROM visit_lab_requests
      WHERE requested_by = ? AND DATE(requested_at) = CURRENT_DATE
    `, [doctorId]);
    const [[radDiscounts]] = await db.execute(`
      SELECT SUM(discount_amount) as total
      FROM visit_radiology_requests
      WHERE requested_by = ? AND DATE(requested_at) = CURRENT_DATE
    `, [doctorId]);
    const [[clinDiscounts]] = await db.execute(`
      SELECT SUM(vr.discount_amount) as total
      FROM visit_clinical_service_requests vr
      JOIN visits v ON vr.visit_id = v.id
      WHERE v.created_by = ? AND DATE(vr.created_at) = CURRENT_DATE
    `, [doctorId]);

    const totalDiscounts = 
      parseFloat(visitDiscounts.total || 0) + 
      parseFloat(labDiscounts.total || 0) + 
      parseFloat(radDiscounts.total || 0) + 
      parseFloat(clinDiscounts.total || 0);

    // 4. Exempt/VIP direct visits today
    const [[exemptStats]] = await db.execute(`
      SELECT COUNT(id) as total
      FROM visits
      WHERE is_exempt = 1 AND DATE(created_at) = CURRENT_DATE
    `);

    // 5. Patient chart over time (for the dashboard area chart: last 7 days)
    const [chartRows] = await db.execute(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(id) as count
      FROM visits
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    res.json({
      patientsFlow: {
        total: patientsFlow.total || 0,
        waiting: patientsFlow.waiting || 0,
        completed: patientsFlow.completed || 0
      },
      procedures: {
        total: totalOrdered,
        awaiting: awaitingResults,
        completed: completedResults
      },
      financial: {
        discounts: totalDiscounts,
        exemptCount: exemptStats.total || 0
      },
      chart: chartRows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// DELETE /api/doctor/order-service/:type/:id - Cancel/Delete a service request if pending payment
exports.cancelServiceRequest = async (req, res) => {
  try {
    const { type, id } = req.params;
    let tableName = '';
    
    if (type === 'lab') {
      tableName = 'visit_lab_requests';
    } else if (type === 'radiology') {
      tableName = 'visit_radiology_requests';
    } else if (type === 'clinical') {
      tableName = 'visit_clinical_service_requests';
    } else {
      return res.status(400).json({ message: 'نوع الخدمة غير معروف' });
    }

    // Check if the service request is in a cancellable state
    const [existing] = await db.execute(
      `SELECT status, visit_id, is_free, final_price FROM ${tableName} WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    // Condition A: Free service, not yet executed by lab tech (status = 'pending' or 'paid')
    // Condition B: Paid service awaiting cashier payment (status = 'pending_payment')
    // Condition C: Free service marked 'paid' by system but lab hasn't started yet
    const isFree = existing[0].is_free === 1 || parseFloat(existing[0].final_price || 0) === 0;
    const isPendingPayment = existing[0].status === 'pending_payment';
    const isPending        = existing[0].status === 'pending';
    const isPaidFree       = existing[0].status === 'paid' && isFree;

    if (!isPendingPayment && !isPending && !isPaidFree) {
      return res.status(400).json({ message: 'لا يمكن إلغاء الطلب بعد سداد رسومه أو بدء العمل فيه' });
    }

    // Delete the request
    await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);

    // Check if there are other non-free pending requests to determine visit status
    const visitId = existing[0].visit_id;
    const [labs] = await db.execute(`SELECT id FROM visit_lab_requests WHERE visit_id = ? AND status = 'pending_payment'`, [visitId]);
    const [rads] = await db.execute(`SELECT id FROM visit_radiology_requests WHERE visit_id = ? AND status = 'pending_payment'`, [visitId]);
    const [clins] = await db.execute(`SELECT id FROM visit_clinical_service_requests WHERE visit_id = ? AND status = 'pending_payment'`, [visitId]);
    
    if (labs.length === 0 && rads.length === 0 && clins.length === 0) {
      // Restore visit status to 'with_doctor'
      await db.execute(`UPDATE visits SET status = 'with_doctor' WHERE id = ? AND status = 'awaiting_service_payment'`, [visitId]);
    }

    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');

    res.json({ message: 'تم إلغاء الطلب بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// POST /api/doctor/visit/:visitId/prescription - Save prescription
exports.savePrescription = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { visitId } = req.params;
    const { items = [] } = req.body;

    const [visitRows] = await conn.execute(`SELECT patient_id FROM visits WHERE id = ?`, [visitId]);
    if (visitRows.length === 0) {
      return res.status(404).json({ message: 'الزيارة غير موجودة' });
    }
    const patientId = visitRows[0].patient_id;

    const [existing] = await conn.execute(`SELECT id FROM prescriptions WHERE visit_id = ?`, [visitId]);
    if (existing.length > 0) {
      await conn.execute(`DELETE FROM prescriptions WHERE visit_id = ?`, [visitId]);
    }

    const [prescriptionRes] = await conn.execute(
      `INSERT INTO prescriptions (visit_id, patient_id, doctor_id) VALUES (?, ?, ?)`,
      [visitId, patientId, req.user.id]
    );
    const prescriptionId = prescriptionRes.insertId;

    for (const item of items) {
      if (!item.medication_name) continue;
      await conn.execute(
        `INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions) VALUES (?, ?, ?, ?, ?, ?)`,
        [prescriptionId, item.medication_name.trim(), item.dosage || '', item.frequency || '', item.duration || '', item.instructions || '']
      );
    }

    await conn.commit();
    res.json({ message: 'تم حفظ الوصفة الطبية بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// GET /api/doctor/visit/:visitId/prescription - Get prescription
exports.getPrescription = async (req, res) => {
  try {
    const { visitId } = req.params;
    const [prescRows] = await db.execute(
      `SELECT * FROM prescriptions WHERE visit_id = ?`, [visitId]
    );

    if (prescRows.length === 0) {
      return res.json({ items: [] });
    }

    const [items] = await db.execute(
      `SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY id ASC`,
      [prescRows[0].id]
    );

    res.json({
      ...prescRows[0],
      items
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// POST /api/doctor/vip-intake
exports.createVipIntake = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { patientId: existingPatientId, fullName, age, gender = 'male', phone = null } = req.body;
    
    let patientId = existingPatientId;

    if (patientId) {
      const [[existingVisitToday]] = await conn.execute(
        `SELECT id FROM visits WHERE patient_id = ? AND DATE(created_at) = CURDATE() AND status != 'cancelled'`,
        [patientId]
      );
      if (existingVisitToday) {
        await conn.rollback();
        return res.status(409).json({ message: 'هذا المريض مسجل بالفعل في قائمة زيارات اليوم.' });
      }
    } else {
      if (!fullName) return res.status(400).json({ message: 'الاسم مطلوب' });
      
      const [[existingPatientVisit]] = await conn.execute(`
        SELECT v.id FROM visits v
        JOIN patients p ON v.patient_id = p.id
        WHERE p.full_name = ? AND DATE(v.created_at) = CURDATE() AND v.status != 'cancelled'
      `, [fullName.trim()]);
      
      if (existingPatientVisit) {
        await conn.rollback();
        return res.status(409).json({ message: 'يوجد مريض بهذا الاسم مسجل بالفعل في قائمة زيارات اليوم.' });
      }

      // Insert patient
      const [patientResult] = await conn.execute(
        `INSERT INTO patients (full_name, age, gender, phone, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [fullName.trim(), age || null, gender, phone || null, req.user.id]
      );
      patientId = patientResult.insertId;
    }

    const visitNumber = `VIP${Date.now()}`;
    const [visitResult] = await conn.execute(
      `INSERT INTO visits (patient_id, visit_number, entity, status, is_exempt, entry_fee, created_by)
       VALUES (?, ?, 'clinic', 'with_doctor', 1, 0, ?)`,
      [patientId, visitNumber, req.user.id]
    );
    const visitId = visitResult.insertId;

    await conn.commit();

    // Fetch the newly created visit with patient info
    const [[newVisit]] = await db.execute(`
      SELECT v.id as visitId, v.visit_number, v.status, v.entity, v.created_at, v.is_follow_up, v.is_exempt,
             p.id as patient_id, p.full_name, p.age, p.gender, p.chronic_diseases, p.allergies, p.current_medications, p.phone
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = ?
    `, [visitId]);

    // Send realtime notification
    const io = req.app.get('io');
    if (io) {
      io.emit('patient:waiting'); // triggers queue refresh
      io.to('cashier').emit('cashier:update');
    }

    res.status(201).json({
      message: 'تم تسجيل حالة الإعفاء المباشرة بنجاح',
      visit: {
        ...newVisit,
        labRequests: [],
        radiologyRequests: [],
        clinicalRequests: []
      }
    });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};





