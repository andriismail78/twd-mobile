const db = require('../utils/db');

class Order {
  static create({ ownerId, kasirId, kasirName, items, subtotal, diskon, total, bayar, kembalian, metodeBayar, type, status }) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO orders (ownerId, kasirId, kasirName, items, subtotal, diskon, total, bayar, kembalian, metodeBayar, type, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      const itemsJson = JSON.stringify(items);
      db.run(sql, [ownerId, kasirId, kasirName, itemsJson, subtotal, diskon, total, bayar, kembalian, metodeBayar, type, status || 'selesai'], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, ownerId, kasirId, kasirName, items, subtotal, diskon, total, bayar, kembalian, metodeBayar, type, status });
      });
    });
  }

  static findByOwnerId(ownerId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM orders WHERE ownerId = ? ORDER BY createdAt DESC LIMIT ?';
      db.all(sql, [ownerId, limit], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          ...row,
          items: JSON.parse(row.items)
        })));
      });
    });
  }

  static findTodayByOwnerId(ownerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM orders
        WHERE ownerId = ? AND date(createdAt) = date('now')
        ORDER BY createdAt DESC
      `;
      db.all(sql, [ownerId], (err, rows) => {
        if (err) return reject(err);
        return rows.map(row => ({
          ...row,
          items: JSON.parse(row.items)
        }));
      });
    });
  }

  static getSummary() {
    return new Promise((resolve, reject) => {
      const sql = "SELECT COALESCE(SUM(total), 0) as total_omzet, COUNT(*) as total_orders FROM orders WHERE status = 'selesai'";
      db.get(sql, [], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
}

module.exports = Order;