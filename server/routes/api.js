const express = require('express');
const QRCode = require('qrcode');
const { SLOTS, HttpError, venueNow, dateValue, dayOfWeek, addDays } = require('../lib/booking');
function createApiRoutes({ db, bookings, tickets, config, bookingLimiter }) {
  const router = express.Router();
  router.get('/availability', async (req, res) => {
    const date = dateValue(req.query.date);
    const current = venueNow();
    if ((!req.session?.authenticated && date < current.date) || date > addDays(current.date, 365)) throw new HttpError(400, 'Choose a date from today onwards.');
    const [regular, weekly] = await Promise.all([
      db.query("SELECT time FROM reservations WHERE date = $1 AND status = 'CONFIRMED'", [date]),
      db.query('SELECT time FROM standing_bookings WHERE day_of_week = $1', [dayOfWeek(date)])
    ]);
    const occupied = new Set([...regular.rows, ...weekly.rows].map(row => row.time));
    res.json({ date, timeZone: 'Asia/Beirut', schedule: SLOTS.map(slot => {
      const passed = date < current.date || (date === current.date && slot.start <= current.time);
      return { time: slot.label, start: slot.start, end: slot.end, available: !occupied.has(slot.label) && !passed,
        reason: passed ? 'PASSED' : occupied.has(slot.label) ? 'BOOKED' : null,
        isPopular: ['19:30', '21:00'].includes(slot.start) };
    }) });
  });
  router.post('/reservations', bookingLimiter, async (req, res) => {
    const reservation = await bookings.create(req.body, { userId: req.isAuthenticated?.() ? req.user.id : null });
    res.status(201).json({ reservation, ticket: { url: tickets.url(reservation.id), qrUrl: tickets.qrUrl(reservation.id) },
      message: 'Your request is pending. The slot is reserved only after staff confirms it.' });
  });
  async function readTicket(value) {
    const id = tickets.verify(value);
    const result = await db.query('SELECT id, name, date::text, time, status, starts_at, ends_at FROM reservations WHERE id = $1', [id]);
    if (!result.rows.length) throw new HttpError(404, 'This match pass is no longer available.');
    return { ...result.rows[0], venue: 'Kickoff Choueifat · Pitch 1', timeZone: 'Asia/Beirut' };
  }
  router.get('/tickets/:token/qr.svg', async (req, res) => {
    const reservation = await readTicket(req.params.token);
    const svg = await QRCode.toString(`${config.origin}${tickets.url(reservation.id)}`, { type: 'svg', margin: 2, width: 180, errorCorrectionLevel: 'M' });
    res.type('image/svg+xml').send(svg);
  });
  router.get('/tickets/:token', async (req, res) => res.json({ reservation: await readTicket(req.params.token) }));
  return router;
}
module.exports = { createApiRoutes };
