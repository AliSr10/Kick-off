const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('./config/passport');
const publicAuthRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render's proxy headers for HTTPS/cookies
app.set('trust proxy', 1);

// Core Parsers & CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. HTTP Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
        connectSrc: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);

// 2. Hide Express stack identity
app.disable('x-powered-by');

// 3. Prevent caching of sensitive responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// 4. Single Unified Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'kickoff_fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

// 5. Passport Middleware (MUST come AFTER session)
app.use(passport.initialize());
app.use(passport.session());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../client/public')));

// Mount API Routers
app.use('/api', require('./routes/api'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', publicAuthRoutes);

// Fallback for SPA Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// 6. Custom Error Handler (MUST be placed AFTER routes and BEFORE app.listen)
app.use((err, req, res, next) => {
  console.error(err.stack); // Logs full error details to Render terminal
  res.status(err.status || 500).json({
    status: 'error',
    message: 'An internal server error occurred.',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Kickoff Server running on port ${PORT}`);
});
