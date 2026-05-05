// inserts, updates, deletes
const { ExecuteQuery } = require('../db');
const { ValidateZipCode, ValidateDateRange, ValidateRate, ValidateRadius } = require('./validation');

async function CreateServiceRequest(clientId, categoryId, description, street, city, state, zip, preferredStart, preferredEnd) {
    if (!ValidateZipCode(zip)) return { error: 'bad zip' };
    if (!ValidateDateRange(preferredStart, preferredEnd)) return { error: 'preferred end must be after start' };
    const rows = await ExecuteQuery(
        `INSERT INTO service_requests
            (client_id, category_id, description, street, city, state, zip, preferred_start, preferred_end, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open')
         RETURNING request_id`,
        [clientId, categoryId, description, street, city, state, zip, preferredStart, preferredEnd]
    );
    return { request_id: rows[0].request_id };
}

async function UpdateProviderProfile(providerId, fields) {
    const { bio, home_zip, travel_radius_miles, base_rate } = fields;
    if (home_zip && !ValidateZipCode(home_zip)) return { error: 'bad zip' };
    if (travel_radius_miles != null && !ValidateRadius(travel_radius_miles)) return { error: 'bad radius' };
    if (base_rate != null && !ValidateRate(base_rate)) return { error: 'bad rate' };
    await ExecuteQuery(
        `UPDATE provider_profiles
         SET bio = COALESCE($2, bio),
             home_zip = COALESCE($3, home_zip),
             travel_radius_miles = COALESCE($4, travel_radius_miles),
             base_rate = COALESCE($5, base_rate)
         WHERE provider_id = $1`,
        [providerId, bio, home_zip, travel_radius_miles, base_rate]
    );
    return { ok: true };
}

// wipe and reinsert the provider's category list
async function UpdateProviderServices(providerId, categories) {
    await ExecuteQuery('DELETE FROM provider_services WHERE provider_id = $1', [providerId]);
    for (const c of categories) {
        await ExecuteQuery(
            'INSERT INTO provider_services (provider_id, category_id, starting_price, notes) VALUES ($1,$2,$3,$4)',
            [providerId, c.category_id, c.starting_price || null, c.notes || null]
        );
    }
    return { ok: true };
}

async function UpdateRequestStatus(requestId, status) {
    const allowed = ['open', 'booked', 'closed', 'cancelled'];
    if (!allowed.includes(status)) return { error: 'bad status' };
    await ExecuteQuery('UPDATE service_requests SET status = $2 WHERE request_id = $1', [requestId, status]);
    return { ok: true };
}

// only delete if still open and owned by this client
async function DeleteServiceRequest(requestId, clientId) {
    const rows = await ExecuteQuery(
        `DELETE FROM service_requests
         WHERE request_id = $1 AND client_id = $2 AND status = 'open'
         RETURNING request_id`,
        [requestId, clientId]
    );
    if (rows.length === 0) return { error: 'cannot delete (not open or not yours)' };
    return { ok: true };
}

async function SubmitBackgroundCheck(userId, checkType) {
    const rows = await ExecuteQuery(
        `INSERT INTO background_checks (user_id, check_type, status, requested_at)
         VALUES ($1, $2, 'pending', NOW()) RETURNING check_id`,
        [userId, checkType]
    );
    return { check_id: rows[0].check_id };
}

async function UpdateCheckStatus(checkId, status) {
    const allowed = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(status)) return { error: 'bad status' };
    const completed = status === 'pending' ? null : new Date();
    await ExecuteQuery(
        'UPDATE background_checks SET status = $2, completed_at = $3 WHERE check_id = $1',
        [checkId, status, completed]
    );
    // approved check -> mark provider verified
    const check = await ExecuteQuery('SELECT user_id FROM background_checks WHERE check_id = $1', [checkId]);
    if (check[0] && status === 'approved') {
        await ExecuteQuery(
            `UPDATE provider_profiles SET verified_status = 'verified' WHERE provider_id = $1`,
            [check[0].user_id]
        );
    }
    return { ok: true };
}

async function AddCategory(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return { error: 'category name required' };
    const rows = await ExecuteQuery(
        `INSERT INTO service_categories (category_name) VALUES ($1)
         ON CONFLICT (category_name) DO NOTHING
         RETURNING category_id`,
        [trimmed]
    );
    if (rows.length === 0) return { error: 'category already exists' };
    return { category_id: rows[0].category_id };
}

// only deletes when no provider currently offers it - prevents orphaning provider_services rows
async function DeleteCategory(categoryId) {
    const inUse = await ExecuteQuery(
        `SELECT 1 FROM provider_services WHERE category_id = $1
         UNION ALL SELECT 1 FROM service_requests WHERE category_id = $1 LIMIT 1`,
        [categoryId]
    );
    if (inUse.length > 0) return { error: 'category in use - cannot delete' };
    const rows = await ExecuteQuery(
        'DELETE FROM service_categories WHERE category_id = $1 RETURNING category_id',
        [categoryId]
    );
    if (rows.length === 0) return { error: 'category not found' };
    return { ok: true };
}

module.exports = {
    CreateServiceRequest, UpdateProviderProfile, UpdateProviderServices,
    UpdateRequestStatus, DeleteServiceRequest, SubmitBackgroundCheck,
    UpdateCheckStatus, AddCategory, DeleteCategory
};
