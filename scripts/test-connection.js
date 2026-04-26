// test that we can connect and read seeded data
const { ExecuteQuery, pool } = require('../db');

(async () => {
    try {
        const v = await ExecuteQuery('SELECT version() AS version');
        console.log('Connected to:', v[0].version);
        const counts = await ExecuteQuery(`
            SELECT 'users' AS t, COUNT(*)::int AS n FROM users UNION ALL
            SELECT 'provider_profiles', COUNT(*)::int FROM provider_profiles UNION ALL
            SELECT 'client_profiles', COUNT(*)::int FROM client_profiles UNION ALL
            SELECT 'background_checks', COUNT(*)::int FROM background_checks UNION ALL
            SELECT 'service_categories', COUNT(*)::int FROM service_categories UNION ALL
            SELECT 'provider_services', COUNT(*)::int FROM provider_services UNION ALL
            SELECT 'service_requests', COUNT(*)::int FROM service_requests UNION ALL
            SELECT 'bookings', COUNT(*)::int FROM bookings UNION ALL
            SELECT 'payments', COUNT(*)::int FROM payments UNION ALL
            SELECT 'reviews', COUNT(*)::int FROM reviews
        `);
        console.log('\nTable counts:');
        counts.forEach(r => console.log(`  ${r.t.padEnd(20)} ${r.n}`));
        console.log('\nConnection OK.');
    } catch (err) {
        console.error('Connection FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
