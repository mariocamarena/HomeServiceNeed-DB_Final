// json api endpoints
const express = require('express');
const router = express.Router();
const { Authorize, RegisterUser, CreateSession, DestroySession } = require('../functions/auth');
const {
    CategoryListRetrieval, ServiceRequestListRetrieval, BookingListRetrieval,
    ProviderProfileRetrieval, ProviderReviewsRetrieval, OpenRequestsByCategory,
    UserStatsRetrieval, ProviderSearchRetrieval, AllProvidersRetrieval, BookingDetailRetrieval,
    BackgroundCheckRetrieval, AllUsersRetrieval, AllBackgroundChecksRetrieval
} = require('../functions/dataRetrieval');
const {
    CreateServiceRequest, UpdateProviderProfile, UpdateProviderServices,
    UpdateRequestStatus, DeleteServiceRequest, SubmitBackgroundCheck,
    UpdateCheckStatus, AddCategory, DeleteCategory
} = require('../functions/dataUpdate');
const { CreateBooking, UpdateBookingStatus } = require('../functions/bookingMatching');
const { ProcessPayment, SubmitReview } = require('../functions/paymentReview');

// catch async errors and pass to express
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'not signed in' });
    next();
}

// 'both' counts as client and provider
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.userId) return res.status(401).json({ error: 'not signed in' });
        const r = req.session.role;
        const ok = roles.some(allow => allow === r || (r === 'both' && (allow === 'client' || allow === 'provider')));
        if (!ok) return res.status(403).json({ error: 'forbidden' });
        next();
    };
}

// auth
router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'not signed in' });
    res.json({ user_id: req.session.userId, role: req.session.role, first_name: req.session.firstName });
});

router.post('/login', wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await Authorize(email, password);
    if (!user) return res.status(401).json({ error: 'invalid email or password' });
    CreateSession(req, user, req.ip);
    // force session save before responding
    req.session.save(err => {
        if (err) return res.status(500).json({ error: 'session save failed' });
        res.json({ user_id: user.user_id, role: user.role_type, first_name: user.first_name });
    });
}));

router.post('/register', wrap(async (req, res) => {
    const { firstName, lastName, email, phone, password, role } = req.body || {};
    const result = await RegisterUser(firstName, lastName, email, phone, password, role);
    if (result.error) return res.status(400).json(result);
    const user = await Authorize(email, password);
    if (user) CreateSession(req, user, req.ip);
    req.session.save(err => {
        if (err) return res.status(500).json({ error: 'session save failed' });
        res.json({ user_id: result.user_id, role, first_name: firstName });
    });
}));

router.post('/logout', wrap(async (req, res) => {
    await DestroySession(req);
    res.json({ ok: true });
}));

// public reads
router.get('/categories', wrap(async (req, res) => {
    res.json(await CategoryListRetrieval());
}));

router.get('/providers', wrap(async (req, res) => {
    res.json(await AllProvidersRetrieval());
}));

// keep this BEFORE the /:id route or it gets shadowed
router.get('/providers/search', wrap(async (req, res) => {
    const { categoryId, zip, radius } = req.query;
    const r = Number(radius) || 0;
    if (categoryId) {
        res.json(await ProviderSearchRetrieval(Number(categoryId), zip || '', r));
    } else {
        // no category - filter the full provider list by distance
        const all = await AllProvidersRetrieval();
        const { filterByDistance } = require('../functions/geo');
        res.json(await filterByDistance(all, zip || '', r));
    }
}));

router.get('/providers/:id', wrap(async (req, res) => {
    const id = Number(req.params.id);
    const p = await ProviderProfileRetrieval(id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const reviews = await ProviderReviewsRetrieval(id);
    res.json({ ...p, reviews: reviews.reviews, avg_rating: reviews.avg_rating, total_reviews: reviews.total });
}));

// dashboards
router.get('/dashboard/client', requireRole('client'), wrap(async (req, res) => {
    const id = req.session.userId;
    const [requests, bookings] = await Promise.all([
        ServiceRequestListRetrieval(id),
        BookingListRetrieval(id, 'client')
    ]);
    res.json({ requests, bookings });
}));

router.get('/dashboard/provider', requireRole('provider'), wrap(async (req, res) => {
    const id = req.session.userId;
    const [profile, bookings, reviews] = await Promise.all([
        ProviderProfileRetrieval(id),
        BookingListRetrieval(id, 'provider'),
        ProviderReviewsRetrieval(id)
    ]);
    res.json({ profile, bookings, reviews });
}));

router.get('/openRequests', requireRole('provider'), wrap(async (req, res) => {
    const { categoryId, zip } = req.query;
    if (categoryId) return res.json(await OpenRequestsByCategory(Number(categoryId), zip || ''));
    const cats = await CategoryListRetrieval();
    const all = [];
    for (const c of cats) {
        const list = await OpenRequestsByCategory(c.category_id, '');
        all.push(...list);
    }
    res.json(all);
}));

router.get('/booking/:id', requireAuth, wrap(async (req, res) => {
    const row = await BookingDetailRetrieval(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'not found' });
    // only the client/provider on the booking can see it
    const uid = req.session.userId;
    if (row.client_id !== uid && row.provider_id !== uid && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden' });
    }
    res.json(row);
}));

// writes - clients
router.post('/requests', requireRole('client'), wrap(async (req, res) => {
    const b = req.body || {};
    const result = await CreateServiceRequest(
        req.session.userId, Number(b.categoryId), b.description,
        b.street, b.city, b.state, b.zip, b.preferredStart, b.preferredEnd
    );
    res.status(result.error ? 400 : 200).json(result);
}));

router.delete('/requests/:id', requireRole('client'), wrap(async (req, res) => {
    const result = await DeleteServiceRequest(Number(req.params.id), req.session.userId);
    res.status(result.error ? 400 : 200).json(result);
}));

router.post('/requests/:id/status', requireAuth, wrap(async (req, res) => {
    const result = await UpdateRequestStatus(Number(req.params.id), req.body.status);
    res.status(result.error ? 400 : 200).json(result);
}));

// writes - providers
router.post('/provider/profile', requireRole('provider'), wrap(async (req, res) => {
    const result = await UpdateProviderProfile(req.session.userId, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
}));

router.post('/provider/services', requireRole('provider'), wrap(async (req, res) => {
    const result = await UpdateProviderServices(req.session.userId, req.body.categories || []);
    res.status(result.error ? 400 : 200).json(result);
}));

router.post('/bookings', requireRole('provider'), wrap(async (req, res) => {
    const b = req.body || {};
    const result = await CreateBooking(
        Number(b.requestId), req.session.userId,
        b.scheduledStart, b.scheduledEnd, Number(b.agreedPrice)
    );
    res.status(result.error ? 400 : 200).json(result);
}));

router.post('/bookings/:id/status', requireAuth, wrap(async (req, res) => {
    const result = await UpdateBookingStatus(Number(req.params.id), req.body.status);
    res.status(result.error ? 400 : 200).json(result);
}));

// writes - clients only pay/review
router.post('/payments', requireRole('client'), wrap(async (req, res) => {
    const b = req.body || {};
    const result = await ProcessPayment(Number(b.bookingId), Number(b.amount), b.method);
    res.status(result.error ? 400 : 200).json(result);
}));

router.post('/reviews', requireRole('client'), wrap(async (req, res) => {
    const b = req.body || {};
    const result = await SubmitReview(Number(b.bookingId), Number(b.rating), b.comment);
    res.status(result.error ? 400 : 200).json(result);
}));

// provider background checks
router.get('/provider/checks', requireRole('provider'), wrap(async (req, res) => {
    res.json(await BackgroundCheckRetrieval(req.session.userId));
}));

router.post('/provider/checks', requireRole('provider'), wrap(async (req, res) => {
    const checkType = (req.body && req.body.check_type) || 'identity';
    const allowed = ['identity', 'background'];
    if (!allowed.includes(checkType)) return res.status(400).json({ error: 'bad check type' });
    const result = await SubmitBackgroundCheck(req.session.userId, checkType);
    res.status(result.error ? 400 : 200).json(result);
}));

// admin
router.get('/admin/stats', requireRole('admin'), wrap(async (req, res) => {
    res.json(await UserStatsRetrieval());
}));

router.get('/admin/users', requireRole('admin'), wrap(async (req, res) => {
    res.json(await AllUsersRetrieval());
}));

router.get('/admin/checks', requireRole('admin'), wrap(async (req, res) => {
    res.json(await AllBackgroundChecksRetrieval());
}));

router.post('/admin/checks/:id/status', requireRole('admin'), wrap(async (req, res) => {
    const result = await UpdateCheckStatus(Number(req.params.id), req.body && req.body.status);
    res.status(result.error ? 400 : 200).json(result);
}));

router.post('/admin/categories', requireRole('admin'), wrap(async (req, res) => {
    const result = await AddCategory(req.body && req.body.name);
    res.status(result.error ? 400 : 200).json(result);
}));

router.delete('/admin/categories/:id', requireRole('admin'), wrap(async (req, res) => {
    const result = await DeleteCategory(Number(req.params.id));
    res.status(result.error ? 400 : 200).json(result);
}));

// any thrown error -> json
router.use((err, req, res, next) => {
    console.error('api error:', err);
    res.status(500).json({ error: err.message || 'server error' });
});

module.exports = router;
