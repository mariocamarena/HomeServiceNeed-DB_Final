// db connection pool for supabase
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('missing DATABASE_URL in .env');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
    console.error('pg pool error:', err);
});

// run a query, returns rows
async function ExecuteQuery(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

module.exports = { pool, ExecuteQuery };
