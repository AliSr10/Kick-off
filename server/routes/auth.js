const db = require('../config/db'); 
const express = require('express');
const router = express.Router();
const passport = require('passport');

// 1. Trigger the Google Login Screen
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. The Callback
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?error=login_failed' }),
  (req, res) => { res.redirect('/'); }
);

// 3. Check Session
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// 4. Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

// 5. Update Profile Details
router.put('/me', async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  
  const { name, phone } = req.body;
  try {
    const updatedUser = await db.query(
      'UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING *',
      [name, phone, req.user.id]
    );
    res.json({ success: true, user: updatedUser.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 6. NEW: Get Logged-in Player's Bookings
router.get('/my-reservations', async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const userPhone = req.user.phone || '';
    // Find matches linked to their Google ID OR their saved WhatsApp number
    // ORDER BY date DESC puts the newest/upcoming matches at the top
    const result = await db.query(
      `SELECT * FROM reservations 
       WHERE user_id = $1 OR (phone = $2 AND phone != '') 
       ORDER BY date DESC, time ASC`,
      [req.user.id, userPhone]
    );

    const reservations = result.rows.map(r => ({
      ...r,
      date: r.date.toISOString().split('T')[0]
    }));

    res.json({ success: true, reservations });
  } catch (err) {
    console.error('Fetch Matches Error:', err);
    res.status(500).json({ error: 'Failed to fetch match history.' });
  }
});

module.exports = router;