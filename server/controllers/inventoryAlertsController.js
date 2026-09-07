const db = require('../database/db');

exports.getGeneralAlerts = async (req, res) => {
  try {
    const tableName = 'general_inventory_items';

    // Get items near expiry (less than 90 days) or expired
    const [expiryItems] = await db.query(`
      SELECT 
        id, name, unit as type, expiry_date, quantity,
        DATEDIFF(expiry_date, CURDATE()) as days_left
      FROM ${tableName}
      WHERE expiry_date IS NOT NULL 
        AND is_active = 1 
        AND quantity > 0
        AND DATEDIFF(expiry_date, CURDATE()) <= 90
      ORDER BY days_left ASC
    `);

    // Get items out of stock or below min_quantity
    const [stockItems] = await db.query(`
      SELECT 
        id, name, unit as type, quantity, min_quantity
      FROM ${tableName}
      WHERE is_active = 1
        AND min_quantity IS NOT NULL
        AND quantity <= min_quantity
      ORDER BY quantity ASC
    `);

    res.json({ expiry: expiryItems, stock: stockItems });
  } catch (err) {
    console.error('[Inventory Alerts Error]', err);
    res.status(500).json({ message: 'خطأ في جلب التنبيهات' });
  }
};

exports.getOrAlerts = async (req, res) => {
  try {
    const tableName = 'or_inventory_items';

    // Get items near expiry (less than 90 days) or expired
    const [expiryItems] = await db.query(`
      SELECT 
        id, name, unit as type, expiry_date, quantity,
        DATEDIFF(expiry_date, CURDATE()) as days_left
      FROM ${tableName}
      WHERE expiry_date IS NOT NULL 
        AND is_active = 1 
        AND quantity > 0
        AND DATEDIFF(expiry_date, CURDATE()) <= 90
      ORDER BY days_left ASC
    `);

    // Get items out of stock or below min_quantity
    const [stockItems] = await db.query(`
      SELECT 
        id, name, unit as type, quantity, min_quantity
      FROM ${tableName}
      WHERE is_active = 1
        AND min_quantity IS NOT NULL
        AND quantity <= min_quantity
      ORDER BY quantity ASC
    `);

    res.json({ expiry: expiryItems, stock: stockItems });
  } catch (err) {
    console.error('[Inventory Alerts Error]', err);
    res.status(500).json({ message: 'خطأ في جلب التنبيهات' });
  }
};
