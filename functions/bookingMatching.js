// booking creation + status changes
const { ExecuteQuery } = require('../db');
const { ValidateBookingDates } = require('./validation');
const { UpdateRequestStatus } = require('./dataUpdate');

async function CreateBooking(requestId, providerId, scheduledStart, scheduledEnd, agreedPrice) {
    if (!ValidateBookingDates(scheduledStart, scheduledEnd)) return { error: 'bad dates' };
    if (Number(agreedPrice) <= 0) return { error: 'bad price' };

    // one booking per request - no double-booking the same job
    const exists = await ExecuteQuery('SELECT booking_id FROM bookings WHERE request_id = $1', [requestId]);
    if (exists.length > 0) return { error: 'request already booked' };

    const reqRow = await ExecuteQuery('SELECT status FROM service_requests WHERE request_id = $1', [requestId]);
    if (reqRow.length === 0) return { error: 'request not found' };
    if (reqRow[0].status !== 'open') return { error: 'request not open' };

    const rows = await ExecuteQuery(
        `INSERT INTO bookings (request_id, provider_id, scheduled_start, scheduled_end, agreed_price, status)
         VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING booking_id`,
        [requestId, providerId, scheduledStart, scheduledEnd, agreedPrice]
    );
    await UpdateRequestStatus(requestId, 'booked');
    return { booking_id: rows[0].booking_id };
}

// also cascades request status when needed
async function UpdateBookingStatus(bookingId, status) {
    const allowed = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return { error: 'bad status' };

    await ExecuteQuery('UPDATE bookings SET status = $2 WHERE booking_id = $1', [bookingId, status]);

    const row = await ExecuteQuery('SELECT request_id FROM bookings WHERE booking_id = $1', [bookingId]);
    if (row.length === 0) return { error: 'booking not found' };
    const requestId = row[0].request_id;

    if (status === 'completed') await UpdateRequestStatus(requestId, 'closed');
    if (status === 'cancelled') await UpdateRequestStatus(requestId, 'open');
    return { ok: true };
}

module.exports = { CreateBooking, UpdateBookingStatus };
