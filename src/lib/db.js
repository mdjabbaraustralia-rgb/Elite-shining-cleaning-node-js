const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Allow the database file to live outside the deployed code directory (e.g. a
// persistent volume on the host), so a redeploy that replaces the app's code
// never wipes real booking/settings data. Falls back to the in-repo path for
// local development.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

module.exports = db;
