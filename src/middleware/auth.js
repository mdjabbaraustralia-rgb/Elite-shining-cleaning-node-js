function requireGuest(req, res, next) {
  if (req.session.admin) return res.redirect('/admin');
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

module.exports = { requireGuest, requireAuth };
