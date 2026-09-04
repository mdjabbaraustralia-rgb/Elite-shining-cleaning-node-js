const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');

const settings = require('./lib/settings');
const { STORAGE_DIR } = require('./lib/uploads');

// Last-resort safety net: log and keep running instead of taking the whole
// site down. Route-level validation/try-catch should prevent these, but this
// guarantees one bad request never crashes the server for every visitor.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept running):', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection (server kept running):', err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Served explicitly (not just via express.static(PUBLIC_DIR)) because
// STORAGE_DIR can be pointed at a persistent volume outside PUBLIC_DIR.
app.use('/storage', express.static(STORAGE_DIR));
app.use(express.static(PUBLIC_DIR));

app.use(session({
  secret: process.env.SESSION_SECRET || 'elite-shining-cleaning-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
}));
app.use(flash());

// ---- view helpers available in every EJS template ----
app.use((req, res, next) => {
  res.locals.setting = (key, fallback = null) => settings.get(key, fallback);
  res.locals.asset = (p) => '/' + String(p).replace(/^\/+/, '');
  res.locals.currentPath = req.path;
  res.locals.fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  res.locals.assetVersion = Math.floor(Date.now() / 1000);
  res.locals.admin = req.session.admin || null;
  res.locals.success = req.flash('success')[0] || null;
  res.locals.errors = req.flash('errors')[0] || {};
  const oldInput = req.flash('old')[0] || {};
  res.locals.old = oldInput;
  res.locals.oldOr = (field, fallback) => (Object.prototype.hasOwnProperty.call(oldInput, field) ? oldInput[field] : fallback);
  res.locals.formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  res.locals.timeAgo = (dateStr) => {
    if (!dateStr) return '';
    let normalized = dateStr;
    if (!/[T ]\d{2}:\d{2}/.test(normalized)) normalized += ' 00:00:00';
    normalized = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
    if (!/Z|[+-]\d{2}:?\d{2}$/.test(normalized)) normalized += 'Z';
    const seconds = Math.floor((Date.now() - new Date(normalized).getTime()) / 1000);
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, secs] of units) {
      const v = Math.floor(seconds / secs);
      if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  };
  next();
});

app.use('/', require('./routes/public'));
app.use('/', require('./routes/booking'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).send('<h1>404 — Page not found</h1><a href="/">Go home</a>');
});

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('<h1>500 — Something went wrong</h1><pre>' + (process.env.NODE_ENV !== 'production' ? err.stack : '') + '</pre>');
});

app.listen(PORT, () => {
  console.log(`Elite Shining Cleaning (Node) running on http://127.0.0.1:${PORT}`);
});
