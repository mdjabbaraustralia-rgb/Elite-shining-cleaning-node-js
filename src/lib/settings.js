const db = require('./db');

function getAll() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function get(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row || row.value === null || row.value === undefined) return fallback;
  return row.value;
}

function set(key, value) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM settings WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(value, now, key);
  } else {
    db.prepare('INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)').run(key, value, now, now);
  }
}

module.exports = { get, set, getAll };
