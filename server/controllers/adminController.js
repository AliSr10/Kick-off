const { ALL_SLOTS, HttpError, venueNow, dateValue, addDays, text } = require('../lib/booking');
function createAdminController(db, bookings, tickets) {
  return {
    async getDashboardStats(req, res) {
      const today = venueNow().date;
      const result = await db.query(`SELECT
        COUNT(*) FILTER (WHERE date = $1 AND status = 'CONFIRMED')::integer AS "todayMatches",
        COUNT(*) FILTER (WHERE status = 'PENDING' AND date >= $1)::integer AS pending,
        COUNT(*) FILTER (WHERE date >= $1 AND status = 'CONFIRMED')::integer AS upcoming,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::integer AS cancelled FROM reservations`, [today]);
      res.json(result.rows[0]);
    },
    async getReservations(req, res) {
      const search = text(req.query.search || '', 'Search', 100, false);
      const status = req.query.status || 'ALL';
      if (!['ALL', 'ARCHIVE', 'UPCOMING', 'PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) throw new HttpError(400, 'Unknown booking status.');
      const page = Number(req.query.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 1000000) throw new HttpError(400, 'Invalid page number.');
      const values = [], conditions = [];
      const param = value => { values.push(value); return `$${values.length}`; };
      if (search) { const term = param(`%${search}%`); conditions.push(`(name ILIKE ${term} OR phone ILIKE ${term} OR id ILIKE ${term})`); }
      if (status === 'ARCHIVE') conditions.push(`date < ${param(venueNow().date)}::date`);
      else if (status === 'UPCOMING') conditions.push(`date >= ${param(venueNow().date)}::date AND status = 'CONFIRMED'`);
      else if (status !== 'ALL') conditions.push(`status = ${param(status)}`);
      if (req.query.date) conditions.push(`date = ${param(dateValue(req.query.date))}::date`);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await db.query(`SELECT COUNT(*)::integer AS total FROM reservations ${where}`, values);
      const pageSize = 50, total = count.rows[0].total;
      const order = param(ALL_SLOTS), limit = param(pageSize), offset = param((page - 1) * pageSize);
      const result = await db.query(`SELECT id, name, phone, date::text, time, end_time, notes, status, user_id, starts_at, ends_at
        FROM reservations ${where} ORDER BY date DESC, array_position(${order}::text[], time), created_at DESC LIMIT ${limit} OFFSET ${offset}`, values);
      res.json({ reservations: result.rows.map(row => ({ ...row, ticketUrl: tickets.url(row.id) })),
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), hasNext: page * pageSize < total, hasPrevious: page > 1 } });
    },
    async createManualReservation(req, res) {
      const reservation = await bookings.create(req.body, { staff: req.session.user });
      res.status(201).json({ success: true, id: reservation.id, reservation, ticketUrl: tickets.url(reservation.id) });
    },
    async confirmReservation(req, res) { await bookings.confirm(req.params.id, req.session.user); res.json({ success: true }); },
    async cancelReservation(req, res) { await bookings.cancel(req.params.id, req.session.user); res.json({ success: true }); },
    async clearCancelled(req, res) { const count = await bookings.clearCancelled(req.session.user); res.json({ success: true, deleted: count }); },
    async getStandingBookings(req, res) {
      const result = await db.query('SELECT id, player_name AS "playerName", phone, day_of_week AS "dayOfWeek", time FROM standing_bookings ORDER BY day_of_week, array_position($1::text[], time)', [ALL_SLOTS]);
      res.json({ standingBookings: result.rows });
    },
    async createStandingBooking(req, res) { const result = await bookings.standing(req.body, req.session.user); res.status(201).json({ success: true, id: result.id }); },
    async updateStandingBooking(req, res) { await bookings.standing(req.body, req.session.user, req.params.id); res.json({ success: true }); },
    async deleteStandingBooking(req, res) { await bookings.removeStanding(req.params.id, req.session.user); res.json({ success: true }); },
    async getAnalytics(req, res) {
      const today = venueNow().date, start = addDays(today, -29);
      const result = await db.query(`SELECT date::text, COUNT(*)::integer AS count FROM reservations
        WHERE date BETWEEN $1::date AND $2::date AND status = 'CONFIRMED' GROUP BY date ORDER BY date`, [start, today]);
      res.json({ analytics: result.rows, startDate: start, endDate: today });
    }
  };
}
module.exports = { createAdminController };
