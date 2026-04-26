-- HomeNeedsService.com schema (postgres)

-- drop in child->parent order
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS provider_services CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;
DROP TABLE IF EXISTS background_checks CASCADE;
DROP TABLE IF EXISTS client_profiles CASCADE;
DROP TABLE IF EXISTS provider_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- base accounts
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(40) NOT NULL,
    last_name VARCHAR(40) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('client','provider','both','admin')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- provider info, pk is also fk to users
CREATE TABLE provider_profiles (
    provider_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    bio TEXT,
    home_zip VARCHAR(10),
    travel_radius_miles INT,
    base_rate NUMERIC(8,2),
    verified_status VARCHAR(20) DEFAULT 'unverified'
);

-- client info, pk is also fk to users
CREATE TABLE client_profiles (
    client_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE
);

-- a user can have multiple checks
CREATE TABLE background_checks (
    check_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    check_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- list of services we support
CREATE TABLE service_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(60) NOT NULL UNIQUE
);

-- bridge table, providers <-> categories
CREATE TABLE provider_services (
    provider_id INT NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES service_categories(category_id) ON DELETE CASCADE,
    starting_price NUMERIC(8,2),
    notes VARCHAR(255),
    PRIMARY KEY (provider_id, category_id)
);

-- client posts a request
CREATE TABLE service_requests (
    request_id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES client_profiles(client_id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES service_categories(category_id),
    description TEXT,
    street VARCHAR(120),
    city VARCHAR(60),
    state CHAR(2),
    zip VARCHAR(10),
    preferred_start TIMESTAMP,
    preferred_end TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','booked','closed','cancelled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- one booking per request (UNIQUE)
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    request_id INT NOT NULL UNIQUE REFERENCES service_requests(request_id) ON DELETE CASCADE,
    provider_id INT NOT NULL REFERENCES provider_profiles(provider_id),
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    agreed_price NUMERIC(8,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- one payment per booking (UNIQUE)
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
    amount NUMERIC(8,2) NOT NULL,
    method VARCHAR(20) NOT NULL CHECK (method IN ('credit_card','debit','cash','other')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
    paid_at TIMESTAMP
);

-- one review per booking (UNIQUE)
CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- indexes for the common lookups
CREATE INDEX idx_service_requests_client ON service_requests(client_id);
CREATE INDEX idx_service_requests_category ON service_requests(category_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_bookings_provider ON bookings(provider_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_provider_services_category ON provider_services(category_id);
CREATE INDEX idx_background_checks_user ON background_checks(user_id);
