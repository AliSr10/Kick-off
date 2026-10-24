const fs = require('node:fs');
const path = require('node:path');
const { checkData } = require('./check-data');
const VERSION = '001_security_and_bookings';
async function migrate(db) {
  return db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [728346201]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const prior = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [VERSION]);
    if (prior.rows.length) return { applied: false, version: VERSION };
    const issues = await checkData(client);
    if (issues.length) {
      const error = new Error('Existing records need review before migration. Run npm run db:check, resolve the reported conflicts, then run db:migrate again. No records were changed.');
      error.issues = issues;
      throw error;
    }
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations', `${VERSION}.sql`), 'utf8'));
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [VERSION]);
    return { applied: true, version: VERSION };
  });
}
async function main() {
  const { createDatabase } = require('../config/db');
  const db = createDatabase();
  try { console.log(JSON.stringify(await migrate(db))); }
  finally { await db.close(); }
}
if (require.main === module) main().catch(error => { console.error('Migration failed:', error.message); if (error.issues) console.error(JSON.stringify(error.issues, null, 2)); process.exitCode = 1; });
module.exports = { migrate, VERSION };
