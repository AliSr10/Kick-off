const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');
require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // 1. Check if the user already exists in your database
      const existingUser = await db.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
      
      if (existingUser.rows.length > 0) {
        // User exists, log them in
        return done(null, existingUser.rows[0]);
      }

      // 2. If new user, insert them into the users table
      const newUser = await db.query(
        'INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING *',
        [profile.id, profile.emails[0].value, profile.displayName]
      );
      
      done(null, newUser.rows[0]);
    } catch (err) {
      console.error("Passport Error:", err);
      done(err, null);
    }
  }
));

// Serialize: Determines which data of the user object should be stored in the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize: Retrieves the whole user object from the database using the stored ID
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, user.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
