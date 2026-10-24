const { safeEqual } = require('../lib/booking');
const { csrfToken } = require('../middleware/csrf');
function createAuthController(config) {
  return {
    checkSession(req, res) { res.json({ authenticated: req.session?.authenticated === true, user: req.session?.user || null }); },
    login(req, res, next) {
      const { username, password } = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string' || !config.adminUser || !config.adminPass ||
          !safeEqual(username, config.adminUser) || !safeEqual(password, config.adminPass)) {
        return res.status(401).json({ error: 'Invalid staff credentials.' });
      }
      const customerSession = req.session.passport;
      req.session.regenerate(error => {
        if (error) return next(error);
        if (customerSession) req.session.passport = customerSession;
        req.session.authenticated = true;
        req.session.user = config.adminUser;
        const token = csrfToken(req);
        req.session.save(saveError => saveError ? next(saveError) : res.json({ success: true, csrfToken: token }));
      });
    },
    logout(req, res, next) {
      req.session.destroy(error => {
        if (error) return next(error);
        res.clearCookie('kickoff.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: config.production });
        res.json({ success: true });
      });
    }
  };
}
module.exports = { createAuthController };
