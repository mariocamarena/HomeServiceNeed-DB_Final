// Part C requires 3 retrieval + 3 update tasks (insert, delete, update).
// This script exercises one of each end-to-end against the DB.
const { pool, ExecuteQuery } = require('../db');
const {
    CategoryListRetrieval, ProviderSearchRetrieval, BookingDetailRetrieval
} = require('../functions/dataRetrieval');
const { CreateServiceRequest, UpdateRequestStatus, DeleteServiceRequest } = require('../functions/dataUpdate');

(async () => {
    let createdRequestId = null;
    try {
        // ----- 3 RETRIEVAL TASKS -----

        console.log('\n[R1] retrieve all service categories');
        const cats = await CategoryListRetrieval();
        console.log('   ->', cats.length, 'categories');
        if (cats.length === 0) throw new Error('expected seed categories');

        console.log('\n[R2] search providers in cleaning (cat 2) near zip 77550');
        const providers = await ProviderSearchRetrieval(2, '77550', 25);
        providers.forEach(p => console.log(`   ${p.first_name} ${p.last_name} - rate ${p.base_rate}, avg ${p.avg_rating}`));

        console.log('\n[R3] booking 1 detail (joins across 7 tables)');
        const det = await BookingDetailRetrieval(1);
        if (det) console.log('   category:', det.category_name, '| price:', det.agreed_price, '| paid:', det.payment_status);
        else console.log('   (no booking 1 - run seed.sql first)');

        // ----- 3 UPDATE TASKS -----

        console.log('\n[U1 - INSERT] create new service request for client 5');
        const start = new Date(Date.now() + 7 * 24 * 3600 * 1000);
        const end = new Date(start.getTime() + 2 * 3600 * 1000);
        const created = await CreateServiceRequest(
            5, 4, 'Outlet in garage stopped working',
            '99 Test Ln', 'Galveston', 'TX', '77550', start, end
        );
        if (created.error) throw new Error('insert failed: ' + created.error);
        createdRequestId = created.request_id;
        console.log('   -> inserted request_id =', createdRequestId);

        console.log('\n[U2 - UPDATE] mark new request as cancelled then back to open');
        const upd1 = await UpdateRequestStatus(createdRequestId, 'cancelled');
        if (upd1.error) throw new Error('update failed: ' + upd1.error);
        console.log('   -> set to cancelled');
        const upd2 = await UpdateRequestStatus(createdRequestId, 'open');
        console.log('   -> set back to open');

        console.log('\n[U3 - DELETE] delete the request we just created');
        const del = await DeleteServiceRequest(createdRequestId, 5);
        if (del.error) throw new Error('delete failed: ' + del.error);
        console.log('   -> deleted request_id =', createdRequestId);
        createdRequestId = null;

        console.log('\nAll Part C testing tasks PASSED');
    } catch (err) {
        console.error('FAILED:', err.message);
        if (createdRequestId) {
            try { await ExecuteQuery('DELETE FROM service_requests WHERE request_id = $1', [createdRequestId]); }
            catch (e) {}
        }
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
