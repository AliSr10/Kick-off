const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../config/db');

test('legacy SSL modes retain full certificate verification without the alias warning', async () => {
  for (const mode of ['prefer', 'require', 'verify-ca']) {
    const db = createDatabase({ production: false, databaseUrl: `postgres://example.invalid/kickoff?sslmode=${mode}` });
    try { assert.equal(new URL(db.pool.options.connectionString).searchParams.get('sslmode'), 'verify-full'); }
    finally { await db.close(); }
  }
  for (const production of [false, true]) {
    const db = createDatabase({ production, databaseUrl: 'postgres://example.invalid/kickoff?sslmode=disable' });
    try { assert.equal(new URL(db.pool.options.connectionString).searchParams.get('sslmode'), production ? 'verify-full' : 'disable'); }
    finally { await db.close(); }
  }
});
