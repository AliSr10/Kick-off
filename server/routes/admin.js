const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { checkSession, login, logout } = require('../controllers/authController');
const {
  getDashboardStats,
  getReservations,
  cancelReservation,
  createManualReservation,
  getStandingBookings,
  createStandingBooking,
  updateStandingBooking,
  deleteStandingBooking,
  getAnalytics // <--- ADD THIS
} = require('../controllers/adminController');


// --- Authentication ---
router.get('/check-session', checkSession);
router.post('/login', login);
router.post('/logout', logout);

// --- Admin Dashboard (Protected) ---
// --- Dashboard Stats (Upgraded) ---
router.get('/dashboard-stats', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayMatches = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE date = $1 AND status = 'CONFIRMED'", [today]
    );
    const pending = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE status = 'PENDING'"
    );
    const upcoming = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE date >= $1 AND status = 'CONFIRMED'", [today]
    );
    const cancelled = await db.query(
      "SELECT COUNT(*) FROM reservations WHERE status = 'CANCELLED'"
    );

    res.json({
      todayMatches: parseInt(todayMatches.rows[0].count),
      pending: parseInt(pending.rows[0].count),
      upcoming: parseInt(upcoming.rows[0].count),
      cancelled: parseInt(cancelled.rows[0].count)
    });
  } catch (err) {
    console.error('Stats Error:', err);
    res.status(500).json({ error: 'Failed to aggregate facility stats.' });
  }
});
router.get('/reservations', requireAuth, getReservations);
router.patch('/reservations/:id/cancel', requireAuth, cancelReservation);
router.post('/reservations', requireAuth, createManualReservation);
// --- Clear Cancelled History ---
router.delete('/reservations/cancelled', requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM reservations WHERE status = 'CANCELLED'");
    res.json({ success: true });
  } catch (err) {
    console.error('Clear History Error:', err);
    res.status(500).json({ error: 'Failed to clear history from database.' });
  }
});
// --- Confirm a Pending Reservation ---
router.patch('/reservations/:id/confirm', requireAuth, async (req, res) => {
  try {
    await db.query("UPDATE reservations SET status = 'CONFIRMED' WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Confirm Error:', err);
    res.status(500).json({ error: 'Confirmation failed in database.' });
  }
});

// --- VIP Standing Bookings (Protected) ---
router.get('/standing-bookings', requireAuth, getStandingBookings);
router.post('/standing-bookings', requireAuth, createStandingBooking);
router.put('/standing-bookings/:id', requireAuth, updateStandingBooking);
router.delete('/standing-bookings/:id', requireAuth, deleteStandingBooking);
// --- Booking Analytics ---
router.get('/analytics', requireAuth, getAnalytics);
module.exports = router;