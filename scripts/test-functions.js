// smoke test for retrieval + update
const { pool } = require('../db');
const {
    CategoryListRetrieval, ProviderSearchRetrieval, BookingDetailRetrieval,
    ServiceRequestListRetrieval, BookingListRetrieval, ProviderReviewsRetrieval, UserStatsRetrieval
} = require('../functions/dataRetrieval');
const { CreateServiceRequest, UpdateRequestStatus, DeleteServiceRequest } = require('../functions/dataUpdate');

(async () => {
    try {
        console.log('-- categories --');
        const cats = await CategoryListRetrieval();
        console.log(cats.map(c => `${c.category_id}:${c.category_name}`).join(', '));

        console.log('\n-- search providers in cleaning (cat 2) --');
        const found = await ProviderSearchRetrieval(2, '77550', 25);
        found.forEach(p => console.log(`  ${p.first_name} ${p.last_name} - rate ${p.base_rate}, avg ${p.avg_rating}`));

        console.log('\n-- booking 1 detail --');
        const det = await BookingDetailRetrieval(1);
        console.log('  category:', det.category_name, '| price:', det.agreed_price, '| paid:', det.payment_status);

        console.log('\n-- requests for client 4 (Kassie) --');
        const reqs = await ServiceRequestListRetrieval(4);
        reqs.forEach(r => console.log(`  #${r.request_id} ${r.category_name} [${r.status}]`));

        console.log('\n-- bookings for provider 3 (Mike) --');
        const bks = await BookingListRetrieval(3, 'provider');
        bks.forEach(b => console.log(`  #${b.booking_id} ${b.category_name} [${b.status}]`));

        console.log('\n-- reviews for provider 3 --');
        const rv = await ProviderReviewsRetrieval(3);
        console.log('  avg:', rv.avg_rating, 'count:', rv.total);

        console.log('\n-- admin stats --');
        console.log(' ', await UserStatsRetrieval());

        console.log('\n-- create + delete a test request --');
        const future = new Date(Date.now() + 7 * 24 * 3600 * 1000);
        const future2 = new Date(future.getTime() + 2 * 3600 * 1000);
        const made = await CreateServiceRequest(5, 4, 'Test outlet not working', '99 Test St', 'Galveston', 'TX', '77550', future, future2);
        console.log('  created:', made);
        if (made.request_id) {
            const del = await DeleteServiceRequest(made.request_id, 5);
            console.log('  deleted:', del);
        }

        console.log('\n-- close request 1 then reopen --');
        await UpdateRequestStatus(1, 'closed');
        console.log('  set to closed');
        await UpdateRequestStatus(1, 'open');
        console.log('  set back to open');

        console.log('\nall function tests OK');
    } catch (err) {
        console.error('FAILED:', err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
