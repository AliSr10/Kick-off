const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { createPassport } = require('./config/passport');
const { createAuthController } = require('./controllers/authController');
const { createBookings } = require('./services/bookings');
const { createTickets } = require('./lib/tickets');
const { csrfToken, csrfProtection } = require('./middleware/csrf');
const { createApiRoutes } = require('./routes/api');
const { createAuthRoutes, publicUser } = require('./routes/auth');
const { createAdminRoutes } = require('./routes/admin');
function createApp({ config, db, sessionStore, now }) {
  const app = express();
  const publicDir = path.join(__dirname, '../client/public');
  const passport = createPassport(db, config);
  const PgStore = require('connect-pg-simple')(session);
  const store = sessionStore || new PgStore({ pool: db.pool, tableName: 'session', createTableIfMissing: false, pruneSessionInterval: 900 });
  const tickets = createTickets(config.ticketSecret);
  const bookings = createBookings(db, { now });
  const auth = createAuthController(config);
  function limiter(limit, windowMs, message) { return rateLimit({ limit, windowMs, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message } }); }
  const apiLimiter = limiter(180, 60000, 'Too many requests. Please wait a minute and try again.');
  const loginLimiter = limiter(10, 15 * 60 * 1000, 'Too many sign-in attempts. Please try again in 15 minutes.');
  const bookingLimiter = limiter(8, 15 * 60 * 1000, 'Too many booking requests. Please contact the facility or try again later.');
  app.disable('x-powered-by');
  app.set('trust proxy', config.production ? 1 : false);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
    frameSrc: ['https://www.google.com', 'https://maps.google.com'], connectSrc: ["'self'"],
    objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
    upgradeInsecureRequests: config.production ? [] : null
  } }, referrerPolicy: { policy: 'no-referrer' }, strictTransportSecurity: config.production ? { maxAge: 31536000, includeSubDomains: true } : false }));
  app.use((req, res, next) => { req.requestId = crypto.randomUUID(); res.set('X-Request-Id', req.requestId); next(); });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/healthz', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await db.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.use(session({ name: 'kickoff.sid', secret: config.sessionSecret, store, resave: false, saveUninitialized: false,
    cookie: { maxAge: 86400000, httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' } }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use('/api', apiLimiter, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/session', limiter(120, 60000, 'Please wait a moment and refresh.'), (req, res) => {
    res.json({ csrfToken: csrfToken(req), loggedIn: Boolean(req.isAuthenticated?.()),
      user: req.isAuthenticated?.() ? publicUser(req.user) : null,
      settings: { timeZone: 'Asia/Beirut', bookingDays: 14, businessWhatsApp: config.businessWhatsApp } });
  });
  app.use('/api', csrfProtection(config));
  app.use('/api/auth', createAuthRoutes({ db, passport, tickets, logout: auth.logout }));
  app.use('/api/admin', createAdminRoutes({ db, bookings, tickets, auth, loginLimiter }));
  app.use('/api', createApiRoutes({ db, bookings, tickets, config, bookingLimiter }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.get('/admin/dashboard.html', (req, res, next) => req.session?.authenticated ? next() : res.redirect('/admin/'));
  app.use(express.static(publicDir, { maxAge: '1h', setHeaders(res, file) {
    if (file.endsWith('.html')) res.set('Cache-Control', 'no-store');
  } }));
  app.use((_req, res) => res.status(404).type('text/plain').send('Page not found. Return to the Kickoff homepage.'));
  app.use((error, req, res, _next) => {
    const status = error.code === '23505' ? 409 : error.status || 500;
    if (status >= 500 && process.env.NODE_ENV !== 'test') console.error('request_failed', { requestId: req.requestId, code: error.code || 'UNKNOWN' });
    const message = error.code === '23505' ? 'This slot has changed. Refresh the schedule and choose another time.'
      : status < 500 ? error.message : 'We could not complete that request. Please try again.';
    res.status(status).json({ error: message, requestId: req.requestId });
  });
  app.locals.sessionStore = store;
  app.locals.rateLimiters = { apiLimiter, loginLimiter, bookingLimiter };
  return app;
}
module.exports = { createApp };
