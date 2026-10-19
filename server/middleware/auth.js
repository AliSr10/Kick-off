const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized facility access.', authenticated: false });
};

module.exports = { requireAuth };