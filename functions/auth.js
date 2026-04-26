// login, register, sessions
const bcrypt = require('bcrypt');
const { ExecuteQuery } = require('../db');
const { ValidateEmail, ValidatePassword } = require('./validation');

async function Authorize(email, password) {
    if (!email || !password) return false;
    const rows = await ExecuteQuery(
        'SELECT user_id, first_name, role_type, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
    );
    if (rows.length === 0) return false;
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return false;
    return { user_id: u.user_id, role_type: u.role_type, first_name: u.first_name };
}

async function RegisterUser(firstName, lastName, email, phone, password, roleType) {
    if (!ValidateEmail(email)) return { error: 'invalid email' };
    if (!ValidatePassword(password)) return { error: 'password too short' };
    const allowed = ['client', 'provider', 'both'];
    if (!allowed.includes(roleType)) return { error: 'bad role' };

    const dup = await ExecuteQuery('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (dup.length > 0) return { error: 'email already in use' };

    const hash = await bcrypt.hash(password, 10);
    const inserted = await ExecuteQuery(
        `INSERT INTO users (first_name, last_name, email, phone, password_hash, role_type)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id`,
        [firstName, lastName, email, phone, hash, roleType]
    );
    const userId = inserted[0].user_id;

    if (roleType === 'provider' || roleType === 'both') {
        await ExecuteQuery('INSERT INTO provider_profiles (provider_id) VALUES ($1)', [userId]);
    }
    if (roleType === 'client' || roleType === 'both') {
        await ExecuteQuery('INSERT INTO client_profiles (client_id) VALUES ($1)', [userId]);
    }
    return { user_id: userId };
}

async function GetUserRole(userId) {
    const rows = await ExecuteQuery('SELECT role_type FROM users WHERE user_id = $1', [userId]);
    return rows[0] ? rows[0].role_type : null;
}

function CreateSession(req, user, ip) {
    req.session.userId = user.user_id;
    req.session.role = user.role_type;
    req.session.firstName = user.first_name;
    req.session.ip = ip;
    req.session.loginTime = new Date();
}

function DestroySession(req) {
    return new Promise((resolve) => req.session.destroy(() => resolve()));
}

// not actually emailing yet
async function ResetPassword(email) {
    const rows = await ExecuteQuery('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return rows.length > 0;
}

module.exports = { Authorize, RegisterUser, GetUserRole, CreateSession, DestroySession, ResetPassword };
