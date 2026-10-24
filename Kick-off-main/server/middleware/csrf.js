const crypto = require('node:crypto');
const { safeEqual } = require('../lib/booking');
function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  return req.session.csrfToken;
}
function csrfProtection(config) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    const localOrigin = !config.production ? `${req.protocol}://${req.get('host')}` : null;
    if (origin && origin !== config.origin && origin !== localOrigin) return res.status(403).json({ error: 'This request must come from the Kickoff website.' });
    const provided = req.get('x-csrf-token');
    if (!req.session.csrfToken || typeof provided !== 'string' || provided.length > 100 || !safeEqual(provided, req.session.csrfToken)) {
      return res.status(403).json({ error: 'Your session changed. Refresh the page and try again.', code: 'CSRF_INVALID' });
    }
    next();
  };
}
module.exports = { csrfToken, csrfProtection };
