// give every seeded user a real bcrypt hash for "Password123!"
const bcrypt = require('bcrypt');
const { ExecuteQuery, pool } = require('../db');

(async () => {
    try {
        const hash = await bcrypt.hash('Password123!', 10);
        const result = await ExecuteQuery(
            `UPDATE users SET password_hash = $1
             WHERE password_hash LIKE '$2b$10$placeholder%'
             RETURNING email`,
            [hash]
        );
        console.log(`updated ${result.length} users:`);
        result.forEach(r => console.log('  ' + r.email));
        console.log('\nlogin password: Password123!');
    } catch (err) {
        console.error('failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
