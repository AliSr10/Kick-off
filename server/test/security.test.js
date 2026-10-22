const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const session = require('express-session');
const signature = require('cookie-signature');
const { createApp } = require('../app');
const { loadConfig } = require('../config/env');
const { createBookings } = require('../services/bookings');
const { createTickets } = require('../lib/tickets');
const { migrate } = require('../scripts/migrate');
const { SLOTS, venueNow, addDays, dayOfWeek } = require('../lib/booking');
process.env.NODE_ENV = 'test';
const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 'test-session-secret-at-least-32-characters', ADMIN_USER: 'test-staff', ADMIN_PASS: 'test-password-long-enough', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-google-secret', GOOGLE_CALLBACK_URL: 'http://localhost/api/auth/google/callback', DATABASE_URL: 'postgres://localhost/test', PORT: '0' });
function adapt(native) {
  const wrap = client => ({
    async query(sql, values = []) {
      let result;
      if (!values.length && sql.includes(';')) { const results = await client.exec(sql); result = results.at(-1) || { rows: [] }; }
      else result = await client.query(sql, values);
      return { ...result, rowCount: result.affectedRows ?? result.rows?.length ?? 0 };
    }
  });
  return { ...wrap(native), transaction: work => native.transaction(client => work(wrap(client))), close: () => native.close() };
}
let native, db, server, origin, store, services, app;
function client(cookie = '') {
  let csrf;
  return {
    get cookie() { return cookie; },
    async request(url, options = {}) {
      const headers = { ...(cookie ? { Cookie: cookie } : {}), ...(csrf && options.csrf !== false ? { 'X-CSRF-Token': csrf } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
      const response = await fetch(origin + url, { method: options.method || 'GET', redirect: 'manual', headers, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
      const set = response.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await response.json() : await response.text();
      if (body.csrfToken) csrf = body.csrfToken;
      return { status: response.status, body, headers: response.headers };
    },
    async bootstrap() { return this.request('/api/session'); }
  };
}
const date = () => addDays(venueNow().date, 2);
const booking = (extra = {}) => ({ name: 'Test Player', phone: '03 696 325', date: date(), time: SLOTS[2].label, ...extra });
async function staff() { const value = client(); await value.bootstrap(); const response = await value.request('/api/admin/login', { method: 'POST', body: { username: config.adminUser, password: config.adminPass } }); assert.equal(response.status, 200); return value; }
async function customer(id) {
  const sid = `test-customer-${id}`;
  await new Promise((resolve, reject) => store.set(sid, { cookie: { maxAge: 86400000, expires: new Date(Date.now() + 86400000), httpOnly: true, path: '/', sameSite: 'lax' }, passport: { user: id } }, error => error ? reject(error) : resolve()));
  const value = client(`kickoff.sid=${encodeURIComponent(`s:${signature.sign(sid, config.sessionSecret)}`)}`); await value.bootstrap(); return value;
}
before(async () => {
  native = new PGlite(); db = adapt(native); await migrate(db); store = new session.MemoryStore();
  services = createBookings(db);
  app = createApp({ config, db, sessionStore: store });
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } if (db) await db.close(); });
beforeEach(async () => { app.locals.rateLimiters.apiLimiter.resetKey('127.0.0.1'); app.locals.rateLimiters.loginLimiter.resetKey('127.0.0.1'); app.locals.rateLimiters.bookingLimiter.resetKey('127.0.0.1'); await db.query('TRUNCATE reservations, standing_bookings, users, audit_log RESTART IDENTITY CASCADE'); await new Promise(resolve => store.clear(resolve)); });

test('configuration fails closed when credentials are absent or short', () => {
  assert.throws(() => loadConfig({}), /Missing required/);
  assert.throws(() => loadConfig({ DATABASE_URL: 'postgres://localhost/test', SESSION_SECRET: 'short', ADMIN_USER: 'x', ADMIN_PASS: 'long-enough-password', GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', GOOGLE_CALLBACK_URL: 'http://localhost/callback' }), /32/);
});
test('sessions, strict CSP, cache rules and JSON API 404s', async () => {
  const guest = client(), init = await guest.bootstrap(); assert.equal(init.status, 200); assert(init.body.csrfToken); assert.match(init.headers.get('set-cookie'), /HttpOnly/); assert.match(init.headers.get('set-cookie'), /SameSite=Lax/);
  const asset = await guest.request('/app.js'); assert.match(asset.headers.get('cache-control'), /max-age=3600/); assert.match(asset.headers.get('content-security-policy'), /script-src 'self'/); assert.doesNotMatch(asset.headers.get('content-security-policy'), /script-src 'self' 'unsafe-inline'/);
  assert.equal((await guest.request('/api/unknown-route')).status, 404);
  const locked = await guest.request('/admin/dashboard.html'); assert.equal(locked.status, 302);
});
test('CSRF protection rejects missing tokens and foreign origins', async () => {
  const guest = client(); await guest.bootstrap();
  assert.equal((await guest.request('/api/reservations', { method: 'POST', body: booking(), csrf: false })).status, 403);
  assert.equal((await guest.request('/api/reservations', { method: 'POST', body: booking(), headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM reservations')).rows[0].count, 0);
});
test('server rejects past dates, invalid slots, missing phones and dates outside the public window', async () => {
  const guest = client(); await guest.bootstrap();
  for (const extra of [{ phone: '' }, { date: '2020-01-01' }, { date: '2026-02-30' }, { time: 'arbitrary' }, { date: addDays(venueNow().date, 14) }, { name: [] }]) {
    const response = await guest.request('/api/reservations', { method: 'POST', body: booking(extra) }); assert.equal(response.status, 400, JSON.stringify(response.body));
  }
});
test('two pending requests can exist but only one can be confirmed; manual and recurring paths reject conflicts', async () => {
  const guest = client(); await guest.bootstrap();
  const a = await guest.request('/api/reservations', { method: 'POST', body: booking() }), b = await guest.request('/api/reservations', { method: 'POST', body: booking({ name: 'Second Team' }) });
  assert.equal(a.status, 201); assert.equal(b.status, 201); assert.equal(a.body.reservation.status, 'PENDING'); assert.equal(a.body.reservation.phone, '+9613696325');
  const admin = await staff();
  const results = await Promise.all([a, b].map(item => admin.request(`/api/admin/reservations/${item.body.reservation.id}/confirm`, { method: 'PATCH' })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await admin.request('/api/admin/reservations', { method: 'POST', body: booking() })).status, 409);
  assert.equal((await admin.request('/api/admin/standing-bookings', { method: 'POST', body: { playerName: 'Weekly team', phone: '+9613696325', dayOfWeek: dayOfWeek(date()), time: SLOTS[2].label } })).status, 409);
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'CONFIRMED'")).rows[0].count, 1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM audit_log')).rows[0].count, 3);
});
test('PostgreSQL unique index rejects direct duplicate confirmed inserts', async () => {
  await services.create(booking(), { staff: 'test-staff' });
  await assert.rejects(db.query("INSERT INTO reservations(id,name,phone,date,time,end_time,status) VALUES('duplicate','Other','+9613696325',$1,$2,'7:30 PM','CONFIRMED')", [date(), SLOTS[2].label]), error => error.code === '23505');
});
test('original short references retry collisions without overwriting an existing booking', async context => {
  const crypto = require('node:crypto');
  const values = [1, 1, 2];
  context.mock.method(crypto, 'randomInt', () => values.length ? values.shift() : 1);
  const first = await services.create(booking({ name: 'First Team' }));
  const second = await services.create(booking({ name: 'Second Team' }));
  assert.equal(first.id, 'RES-000001');
  assert.equal(second.id, 'RES-000002');
  await assert.rejects(services.create(booking({ name: 'Exhausted retries' })), error => error.status === 503);
  const saved = await db.query('SELECT id, name FROM reservations ORDER BY id');
  assert.deepEqual(saved.rows, [{ id: first.id, name: 'First Team' }, { id: second.id, name: 'Second Team' }]);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM audit_log')).rows[0].count, 2);
});
test('recurring slots block public and manual reservations; duplicate/edit/delete checks work', async () => {
  const admin = await staff(), payload = { playerName: 'Weekly Team', phone: '03696325', dayOfWeek: dayOfWeek(date()), time: SLOTS[1].label };
  const weekly = await admin.request('/api/admin/standing-bookings', { method: 'POST', body: payload }); assert.equal(weekly.status, 201);
  assert.equal((await admin.request('/api/admin/standing-bookings', { method: 'POST', body: payload })).status, 409);
  assert.equal((await admin.request(`/api/admin/standing-bookings/${weekly.body.id}`, { method: 'PUT', body: { ...payload, playerName: 'Updated Team' } })).status, 200);
  const guest = client(); await guest.bootstrap();
  assert.equal((await guest.request('/api/reservations', { method: 'POST', body: booking({ time: SLOTS[1].label }) })).status, 409);
  assert.equal((await admin.request('/api/admin/reservations', { method: 'POST', body: booking({ time: SLOTS[1].label }) })).status, 409);
  assert.equal((await admin.request(`/api/admin/standing-bookings/${weekly.body.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await guest.request('/api/reservations', { method: 'POST', body: booking({ time: SLOTS[1].label }) })).status, 201);
});
test('profile phone changes never expose another customer’s reservations or notes', async () => {
  const a = (await db.query("INSERT INTO users(google_id,email,name,phone) VALUES('a','a@example.invalid','Alice','+9613696325') RETURNING id")).rows[0].id;
  const b = (await db.query("INSERT INTO users(google_id,email,name,phone) VALUES('b','b@example.invalid','Bob','+96171234567') RETURNING id")).rows[0].id;
  const own = await services.create(booking(), { userId: a });
  await services.create(booking({ name: 'Bob', phone: '+96171234567', notes: 'Private note' }), { userId: b });
  const alice = await customer(a);
  assert.equal((await alice.request('/api/auth/me', { method: 'PUT', body: { name: 'Alice', phone: '+96171234567' } })).status, 200);
  const history = await alice.request('/api/auth/my-reservations'); assert.equal(history.status, 200); assert.deepEqual(history.body.reservations.map(item => item.id), [own.id]);
  assert(!('notes' in history.body.reservations[0])); assert(!('phone' in history.body.reservations[0]));
});
test('signed passes show live status, reject forged tokens, and omit private contact details', async () => {
  const guest = client(); await guest.bootstrap(); const response = await guest.request('/api/reservations', { method: 'POST', body: booking({ notes: 'Private note' }) });
  const id = response.body.reservation.id, token = createTickets(config.ticketSecret).token(id), path = `/api/tickets/${token}`;
  const pending = await guest.request(path); assert.equal(pending.body.reservation.status, 'PENDING'); assert(!('phone' in pending.body.reservation)); assert(!('notes' in pending.body.reservation));
  const forged = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'); assert.equal((await guest.request(`/api/tickets/${forged}`)).status, 404);
  const admin = await staff(); await admin.request(`/api/admin/reservations/${id}/confirm`, { method: 'PATCH' }); assert.equal((await guest.request(path)).body.reservation.status, 'CONFIRMED');
  await admin.request(`/api/admin/reservations/${id}/cancel`, { method: 'PATCH' }); assert.equal((await guest.request(path)).body.reservation.status, 'CANCELLED');
  assert.equal((await admin.request(`/api/admin/reservations/${id}/confirm`, { method: 'PATCH' })).status, 409);
  const qr = await guest.request(`${path}/qr.svg`); assert.equal(qr.status, 200); assert.match(qr.headers.get('content-type'), /image\/svg\+xml/);
});
test('admin login rotates sessions, rejects empty logins, and OAuth includes state', async () => {
  const value = client(); await value.bootstrap(); const beforeCookie = value.cookie;
  assert.equal((await value.request('/api/admin/login', { method: 'POST', body: {} })).status, 401);
  assert.equal((await value.request('/api/admin/login', { method: 'POST', body: { username: config.adminUser, password: config.adminPass } })).status, 200); assert.notEqual(value.cookie, beforeCookie);
  const oauth = await value.request('/api/auth/google'); assert.equal(oauth.status, 302); assert(new URL(oauth.headers.get('location')).searchParams.get('state'));
});
test('admin pagination, exact date filtering, search escaping, cancellation 404 and analytics work', async () => {
  await db.query(`INSERT INTO reservations (id,name,phone,date,time,end_time,status) SELECT 'row-'||n, 'Team '||n, '+9613696325', $1::date, $2, '7:30 PM', 'PENDING' FROM generate_series(1,55) AS n`, [date(), SLOTS[2].label]);
  const admin = await staff(); const first = await admin.request('/api/admin/reservations'), second = await admin.request('/api/admin/reservations?page=2');
  assert.equal(first.body.reservations.length, 50); assert.equal(second.body.reservations.length, 5); assert.equal(first.body.pagination.total, 55);
  assert.equal((await admin.request('/api/admin/reservations?search='+encodeURIComponent("' OR 1=1 --"))).body.reservations.length, 0);
  assert.equal((await admin.request('/api/admin/reservations/unknown/cancel', { method: 'PATCH' })).status, 404);
  assert.equal((await admin.request('/api/admin/analytics')).status, 200);
  assert.equal((await admin.request('/api/admin/reservations?date=bad')).status, 400);
});
test('booking rate limit applies before additional writes', async () => {
  const guest = client(); await guest.bootstrap();
  const statuses = [];
  for (let i = 0; i < 9; i++) statuses.push((await guest.request('/api/reservations', { method: 'POST', body: booking() })).status);
  // The limiter is per-IP and earlier tests use the same local address; it must consistently reject excess writes.
  assert.equal(statuses.at(-1), 429);
});
test('migration upgrades legacy schema without dropping records and is idempotent', async () => {
  const native = new PGlite(), legacy = adapt(native);
  try {
    await native.exec(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8'));
    const fixtures = [
      { date: '2026-07-14', start: '2026-07-14T19:30:00.000Z', end: '2026-07-14T21:00:00.000Z' },
      // Beirut repeats its late-night hour in autumn and skips midnight in spring.
      // Preserve the advertised local-clock slot instead of assuming 90 elapsed minutes.
      { date: '2026-10-24', start: '2026-10-24T19:30:00.000Z', end: '2026-10-24T22:00:00.000Z' },
      { date: '2026-03-28', start: '2026-03-28T20:30:00.000Z', end: '2026-03-28T22:00:00.000Z' }
    ];
    for (const fixture of fixtures) {
      await legacy.query("INSERT INTO reservations(id,name,phone,date,time,end_time,status) VALUES($1,'Existing Player','03696325',$2,$3,'12:00 AM','CONFIRMED')", [`legacy-${fixture.date}`, fixture.date, SLOTS[5].label]);
    }
    assert.equal((await migrate(legacy)).applied, true);
    assert.equal((await legacy.query('SELECT COUNT(*)::int AS count FROM reservations')).rows[0].count, fixtures.length);
    for (const fixture of fixtures) {
      const result = (await legacy.query('SELECT phone, starts_at, ends_at FROM reservations WHERE id=$1', [`legacy-${fixture.date}`])).rows[0];
      assert.equal(result.phone, '03696325');
      assert.equal(new Date(result.starts_at).toISOString(), fixture.start);
      assert.equal(new Date(result.ends_at).toISOString(), fixture.end);
    }
    assert.equal((await migrate(legacy)).applied, false);
  } finally { await legacy.close(); }
});
test('migration stops atomically when legacy confirmed bookings conflict', async () => {
  const native = new PGlite(), legacy = adapt(native);
  try {
    await native.exec(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8'));
    await legacy.query("INSERT INTO reservations(id,name,phone,date,time,end_time,status) VALUES('one','One','03696325',$1,$2,'7:30 PM','CONFIRMED'),('two','Two','03696325',$1,$2,'7:30 PM','CONFIRMED')", [date(), SLOTS[2].label]);
    await assert.rejects(migrate(legacy), /Existing records need review/);
    assert.equal((await legacy.query('SELECT COUNT(*)::int AS count FROM reservations')).rows[0].count, 2);
    assert.equal((await legacy.query("SELECT to_regclass('schema_migrations') AS migration")).rows[0].migration, null);
  } finally { await legacy.close(); }
});

test('PostgreSQL sessions survive a session-store instance change', async () => {
  const PgStore = require('connect-pg-simple')(session);
  const first = new PgStore({ pool: db, tableName: 'session', createTableIfMissing: false, pruneSessionInterval: false });
  const value = { cookie: { expires: new Date(Date.now() + 3600000), maxAge: 3600000 }, marker: 'persisted-in-postgres' };
  await new Promise((resolve, reject) => first.set('persistent-session-test', value, error => error ? reject(error) : resolve()));
  await first.close();
  const second = new PgStore({ pool: db, tableName: 'session', createTableIfMissing: false, pruneSessionInterval: false });
  try { const loaded = await new Promise((resolve, reject) => second.get('persistent-session-test', (error, data) => error ? reject(error) : resolve(data))); assert.equal(loaded.marker, value.marker); }
  finally { await new Promise(resolve => second.destroy('persistent-session-test', resolve)); await second.close(); }
});
test('calendar dates use Beirut around midnight and empty JSON bodies receive validation errors', async () => {
  assert.equal(venueNow(new Date('2026-10-20T21:30:00Z')).date, '2026-10-21');
  const guest = client(); await guest.bootstrap();
  assert.equal((await guest.request('/api/reservations', { method: 'POST' })).status, 400);
});


test('empty staff login fails even with missing configured credentials', () => {
  const { createAuthController } = require('../controllers/authController');
  const controller = createAuthController({});
  let status;
  controller.login({ body: {}, session: {} }, { status(value) { status = value; return this; }, json(value) { assert.equal(status, 401); assert(value.error); } });
  assert.equal(status, 401);
});
test('configuration rejects example secrets and mismatched site/callback origins', () => {
  const env = { NODE_ENV: 'test', SESSION_SECRET: 'test-session-secret-at-least-32-characters', ADMIN_USER: 'staff', ADMIN_PASS: 'test-password-long-enough', GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_CALLBACK_URL: 'http://localhost/api/auth/google/callback', DATABASE_URL: 'postgres://localhost/test' };
  assert.throws(() => loadConfig({ ...env, SESSION_SECRET: 'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS' }), /example value/);
  assert.throws(() => loadConfig({ ...env, APP_URL: 'https://other.example' }), /same origin/);
});
test('general API throttling limits repeated availability reads', async () => {
  const guest = client();
  let last;
  for (let i = 0; i < 181; i++) last = await guest.request(`/api/availability?date=${date()}`);
  assert.equal(last.status, 429);
});
test('restricted runtime database role can operate the app but cannot delete audit records or alter tables', async () => {
  await db.query('CREATE ROLE kickoff_app NOLOGIN');
  try {
    await db.query(fs.readFileSync(path.join(__dirname, '../config/runtime-role.sql'), 'utf8'));
    await db.transaction(async client => {
      await client.query('SET LOCAL ROLE kickoff_app');
      const user = await client.query("INSERT INTO users(google_id,email,name) VALUES('runtime-role','runtime@example.invalid','Player') RETURNING id");
      assert(user.rows[0].id);
      await client.query("INSERT INTO reservations(id,name,phone,date,time,end_time,status) VALUES('role-booking','Player','+9613696325',$1,$2,'7:30 PM','PENDING')", [date(), SLOTS[2].label]);
      await client.query("INSERT INTO audit_log(actor,action,entity_id) VALUES('staff:test','test','role-booking')");
      await client.query('SELECT version FROM schema_migrations');
    });
    for (const sql of ['DELETE FROM audit_log', 'ALTER TABLE reservations ADD COLUMN forbidden TEXT']) {
      await assert.rejects(db.transaction(async client => { await client.query('SET LOCAL ROLE kickoff_app'); await client.query(sql); }), error => error.code === '42501');
    }
  } finally { await db.query('DROP OWNED BY kickoff_app'); await db.query('DROP ROLE kickoff_app'); }
});
