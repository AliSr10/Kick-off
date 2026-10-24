// Visual preview stays separate from the production application and its credentials.
function createPreviewApp() {
  const express = require('express');
  const path = require('node:path');
  const { SLOTS, venueNow, addDays } = require('./lib/booking');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/session', (req, res) => res.json({
    preview: true, user: null, csrfToken: 'local-visual-preview',
    settings: { bookingDays: 14, businessWhatsApp: '9613696325' }
  }));
  app.get('/api/auth/me', (req, res) => res.json({ loggedIn: false, preview: true }));
  app.get('/api/availability', (req, res) => res.json({
    preview: true, date: req.query.date || venueNow().date, timeZone: 'Asia/Beirut',
    schedule: SLOTS.map(slot => ({ time: slot.label, start: slot.start, end: slot.end,
      available: true, reason: null, isPopular: ['19:30', '21:00'].includes(slot.start) }))
  }));
  app.get('/api/admin/check-session', (req, res) => res.json({ authenticated: true, user: 'LOCAL PREVIEW', preview: true }));
  app.get('/api/admin/dashboard-stats', (req, res) => res.json({ todayMatches: 0, pending: 0, upcoming: 0, cancelled: 0 }));
  app.get('/api/admin/reservations', (req, res) => res.json({ reservations: [], pagination: {
    page: 1, pageSize: 50, total: 0, totalPages: 1, hasNext: false, hasPrevious: false
  } }));
  app.get('/api/admin/standing-bookings', (req, res) => res.json({ standingBookings: [] }));
  app.get('/api/admin/analytics', (req, res) => {
    const today = venueNow().date;
    res.json({ analytics: [], startDate: addDays(today, -29), endDate: today });
  });
  app.use('/api', (req, res) => res.status(503).json({
    error: 'Visual preview only. Booking, sign-in, and changes are disabled.'
  }));
  app.use(express.static(path.join(__dirname, '../client/public')));
  return app;
}
async function start() {
  if (process.argv.includes('--preview')) {
    if (process.env.NODE_ENV === 'production') throw new Error('Visual preview is unavailable in production.');
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port number.');
    // Bind to this computer only; preview never mounts production API routes.
    return createPreviewApp().listen(port, '127.0.0.1', () => {
      console.log(`Visual preview: http://localhost:${port}`);
      console.log('No database or Google credentials needed. Booking and sign-in are disabled.');
    });
  }
  const { loadConfig } = require('./config/env');
  const { createDatabase } = require('./config/db');
  const { createApp } = require('./app');
  const config = loadConfig();
  const db = createDatabase(config);
  await db.query('SELECT 1');
  const migrationTable = await db.query("SELECT to_regclass('schema_migrations') AS name");
  if (!migrationTable.rows[0].name) throw new Error('Database migration is missing. Run npm run db:check, then npm run db:migrate before starting.');
  const schema = await db.query("SELECT version FROM schema_migrations WHERE version = '001_security_and_bookings'");
  if (!schema.rows.length) throw new Error('Run npm run db:migrate before starting this version.');
  const app = createApp({ config, db });
  const server = app.listen(config.port, () => console.log(`Kickoff listening on port ${config.port}`));
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 15000).unref();
    server.close(async () => { clearTimeout(timeout); await db.close(); process.exit(0); });
    server.closeIdleConnections();
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
if (require.main === module) start().catch(error => { console.error('Startup failed:', error.code || error.message); process.exit(1); });
module.exports = { start, createPreviewApp };
