const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

function loadConfig(env = process.env) {
  const required = ['SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
  const missing = required.filter(key => typeof env[key] !== 'string' || !env[key].trim());
  if (!(env.DATABASE_URL || env.DB_URL)) missing.push('DATABASE_URL (or DB_URL)');
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  for (const key of [...required, 'TICKET_SECRET']) {
    if (/^(REPLACE_|CHANGE_ME|YOUR_)/i.test(env[key] || '')) throw new Error(`Replace the example value for ${key} before starting.`);
  }
  if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  if (env.ADMIN_PASS.length < 12) throw new Error('ADMIN_PASS must contain at least 12 characters.');
  if (env.TICKET_SECRET && env.TICKET_SECRET.length < 32) throw new Error('TICKET_SECRET must contain at least 32 characters.');
  const production = env.NODE_ENV === 'production';
  const callback = new URL(env.GOOGLE_CALLBACK_URL);
  const origin = new URL(env.APP_URL || callback.origin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('APP_URL must be an HTTP(S) origin.');
  if (production && (origin.protocol !== 'https:' || callback.protocol !== 'https:')) throw new Error('Production APP_URL and Google callback must use HTTPS.');
  if (origin.origin !== callback.origin) throw new Error('APP_URL and GOOGLE_CALLBACK_URL must use the same origin.');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port number.');
  return {
    production, port, origin: origin.origin,
    databaseUrl: env.DATABASE_URL || env.DB_URL,
    sessionSecret: env.SESSION_SECRET,
    ticketSecret: env.TICKET_SECRET || env.SESSION_SECRET,
    adminUser: env.ADMIN_USER, adminPass: env.ADMIN_PASS,
    googleClientId: env.GOOGLE_CLIENT_ID, googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: callback.href,
    businessWhatsApp: env.BUSINESS_WHATSAPP || '9613696325'
  };
}
module.exports = { loadConfig };
