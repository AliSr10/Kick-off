function requireAuth(req, res, next) {
  if (req.session?.authenticated === true) return next();
  res.status(401).json({ error: 'Please sign in to the staff dashboard.', authenticated: false });
}
function requireUser(req, res, next) {
  if (req.isAuthenticated?.() && req.user?.id) return next();
  res.status(401).json({ error: 'Please sign in to view your account.' });
}
module.exports = { requireAuth, requireUser };
