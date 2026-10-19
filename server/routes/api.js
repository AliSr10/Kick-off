const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Master list of facility operating hours
const ALL_SLOTS = [
  '3:00 PM - 4:30 PM',
  '4:30 PM - 6:00 PM',
  '6:00 PM - 7:30 PM',
  '7:30 PM - 9:00 PM',
  '9:00 PM - 10:30 PM',
  '10:30 PM - 12:00 AM'
];

// GET: Generate availability schedule for a specific date
router.get('/availability', async (req, res) => {
  try {
    const { date } = req.query; // format: YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'Date parameter is required' });

    const dayOfWeek = new Date(date).getDay();

    // 1. Fetch confirmed single-day reservations
    const resResult = await db.query(
      "SELECT time FROM reservations WHERE date = $1 AND status = 'CONFIRMED'",
      [date]
    );
    const bookedTimes = resResult.rows.map(r => r.time);

    // 2. Fetch VIP recurring bookings locking this day of the week
    const vipResult = await db.query(
      "SELECT time FROM standing_bookings WHERE day_of_week = $1",
      [dayOfWeek]
    );
    const vipTimes = vipResult.rows.map(r => r.time);

    // 3. Build the timeline grid
    const schedule = ALL_SLOTS.map(time => {
      const isBooked = bookedTimes.includes(time) || vipTimes.includes(time);
      const isPopular = ['7:30 PM - 9:00 PM', '9:00 PM - 10:30 PM'].includes(time);
      
      return {
        time,
        available: !isBooked,
        isPopular: !isBooked && isPopular
      };
    });

    res.json({ schedule });
  } catch (err) {
    console.error('Availability Error:', err);
    res.status(500).json({ error: 'Server error retrieving pitch availability.' });
  }
});

// POST: Process a new customer reservation
router.post('/reservations', async (req, res) => {
  try {
    const { name, phone, date, time, notes } = req.body;
    
    if (!name || !date || !time) return res.status(400).json({ error: 'Missing required booking details.' });

    // Double-verify slot availability
    const conflictCheck = await db.query(
      "SELECT id FROM reservations WHERE date = $1 AND time = $2 AND status = 'CONFIRMED'",
      [date, time]
    );
    if (conflictCheck.rows.length > 0) return res.status(400).json({ error: 'This time slot was just booked by someone else.' });

    const dayOfWeek = new Date(date).getDay();
    const vipCheck = await db.query(
      "SELECT id FROM standing_bookings WHERE day_of_week = $1 AND time = $2",
      [dayOfWeek, time]
    );
    if (vipCheck.rows.length > 0) return res.status(400).json({ error: 'This slot is secured by a recurring VIP booking.' });

    const ticketId = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const endTime = time.split(' - ')[1] || ''; 
    
    // NEW: Check if the user is logged in via Google and grab their ID
    let userId = null;
    if (req.isAuthenticated && req.isAuthenticated()) {
      userId = req.user.id;
    }

    // NEW: Insert the user_id into the database alongside the reservation
    await db.query(
      `INSERT INTO reservations (id, name, phone, date, time, end_time, notes, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)`,
      [ticketId, name, phone || '', date, time, endTime, notes || '', userId]
    );

    res.status(201).json({ reservation: { id: ticketId, name, date, time } });

  } catch (err) {
    console.error('Reservation Error:', err);
    res.status(500).json({ error: 'Failed to process pitch reservation.' });
  }
});


module.exports = router;