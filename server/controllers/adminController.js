const db = require('../config/db');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayMatches = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE date = $1 AND status = 'CONFIRMED'", [today]
    );
    const upcoming = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE date >= $1 AND status = 'CONFIRMED'", [today]
    );
    const cancelled = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE status = 'CANCELLED'"
    );

    res.json({
      todayMatches: parseInt(todayMatches.rows[0].count),
      upcoming: parseInt(upcoming.rows[0].count),
      cancelled: parseInt(cancelled.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to aggregate facility stats.' });
  }
};
const getReservations = async (req, res) => {
  try {
    const { search = '', status = 'ALL', date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    
    let query = "SELECT * FROM reservations WHERE 1=1";
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // --- ARCHIVE ENGINE ---
    if (status === 'ARCHIVE') {
      // Fetch ONLY matches from the past
      query += ` AND date < $${paramCount}`;
      params.push(today);
      paramCount++;
    } else if (status === 'UPCOMING') {
      // Fetch ONLY matches from today onwards
      query += ` AND date >= $${paramCount} AND status = 'CONFIRMED'`;
      params.push(today);
      paramCount++;
    } else if (status !== 'ALL') {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (date) {
      query += ` AND date = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    query += " ORDER BY date DESC, time ASC";
    const result = await db.query(query, params);
    
    const reservations = result.rows.map(r => ({
      ...r,
      date: r.date.toISOString().split('T')[0]
    }));

    res.json({ reservations });
  } catch (err) {
    res.status(500).json({ error: 'Database query failed.' });
  }
};

const cancelReservation = async (req, res) => {
  try {
    await db.query("UPDATE reservations SET status = 'CANCELLED' WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Cancellation failed.' });
  }
};

const createManualReservation = async (req, res) => {
  try {
    const { name, phone, date, time, notes } = req.body;
    const ticketId = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const endTime = time.split(' - ')[1] || '';

    await db.query(
      `INSERT INTO reservations (id, name, phone, date, time, end_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED')`,
      [ticketId, name, phone, date, time, endTime, notes]
    );
    res.status(201).json({ success: true, id: ticketId });
  } catch (err) {
    res.status(500).json({ error: 'Manual creation failed.' });
  }
};

const getStandingBookings = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM standing_bookings ORDER BY day_of_week ASC, time ASC");
    const mapped = result.rows.map(r => ({
      id: r.id,
      playerName: r.player_name,
      phone: r.phone,
      dayOfWeek: r.day_of_week,
      time: r.time
    }));
    res.json({ standingBookings: mapped });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve recurring bookings.' });
  }
};

const createStandingBooking = async (req, res) => {
  try {
    const { playerName, phone, dayOfWeek, time } = req.body;
    await db.query(
      "INSERT INTO standing_bookings (player_name, phone, day_of_week, time) VALUES ($1, $2, $3, $4)",
      [playerName, phone, dayOfWeek, time]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to secure recurring slot.' });
  }
};

const updateStandingBooking = async (req, res) => {
  try {
    const { playerName, phone, dayOfWeek, time } = req.body;
    await db.query(
      "UPDATE standing_bookings SET player_name = $1, phone = $2, day_of_week = $3, time = $4 WHERE id = $5",
      [playerName, phone, dayOfWeek, time, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed.' });
  }
};

const deleteStandingBooking = async (req, res) => {
  try {
    await db.query("DELETE FROM standing_bookings WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Removal failed.' });
  }
};

const getAnalytics = async (req, res) => {
  try {
    // Generate the cutoff date (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch grouped counts from PostgreSQL
    const result = await db.query(
      `SELECT date, COUNT(*) as match_count 
       FROM reservations 
       WHERE date >= $1 AND status = 'CONFIRMED' 
       GROUP BY date 
       ORDER BY date ASC`,
      [startDate]
    );

    const rawData = result.rows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      count: parseInt(r.match_count)
    }));

    res.json({ analytics: rawData });
  } catch (err) {
    console.error('Analytics Error:', err);
    res.status(500).json({ error: 'Failed to aggregate analytics.' });
  }
};

module.exports = {
  getDashboardStats,
  getReservations,
  cancelReservation,
  createManualReservation,
  getAnalytics
};
  getStandingBookings,
  createStandingBooking,
  updateStandingBooking,
  deleteStandingBooking
};
