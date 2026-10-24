const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createAdminController } = require('../controllers/adminController');
function createAdminRoutes({ db, bookings, tickets, auth, loginLimiter }) {
  const router = express.Router();
  const c = createAdminController(db, bookings, tickets);
  router.get('/check-session', auth.checkSession);
  router.post('/login', loginLimiter, auth.login);
  router.post('/logout', auth.logout);
  router.use(requireAuth);
  router.get('/dashboard-stats', c.getDashboardStats);
  router.get('/reservations', c.getReservations);
  router.post('/reservations', c.createManualReservation);
  router.delete('/reservations/cancelled', c.clearCancelled);
  router.patch('/reservations/:id/confirm', c.confirmReservation);
  router.patch('/reservations/:id/cancel', c.cancelReservation);
  router.get('/standing-bookings', c.getStandingBookings);
  router.post('/standing-bookings', c.createStandingBooking);
  router.put('/standing-bookings/:id', c.updateStandingBooking);
  router.delete('/standing-bookings/:id', c.deleteStandingBooking);
  router.get('/analytics', c.getAnalytics);
  return router;
}
module.exports = { createAdminRoutes };
