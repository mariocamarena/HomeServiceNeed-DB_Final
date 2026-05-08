// read queries
const { ExecuteQuery } = require('../db');
const { filterByDistance } = require('./geo');

// providers in a given category, with avg rating, optionally filtered by
// haversine distance from a user-supplied zip
async function ProviderSearchRetrieval(categoryId, zip, radiusMiles) {
    const sql = `
        SELECT u.user_id, u.first_name, u.last_name,
               pp.bio, pp.home_zip, pp.travel_radius_miles, pp.base_rate, pp.verified_status,
               ps.starting_price,
               COALESCE(AVG(r.rating), 0)::numeric(3,2) AS avg_rating,
               COUNT(r.review_id)::int AS review_count
        FROM provider_services ps
        JOIN provider_profiles pp ON pp.provider_id = ps.provider_id
        JOIN users u ON u.user_id = pp.provider_id
        LEFT JOIN bookings b ON b.provider_id = pp.provider_id
        LEFT JOIN reviews r ON r.booking_id = b.booking_id
        WHERE ps.category_id = $1
        GROUP BY u.user_id, pp.bio, pp.home_zip, pp.travel_radius_miles, pp.base_rate, pp.verified_status, ps.starting_price
        ORDER BY (pp.home_zip = $2) DESC, avg_rating DESC, pp.base_rate ASC`;
    const rows = await ExecuteQuery(sql, [categoryId, zip || '']);
    return filterByDistance(rows, zip || '', radiusMiles);
}

// pulls everything for one booking in a single query - request, payment, review, both users
async function BookingDetailRetrieval(bookingId) {
    const sql = `
        SELECT b.*,
               sr.description, sr.street, sr.city, sr.state, sr.zip,
               sc.category_name,
               u.first_name AS provider_first, u.last_name AS provider_last,
               cu.first_name AS client_first, cu.last_name AS client_last,
               p.payment_id, p.amount AS paid_amount, p.method, p.status AS payment_status, p.paid_at,
               rv.review_id, rv.rating, rv.comment
        FROM bookings b
        JOIN service_requests sr ON sr.request_id = b.request_id
        JOIN service_categories sc ON sc.category_id = sr.category_id
        JOIN users u ON u.user_id = b.provider_id
        JOIN users cu ON cu.user_id = sr.client_id
        LEFT JOIN payments p ON p.booking_id = b.booking_id
        LEFT JOIN reviews rv ON rv.booking_id = b.booking_id
        WHERE b.booking_id = $1`;
    const rows = await ExecuteQuery(sql, [bookingId]);
    return rows[0] || null;
}

// for the browse page
async function AllProvidersRetrieval() {
    const providers = await ExecuteQuery(`
        SELECT u.user_id, u.first_name, u.last_name,
               pp.bio, pp.home_zip, pp.travel_radius_miles, pp.base_rate, pp.verified_status,
               COALESCE(AVG(r.rating), 0)::numeric(3,2) AS avg_rating,
               COUNT(r.review_id)::int AS review_count
        FROM provider_profiles pp
        JOIN users u ON u.user_id = pp.provider_id
        LEFT JOIN bookings b ON b.provider_id = pp.provider_id
        LEFT JOIN reviews r ON r.booking_id = b.booking_id
        GROUP BY u.user_id, pp.bio, pp.home_zip, pp.travel_radius_miles, pp.base_rate, pp.verified_status
        ORDER BY avg_rating DESC, pp.base_rate ASC`);
    if (providers.length === 0) return [];
    const cats = await ExecuteQuery(`
        SELECT ps.provider_id, sc.category_id, sc.category_name, ps.starting_price
        FROM provider_services ps
        JOIN service_categories sc ON sc.category_id = ps.category_id`);
    const byProv = {};
    cats.forEach(c => { (byProv[c.provider_id] ||= []).push(c); });
    return providers.map(p => ({ ...p, categories: byProv[p.user_id] || [] }));
}

async function ProviderProfileRetrieval(providerId) {
    const profile = await ExecuteQuery(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone,
                pp.bio, pp.home_zip, pp.travel_radius_miles, pp.base_rate, pp.verified_status
         FROM users u
         JOIN provider_profiles pp ON pp.provider_id = u.user_id
         WHERE u.user_id = $1`,
        [providerId]
    );
    if (profile.length === 0) return null;
    const cats = await ExecuteQuery(
        `SELECT sc.category_id, sc.category_name, ps.starting_price, ps.notes
         FROM provider_services ps
         JOIN service_categories sc ON sc.category_id = ps.category_id
         WHERE ps.provider_id = $1
         ORDER BY sc.category_name`,
        [providerId]
    );
    return { ...profile[0], categories: cats };
}

async function ClientProfileRetrieval(clientId) {
    const rows = await ExecuteQuery(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.created_at
         FROM users u
         JOIN client_profiles cp ON cp.client_id = u.user_id
         WHERE u.user_id = $1`,
        [clientId]
    );
    return rows[0] || null;
}

async function ServiceRequestListRetrieval(clientId) {
    return ExecuteQuery(
        `SELECT sr.*, sc.category_name
         FROM service_requests sr
         JOIN service_categories sc ON sc.category_id = sr.category_id
         WHERE sr.client_id = $1
         ORDER BY sr.created_at DESC`,
        [clientId]
    );
}

// what a provider sees - matching requests with same-zip ones bumped to the top
async function OpenRequestsByCategory(categoryId, zip) {
    const sql = `
        SELECT sr.*, sc.category_name,
               u.first_name AS client_first, u.last_name AS client_last
        FROM service_requests sr
        JOIN service_categories sc ON sc.category_id = sr.category_id
        JOIN users u ON u.user_id = sr.client_id
        WHERE sr.status = 'open' AND sr.category_id = $1
        ORDER BY (sr.zip = $2) DESC, sr.created_at DESC`;
    return ExecuteQuery(sql, [categoryId, zip || '']);
}

// role tells us which side of the booking the user is on
async function BookingListRetrieval(userId, role) {
    let where;
    if (role === 'provider') where = 'b.provider_id = $1';
    else if (role === 'client') where = 'sr.client_id = $1';
    else where = '(b.provider_id = $1 OR sr.client_id = $1)';
    const sql = `
        SELECT b.*, sc.category_name,
               sr.description, sr.client_id,
               pu.first_name AS provider_first, pu.last_name AS provider_last,
               cu.first_name AS client_first, cu.last_name AS client_last,
               (p.payment_id IS NOT NULL) AS paid,
               (rv.review_id IS NOT NULL) AS reviewed
        FROM bookings b
        JOIN service_requests sr ON sr.request_id = b.request_id
        JOIN service_categories sc ON sc.category_id = sr.category_id
        JOIN users pu ON pu.user_id = b.provider_id
        JOIN users cu ON cu.user_id = sr.client_id
        LEFT JOIN payments p ON p.booking_id = b.booking_id
        LEFT JOIN reviews rv ON rv.booking_id = b.booking_id
        WHERE ${where}
        ORDER BY b.scheduled_start DESC`;
    return ExecuteQuery(sql, [userId]);
}

async function ProviderReviewsRetrieval(providerId) {
    const reviews = await ExecuteQuery(
        `SELECT rv.review_id, rv.rating, rv.comment, rv.created_at,
                cu.first_name AS client_first, cu.last_name AS client_last
         FROM reviews rv
         JOIN bookings b ON b.booking_id = rv.booking_id
         JOIN service_requests sr ON sr.request_id = b.request_id
         JOIN users cu ON cu.user_id = sr.client_id
         WHERE b.provider_id = $1
         ORDER BY rv.created_at DESC`,
        [providerId]
    );
    const avg = await ExecuteQuery(
        `SELECT COALESCE(AVG(rv.rating), 0)::numeric(3,2) AS avg_rating, COUNT(*)::int AS total
         FROM reviews rv
         JOIN bookings b ON b.booking_id = rv.booking_id
         WHERE b.provider_id = $1`,
        [providerId]
    );
    return { reviews, avg_rating: avg[0].avg_rating, total: avg[0].total };
}

async function CategoryListRetrieval() {
    return ExecuteQuery('SELECT category_id, category_name FROM service_categories ORDER BY category_name');
}

async function BackgroundCheckRetrieval(userId) {
    return ExecuteQuery(
        'SELECT * FROM background_checks WHERE user_id = $1 ORDER BY requested_at DESC',
        [userId]
    );
}

async function UserStatsRetrieval() {
    const rows = await ExecuteQuery(`
        SELECT
            (SELECT COUNT(*) FROM users)::int AS total_users,
            (SELECT COUNT(*) FROM provider_profiles)::int AS total_providers,
            (SELECT COUNT(*) FROM client_profiles)::int AS total_clients,
            (SELECT COUNT(*) FROM bookings)::int AS total_bookings`);
    return rows[0];
}

// admin - all users with role
async function AllUsersRetrieval() {
    return ExecuteQuery(`
        SELECT user_id, first_name, last_name, email, phone, role_type, created_at
        FROM users
        ORDER BY created_at DESC`);
}

// admin - all background checks across the system
async function AllBackgroundChecksRetrieval() {
    return ExecuteQuery(`
        SELECT bc.check_id, bc.user_id, bc.check_type, bc.status,
               bc.requested_at, bc.completed_at,
               u.first_name, u.last_name, u.email, u.role_type
        FROM background_checks bc
        JOIN users u ON u.user_id = bc.user_id
        ORDER BY bc.requested_at DESC`);
}

module.exports = {
    ProviderSearchRetrieval, AllProvidersRetrieval, BookingDetailRetrieval, ProviderProfileRetrieval,
    ClientProfileRetrieval, ServiceRequestListRetrieval, OpenRequestsByCategory,
    BookingListRetrieval, ProviderReviewsRetrieval, CategoryListRetrieval,
    BackgroundCheckRetrieval, UserStatsRetrieval,
    AllUsersRetrieval, AllBackgroundChecksRetrieval
};
