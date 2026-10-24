const { Pool, types } = require('pg');
const { loadConfig } = require('./env');
types.setTypeParser(1082, value => value);
function createDatabase(config = loadConfig()) {
  const url = new URL(config.databaseUrl);
  if (config.production || ['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) url.searchParams.set('sslmode', 'verify-full');
  const pool = new Pool({ connectionString: url.href, max: 8, connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000, statement_timeout: 15000, application_name: 'kickoff' });
  pool.on('error', error => console.error('database_idle_error', { code: error.code || 'UNKNOWN' }));
  return {
    pool,
    query: (sql, values) => pool.query(sql, values),
    async transaction(work) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end()
  };
}
module.exports = { createDatabase };
