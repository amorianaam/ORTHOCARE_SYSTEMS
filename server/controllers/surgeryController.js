const db = require('../database/db');

// 1. Get all surgeries for dashboard
exports.getSurgeriesDashboard = async (req, res) => {
  try {
    const query = `
      SELECT s.id, s.visit_id, s.surgery_type, s.full_price, 'YER' as currency, s.status, s.scheduled_date, 
             v.visit_number, p.full_name, p.age,
             (SELECT COALESCE(SUM(amount), 0) FROM surgery_payments WHERE surgery_id = s.id) as total_paid
      FROM surgeries s
      JOIN visits v ON s.visit_id = v.id
      JOIN patients p ON s.patient_id = p.id
      ORDER BY s.created_at DESC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('getSurgeriesDashboard error:', error);
    res.status(500).json({ message: 'فشل تحميل بيانات العمليات' });
  }
};

// 2. Get specific surgery details
exports.getSurgeryDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const surgeryQuery = `
      SELECT s.*, v.visit_number, p.full_name, p.age, p.gender, p.allergies, p.chronic_diseases
      FROM surgeries s
      JOIN visits v ON s.visit_id = v.id
      JOIN patients p ON s.patient_id = p.id
      WHERE s.id = ?
    `;
    const [surgeryRows] = await db.query(surgeryQuery, [id]);
    if (surgeryRows.length === 0) return res.status(404).json({ message: 'العملية غير موجودة' });

    const surgery = surgeryRows[0];

    // Get diagnostic services
    const [labs] = await db.query("SELECT vlr.*, lt.name FROM visit_lab_requests vlr JOIN lab_tests lt ON vlr.lab_test_id = lt.id WHERE vlr.surgery_id = ?", [id]);
    const [rads] = await db.query("SELECT vrr.*, rt.name FROM visit_radiology_requests vrr JOIN radiology_tests rt ON vrr.radiology_test_id = rt.id WHERE vrr.surgery_id = ?", [id]);
    
    // Get materials used
    const [materials] = await db.query("SELECT smu.*, inv.name, inv.unit FROM surgery_materials_used smu JOIN or_inventory_items inv ON smu.inventory_item_id = inv.id WHERE smu.surgery_id = ?", [id]);

    // Get expenses
    const [expenses] = await db.query("SELECT * FROM surgery_expenses WHERE surgery_id = ?", [id]);

    // Get payments
    const [payments] = await db.query("SELECT * FROM surgery_payments WHERE surgery_id = ?", [id]);

    res.json({
      surgery,
      diagnosticServices: { labs, rads },
      materials,
      expenses,
      payments
    });
  } catch (error) {
    console.error('getSurgeryDetails error:', error);
    res.status(500).json({ message: 'فشل تحميل تفاصيل العملية' });
  }
};

// 3. Price and Schedule Surgery
exports.priceSurgery = async (req, res) => {
  const { id } = req.params;
  const { surgery_type, full_price, scheduled_date } = req.body;
  try {
    await db.query(
      "UPDATE surgeries SET surgery_type = ?, full_price = ?, scheduled_date = ?, status = 'scheduled' WHERE id = ?",
      [surgery_type, full_price, scheduled_date || null, id]
    );
    res.json({ message: 'تم تسعير وجدولة العملية بنجاح وإرسالها للصندوق' });
  } catch (error) {
    console.error('priceSurgery error:', error);
    res.status(500).json({ message: 'فشل التسعير' });
  }
};

// 4. Update Status (e.g., scheduled -> post_op)
exports.updateSurgeryStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query("UPDATE surgeries SET status = ? WHERE id = ?", [status, id]);
    res.json({ message: 'تم تحديث حالة العملية بنجاح' });
  } catch (error) {
    console.error('updateSurgeryStatus error:', error);
    res.status(500).json({ message: 'فشل تحديث الحالة' });
  }
};

// 5. Add Diagnostic Service
exports.addDiagnosticService = async (req, res) => {
  const { id } = req.params;
  const { type, test_id, with_film } = req.body; // type: 'lab' or 'rad'
  
  try {
    // Get surgery visit_id
    const [surgRows] = await db.query("SELECT visit_id FROM surgeries WHERE id = ?", [id]);
    if (surgRows.length === 0) return res.status(404).json({ message: 'Not found' });
    const visit_id = surgRows[0].visit_id;

    if (type === 'lab') {
      await db.query(
        "INSERT INTO visit_lab_requests (visit_id, lab_test_id, surgery_id, is_included_in_surgery, price, status, requested_by) VALUES (?, ?, ?, true, 0, 'paid', ?)",
        [visit_id, test_id, id, req.user.id]
      );
      // Notify Lab
      const io = req.app.get('io');
      if (io) io.to('lab').emit('request:new', { message: 'طلب تحليل جديد ضمن عملية جراحية' });
    } else {
      await db.query(
        "INSERT INTO visit_radiology_requests (visit_id, radiology_test_id, surgery_id, is_included_in_surgery, with_film, price, status, requested_by) VALUES (?, ?, ?, true, ?, 0, 'paid', ?)",
        [visit_id, test_id, id, with_film ? 1 : 0, req.user.id]
      );
      // Notify Radiology
      const io = req.app.get('io');
      if (io) io.to('radiology').emit('request:new', { message: 'طلب أشعة جديد ضمن عملية جراحية' });
    }
    
    res.json({ message: 'تم إضافة الخدمة التشخيصية بنجاح' });
  } catch (error) {
    console.error('addDiagnosticService error:', error);
    res.status(500).json({ message: 'فشل إضافة الخدمة التشخيصية' });
  }
};

// 6. Get OR Inventory Items
exports.getInventoryItems = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, unit, quantity, cost_price FROM or_inventory_items WHERE is_active = true");
    res.json(rows);
  } catch (error) {
    console.error('getInventoryItems error:', error);
    res.status(500).json({ message: 'فشل تحميل مواد المخزن' });
  }
};

// 7. Add Material Used
exports.addMaterial = async (req, res) => {
  const { id } = req.params;
  const { inventory_item_id, quantity } = req.body;
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
      // Get item prices
      const [itemRows] = await connection.query("SELECT cost_price FROM or_inventory_items WHERE id = ?", [inventory_item_id]);
      if (itemRows.length === 0) throw new Error("المادة غير موجودة");
      const { cost_price } = itemRows[0];
        const issue_price = cost_price;

      // Insert material record
      await connection.query(
        "INSERT INTO surgery_materials_used (surgery_id, inventory_item_id, quantity, cost_price, issue_price) VALUES (?, ?, ?, ?, ?)",
        [id, inventory_item_id, quantity, cost_price, issue_price]
      );

      // Deduct from inventory
      await connection.query("UPDATE or_inventory_items SET quantity = quantity - ? WHERE id = ?", [quantity, inventory_item_id]);

      await connection.commit();
      res.json({ message: 'تم إضافة المادة وخصمها من المخزن' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('addMaterial error:', error);
    res.status(500).json({ message: 'فشل إضافة المادة' });
  }
};

// 8. Add Expense
exports.addExpense = async (req, res) => {
  const { id } = req.params;
  const { description, amount } = req.body;
  try {
    await db.query(
      "INSERT INTO surgery_expenses (surgery_id, description, amount, created_by) VALUES (?, ?, ?, ?)",
      [id, description, amount, req.user.id]
    );
    res.json({ message: 'تم إضافة التكلفة' });
  } catch (error) {
    console.error('addExpense error:', error);
    res.status(500).json({ message: 'فشل إضافة التكلفة' });
  }
};

// 9. Complete Surgery
exports.completeSurgery = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE surgeries SET status = 'completed', completed_date = NOW() WHERE id = ?", [id]);
    res.json({ message: 'تم إنهاء العملية بنجاح' });
  } catch (error) {
    console.error('completeSurgery error:', error);
    res.status(500).json({ message: 'فشل إنهاء العملية' });
  }
};
