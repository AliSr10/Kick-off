const express = require('express');
const { requireUser } = require('../middleware/auth');
const { ALL_SLOTS, text, phoneValue } = require('../lib/booking');
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, phone: user.phone || '' }; }
function createAuthRoutes({ db, passport, tickets, logout }) {
  const router = express.Router();
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/?error=login_failed' }), (_req, res) => res.redirect('/'));
  router.get('/me', (req, res) => res.json(req.isAuthenticated?.() ? { loggedIn: true, user: publicUser(req.user) } : { loggedIn: false }));
  router.post('/logout', logout);
  router.put('/me', requireUser, async (req, res) => {
    const name = text(req.body?.name, 'Name', 120);
    const phone = phoneValue(req.body?.phone, false);
    const updated = await db.query('UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING id, name, email, phone', [name, phone, req.user.id]);
    res.json({ success: true, user: publicUser(updated.rows[0]) });
  });
  router.get('/my-reservations', requireUser, async (req, res) => {
    // Phone numbers are contact details, never proof of booking ownership.
    const result = await db.query(`SELECT id, name, date::text, time, status FROM reservations
      WHERE user_id = $1 ORDER BY date DESC, array_position($2::text[], time)`, [req.user.id, ALL_SLOTS]);
    res.json({ success: true, reservations: result.rows.map(row => ({ ...row, ticketUrl: tickets.url(row.id) })) });
  });
  return router;
}
module.exports = { createAuthRoutes, publicUser };
