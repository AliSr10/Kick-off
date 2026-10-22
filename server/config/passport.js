const { Passport } = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
function createPassport(db, config) {
  const passport = new Passport();
  passport.use(new GoogleStrategy({ clientID: config.googleClientId, clientSecret: config.googleClientSecret,
    callbackURL: config.googleCallbackUrl, proxy: true, state: true }, async (_access, _refresh, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(null, false);
      const result = await db.query(`INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3)
        ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email
        RETURNING id, name, email, phone`, [profile.id, email, profile.displayName || email.split('@')[0]]);
      done(null, result.rows[0]);
    } catch (error) { done(error); }
  }));
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try { const result = await db.query('SELECT id, name, email, phone FROM users WHERE id = $1', [id]); done(null, result.rows[0] || false); }
    catch (error) { done(error); }
  });
  return passport;
}
module.exports = { createPassport };
