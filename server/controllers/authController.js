const checkSession = (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
};

const login = (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.authenticated = true;
    req.session.user = username;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid operator credentials.' });
  }
};

const logout = (req, res) => {
  req.session.destroy();
  res.json({ success: true });
};

module.exports = { checkSession, login, logout };