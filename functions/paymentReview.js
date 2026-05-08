// payments + reviews
const { ExecuteQuery } = require('../db');
const { ValidatePaymentAmount, ValidateRating } = require('./validation');
const { UpdateBookingStatus } = require('./bookingMatching');

async function ProcessPayment(bookingId, amount, method) {
    const allowed = ['credit_card', 'debit', 'cash', 'other'];
    if (!allowed.includes(method)) return { error: 'bad method' };

    // payment has to match what was agreed on - no partial / over payments
    const bk = await ExecuteQuery('SELECT agreed_price, status FROM bookings WHERE booking_id = $1', [bookingId]);
    if (bk.length === 0) return { error: 'booking not found' };
    if (!ValidatePaymentAmount(amount, bk[0].agreed_price)) return { error: 'amount must match agreed price' };

    const dup = await ExecuteQuery('SELECT payment_id FROM payments WHERE booking_id = $1', [bookingId]);
    if (dup.length > 0) return { error: 'already paid' };

    const rows = await ExecuteQuery(
        `INSERT INTO payments (booking_id, amount, method, status, paid_at)
         VALUES ($1,$2,$3,'completed', NOW()) RETURNING payment_id`,
        [bookingId, amount, method]
    );
    await UpdateBookingStatus(bookingId, 'completed');
    return { payment_id: rows[0].payment_id };
}

async function SubmitReview(bookingId, rating, comment) {
    if (!ValidateRating(rating)) return { error: 'rating must be 1-5' };

    // can only review after the job is actually done
    const bk = await ExecuteQuery('SELECT status FROM bookings WHERE booking_id = $1', [bookingId]);
    if (bk.length === 0) return { error: 'booking not found' };
    if (bk[0].status !== 'completed') return { error: 'booking not completed yet' };

    const dup = await ExecuteQuery('SELECT review_id FROM reviews WHERE booking_id = $1', [bookingId]);
    if (dup.length > 0) return { error: 'already reviewed' };

    const rows = await ExecuteQuery(
        'INSERT INTO reviews (booking_id, rating, comment) VALUES ($1,$2,$3) RETURNING review_id',
        [bookingId, rating, comment || null]
    );
    return { review_id: rows[0].review_id };
}

module.exports = { ProcessPayment, SubmitReview };
