// input checks

const RATE_LOWER = 0;
const RATE_UPPER = 999.99;
const RADIUS_LOWER = 1;
const RADIUS_UPPER = 500;
const RATING_MIN = 1;
const RATING_MAX = 5;
const PASSWORD_MIN = 8;

function ValidateEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ValidateZipCode(zip) {
    if (!zip) return false;
    return /^\d{5}$/.test(zip);
}

function ValidateRate(rate) {
    const n = Number(rate);
    if (Number.isNaN(n)) return false;
    return n >= RATE_LOWER && n <= RATE_UPPER;
}

function ValidateRadius(miles) {
    const n = Number(miles);
    if (!Number.isInteger(n)) return false;
    return n >= RADIUS_LOWER && n <= RADIUS_UPPER;
}

function ValidateBookingDates(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s) || isNaN(e)) return false;
    if (s >= e) return false;
    // 60s tolerance so slow form fills aren't rejected
    if (s < new Date(Date.now() - 60 * 1000)) return false;
    return true;
}

// looser - just start < end
function ValidateDateRange(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s) || isNaN(e)) return false;
    return s < e;
}

function ValidatePaymentAmount(amount, agreed) {
    const a = Number(amount);
    const g = Number(agreed);
    if (Number.isNaN(a) || Number.isNaN(g)) return false;
    if (a <= 0) return false;
    return Number(a.toFixed(2)) === Number(g.toFixed(2));
}

function ValidateRating(rating) {
    const n = Number(rating);
    if (!Number.isInteger(n)) return false;
    return n >= RATING_MIN && n <= RATING_MAX;
}

function ValidatePassword(pw) {
    if (typeof pw !== 'string') return false;
    return pw.length >= PASSWORD_MIN;
}

module.exports = {
    ValidateEmail, ValidateZipCode, ValidateRate, ValidateRadius,
    ValidateBookingDates, ValidateDateRange, ValidatePaymentAmount, ValidateRating, ValidatePassword,
    RATE_LOWER, RATE_UPPER, RADIUS_LOWER, RADIUS_UPPER, RATING_MIN, RATING_MAX, PASSWORD_MIN
};
