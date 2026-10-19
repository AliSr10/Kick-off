const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const passport = require('./config/passport'); // Import the file you just created
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const publicAuthRoutes = require('./routes/auth');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Session & Passport Initialization ---
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 } // 7-day session
}));

app.use(passport.initialize());
app.use(passport.session());


// Admin session handling
app.use(session({
  secret: process.env.SESSION_SECRET || 'kickoff-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, 
    httpOnly: true 
  }
}));

// Serve client assets statically
app.use(express.static(path.join(__dirname, '../client/public')));

// Mount routers
app.use('/api', require('./routes/api'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', publicAuthRoutes);

// Fallback for SPA Routing (Catch-all)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Kickoff Server running on port ${PORT}`);
});