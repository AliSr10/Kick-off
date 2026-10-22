const crypto = require('node:crypto');
const { bookingInput, standingInput, dayOfWeek, slotValue, futureSlot, venueNow, HttpError, idValue, numericId } = require('../lib/booking');
const CALENDAR_LOCK = 728346201;
function createBookings(db, { now = () => new Date() } = {}) {
  async function locked(work) {
    return db.transaction(async client => {
      // Every calendar write takes the same transaction-scoped lock. No session-level locks,
      // so this also works through Neon's transaction pooler.
      await client.query('SELECT pg_advisory_xact_lock($1)', [CALENDAR_LOCK]);
      return work(client);
    });
  }
  async function audit(client, actor, action, id) {
    await client.query('INSERT INTO audit_log (actor, action, entity_id) VALUES ($1, $2, $3)', [actor, action, String(id)]);
  }
  async function assertFree(client, date, time, exclude = '') {
    const conflicts = await client.query(`SELECT id FROM reservations
      WHERE date = $1 AND time = $2 AND status = 'CONFIRMED' AND id <> $3 LIMIT 1`, [date, time, exclude]);
    if (conflicts.rows.length) throw new HttpError(409, 'This slot has already been confirmed for another team. Choose another kickoff time.');
    const fixed = await client.query('SELECT id FROM standing_bookings WHERE day_of_week = $1 AND time = $2 LIMIT 1', [dayOfWeek(date), time]);
    if (fixed.rows.length) throw new HttpError(409, 'This kickoff time belongs to a recurring booking.');
  }
  async function create(body, { userId = null, staff = null } = {}) {
    const input = bookingInput(body, { publicBooking: !staff, now: now() });
    return locked(async client => {
      await assertFree(client, input.date, input.time);
      let id, result;
      const status = staff ? 'CONFIRMED' : 'PENDING';
      for (let attempt = 0; attempt < 5; attempt++) {
        // The original short display reference is not an access credential.
        // Signed links and account ownership provide authorization.
        id = `RES-${crypto.randomInt(36 ** 6).toString(36).padStart(6, '0').toUpperCase()}`;
        result = await client.query(`INSERT INTO reservations
        (id, name, phone, date, time, end_time, notes, status, user_id, starts_at, ends_at)
        VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9,
          (($4::date + $10::time) AT TIME ZONE 'Asia/Beirut'),
          (($4::date + $11::time) AT TIME ZONE 'Asia/Beirut'))
        ON CONFLICT (id) DO NOTHING
        RETURNING id, name, phone, date::text, time, status`,
      [id, input.name, input.phone, input.date, input.time, input.time.split(' - ')[1], input.notes, status, userId, input.slot.start, input.slot.end]);
        if (result.rows.length) break;
      }
      if (!result.rows.length) throw new HttpError(503, 'Could not create a booking reference. Please try again.');
      await audit(client, staff ? `staff:${staff}` : (userId ? `user:${userId}` : 'guest'), `booking.${status.toLowerCase()}`, id);
      return result.rows[0];
    });
  }
  async function confirm(value, staff) {
    const id = idValue(value);
    return locked(async client => {
      const found = await client.query('SELECT id, name, phone, date::text, time, status, notes, user_id, starts_at, ends_at FROM reservations WHERE id = $1 FOR UPDATE', [id]);
      const booking = found.rows[0];
      if (!booking) throw new HttpError(404, 'Reservation not found.');
      if (booking.status === 'CANCELLED') throw new HttpError(409, 'A cancelled request cannot be confirmed. Create a new booking.');
      futureSlot(booking.date, slotValue(booking.time), { now: now() });
      await assertFree(client, booking.date, booking.time, id);
      await client.query("UPDATE reservations SET status = 'CONFIRMED' WHERE id = $1", [id]);
      await audit(client, `staff:${staff}`, 'booking.confirmed', id);
      return { ...booking, status: 'CONFIRMED' };
    });
  }
  async function cancel(value, staff) {
    const id = idValue(value);
    return locked(async client => {
      const result = await client.query("UPDATE reservations SET status = 'CANCELLED' WHERE id = $1 RETURNING id", [id]);
      if (!result.rows.length) throw new HttpError(404, 'Reservation not found.');
      await audit(client, `staff:${staff}`, 'booking.cancelled', id);
    });
  }
  async function standing(body, staff, value = null) {
    const input = standingInput(body);
    const id = value === null ? null : numericId(value);
    return locked(async client => {
      if (id !== null) {
        const result = await client.query('SELECT id FROM standing_bookings WHERE id = $1 FOR UPDATE', [id]);
        if (!result.rows.length) throw new HttpError(404, 'Recurring booking not found.');
      }
      const duplicate = await client.query('SELECT id FROM standing_bookings WHERE day_of_week = $1 AND time = $2 AND ($3::integer IS NULL OR id <> $3) LIMIT 1', [input.day, input.slot.label, id]);
      if (duplicate.rows.length) throw new HttpError(409, 'This weekly slot is already assigned.');
      const conflict = await client.query(`SELECT id FROM reservations WHERE status = 'CONFIRMED'
        AND date >= $1::date AND EXTRACT(DOW FROM date) = $2 AND time = $3 LIMIT 1`, [venueNow(now()).date, input.day, input.slot.label]);
      if (conflict.rows.length) throw new HttpError(409, 'This recurring slot would overlap an existing confirmed booking. Resolve that booking first.');
      const result = id === null
        ? await client.query('INSERT INTO standing_bookings (player_name, phone, day_of_week, time) VALUES ($1, $2, $3, $4) RETURNING id', [input.name, input.phone, input.day, input.slot.label])
        : await client.query('UPDATE standing_bookings SET player_name = $1, phone = $2, day_of_week = $3, time = $4 WHERE id = $5 RETURNING id', [input.name, input.phone, input.day, input.slot.label, id]);
      await audit(client, `staff:${staff}`, id === null ? 'standing.created' : 'standing.updated', result.rows[0].id);
      return result.rows[0];
    });
  }
  async function removeStanding(value, staff) {
    const id = numericId(value);
    return locked(async client => {
      const result = await client.query('DELETE FROM standing_bookings WHERE id = $1 RETURNING id', [id]);
      if (!result.rows.length) throw new HttpError(404, 'Recurring booking not found.');
      await audit(client, `staff:${staff}`, 'standing.deleted', id);
    });
  }
  async function clearCancelled(staff) {
    return locked(async client => {
      const result = await client.query("DELETE FROM reservations WHERE status = 'CANCELLED'");
      await audit(client, `staff:${staff}`, 'booking.cancelled_history_cleared', result.rowCount || 0);
      return result.rowCount || 0;
    });
  }
  return { create, confirm, cancel, standing, removeStanding, clearCancelled };
}
module.exports = { createBookings, CALENDAR_LOCK };
