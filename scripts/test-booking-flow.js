// book request 2 -> pay -> review -> cleanup
const { pool, ExecuteQuery } = require('../db');
const { CreateBooking, UpdateBookingStatus } = require('../functions/bookingMatching');
const { ProcessPayment, SubmitReview } = require('../functions/paymentReview');

(async () => {
    try {
        // request 2 was seeded as open (Kassie's cleaning request)
        console.log('-- create booking on request 2 with provider 1 (Jane) --');
        const start = new Date(Date.now() + 5 * 24 * 3600 * 1000);
        const end = new Date(start.getTime() + 3 * 3600 * 1000);
        const made = await CreateBooking(2, 1, start, end, 90.00);
        console.log('  result:', made);
        if (made.error) throw new Error(made.error);
        const bookingId = made.booking_id;

        console.log('\n-- try to book request 2 again --');
        console.log('  result:', await CreateBooking(2, 1, start, end, 90.00), '(expected error)');

        console.log('\n-- update status to in_progress --');
        console.log('  ', await UpdateBookingStatus(bookingId, 'in_progress'));
        console.log('-- update status to completed --');
        console.log('  ', await UpdateBookingStatus(bookingId, 'completed'));

        console.log('\n-- process payment of 90.00 --');
        console.log('  ', await ProcessPayment(bookingId, 90.00, 'credit_card'));

        console.log('\n-- try paying again (expected error) --');
        console.log('  ', await ProcessPayment(bookingId, 90.00, 'credit_card'));

        console.log('\n-- submit review --');
        console.log('  ', await SubmitReview(bookingId, 4, 'Jane was on time and thorough.'));

        console.log('\n-- try to review again (expected error) --');
        console.log('  ', await SubmitReview(bookingId, 5, 'oops duplicate'));

        // cleanup so we can re-run
        console.log('\n-- cleanup --');
        await ExecuteQuery('DELETE FROM reviews WHERE booking_id = $1', [bookingId]);
        await ExecuteQuery('DELETE FROM payments WHERE booking_id = $1', [bookingId]);
        await ExecuteQuery('DELETE FROM bookings WHERE booking_id = $1', [bookingId]);
        await ExecuteQuery(`UPDATE service_requests SET status = 'open' WHERE request_id = 2`);
        console.log('  cleaned up booking', bookingId);

        console.log('\nbooking flow OK');
    } catch (err) {
        console.error('FAILED:', err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
