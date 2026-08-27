const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'data', 'app.sqlite'));
db.pragma('journal_mode = WAL');

module.exports = db;
