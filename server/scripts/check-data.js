const { ALL_SLOTS, venueNow } = require('../lib/booking');
async function checkData(db) {
  const issues = [];
  const tables = await db.query("SELECT to_regclass('public.reservations') AS reservations, to_regclass('public.standing_bookings') AS standing");
  if (tables.rows[0].reservations) {
    const duplicates = await db.query("SELECT date::text, time, array_agg(id) AS ids FROM reservations WHERE status = 'CONFIRMED' GROUP BY date, time HAVING COUNT(*) > 1");
    for (const row of duplicates.rows) issues.push({ issue: 'Multiple confirmed reservations share a slot', ...row });
    const invalid = await db.query("SELECT id, date::text, time, status FROM reservations WHERE status IS NULL OR status NOT IN ('PENDING', 'CONFIRMED', 'CANCELLED') OR (status <> 'CANCELLED' AND NOT (time = ANY($1::text[])))", [ALL_SLOTS]);
    for (const row of invalid.rows) issues.push({ issue: 'Invalid active booking slot or status', ...row });
  }
  if (tables.rows[0].standing) {
    const weekly = await db.query('SELECT day_of_week, time, array_agg(id) AS ids FROM standing_bookings GROUP BY day_of_week, time HAVING COUNT(*) > 1');
    for (const row of weekly.rows) issues.push({ issue: 'Duplicate weekly booking', ...row });
    const invalid = await db.query('SELECT id, day_of_week, time FROM standing_bookings WHERE day_of_week NOT BETWEEN 0 AND 6 OR NOT (time = ANY($1::text[]))', [ALL_SLOTS]);
    for (const row of invalid.rows) issues.push({ issue: 'Invalid weekly day or slot', ...row });
  }
  if (tables.rows[0].reservations && tables.rows[0].standing) {
    const overlap = await db.query(`SELECT r.id, r.date::text, r.time, s.id AS standing_id FROM reservations r JOIN standing_bookings s
      ON s.day_of_week = EXTRACT(DOW FROM r.date) AND s.time = r.time
      WHERE r.status = 'CONFIRMED' AND r.date >= $1::date`, [venueNow().date]);
    for (const row of overlap.rows) issues.push({ issue: 'Confirmed reservation overlaps a recurring slot', ...row });
  }
  return issues;
}
async function main() {
  const { createDatabase } = require('../config/db');
  const db = createDatabase();
  try { const issues = await checkData(db); console.log(JSON.stringify({ ready: issues.length === 0, issues }, null, 2)); if (issues.length) process.exitCode = 1; }
  finally { await db.close(); }
}
if (require.main === module) main().catch(error => { console.error('Database check failed:', error.code || error.message); process.exitCode = 1; });
module.exports = { checkData };
