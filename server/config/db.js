const { Pool } = require('pg');
const path = require('path');

// Explicitly point to the .env file inside the server directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log("DB URL Loaded:", process.env.DATABASE_URL ? "Yes (Found)" : "No (Using Fallback)");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params)
};
