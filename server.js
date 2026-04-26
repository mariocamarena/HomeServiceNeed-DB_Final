// main express server
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool, ExecuteQuery } = require('./db');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// needed for secure cookies on render
app.set('trust proxy', 1);

const isProd = process.env.NODE_ENV === 'production';

app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8,
        secure: isProd,
        sameSite: 'lax'
    }
}));

// quick check that db is reachable
app.get('/health', async (req, res) => {
    try {
        const rows = await ExecuteQuery('SELECT NOW() AS now, COUNT(*)::int AS users FROM users');
        res.json({ status: 'ok', db_time: rows[0].now, user_count: rows[0].users });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.use('/api', apiRouter);

// single page shell
app.get('/', (req, res) => res.render('index'));

app.listen(PORT, () => {
    console.log(`server on http://localhost:${PORT}`);
});
