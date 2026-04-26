-- seed data, run after schema.sql
-- safe to re-run, wipes everything first

TRUNCATE TABLE
    reviews, payments, bookings, service_requests,
    provider_services, service_categories, background_checks,
    client_profiles, provider_profiles, users
RESTART IDENTITY CASCADE;

-- categories
INSERT INTO service_categories (category_name) VALUES
    ('Plumbing'),
    ('Cleaning'),
    ('HVAC'),
    ('Electrical'),
    ('Landscaping'),
    ('Painting'),
    ('Appliance Repair'),
    ('Pest Control');

-- placeholder hashes, replace with real ones via npm run db:rehash
INSERT INTO users (first_name, last_name, email, phone, password_hash, role_type) VALUES
    ('Jane', 'Doe', 'jane@test.com', '555-0101', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'provider'),
    ('Joe', 'Plumber', 'joe@test.com', '555-0102', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'provider'),
    ('Mike', 'HVAC', 'mike@test.com', '555-0103', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'provider'),
    ('Kassie', 'Client', 'kassie@test.com', '555-0201', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'client'),
    ('Paul', 'Client', 'paul@test.com', '555-0202', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'client'),
    ('Joey', 'Both', 'joey@test.com', '555-0203', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'both'),
    ('Mario', 'Admin', 'admin@test.com', '555-0001', '$2b$10$placeholderhashplaceholderhashplaceholderhashplaceholde', 'admin');

-- providers (Jane=1, Joe=2, Mike=3, Joey=6)
INSERT INTO provider_profiles (provider_id, bio, home_zip, travel_radius_miles, base_rate, verified_status) VALUES
    (1, 'Experienced house cleaner, 10+ years.', '77550', 25, 45.00, 'verified'),
    (2, 'Licensed plumber. Leaks, installs, repairs.', '77551', 30, 75.00, 'verified'),
    (3, 'HVAC + electrical, certified.', '77554', 40, 90.00, 'unverified'),
    (6, 'Handyman - small jobs welcome.', '77550', 15, 40.00, 'unverified');

-- clients (Kassie=4, Paul=5, Joey=6)
INSERT INTO client_profiles (client_id) VALUES (4), (5), (6);

-- which providers offer what
INSERT INTO provider_services (provider_id, category_id, starting_price, notes) VALUES
    (1, 2, 45.00, 'Standard cleaning visit, 2hr min'),
    (2, 1, 75.00, 'Diagnostic fee waived if hired'),
    (3, 3, 90.00, 'Service call $90'),
    (3, 4, 90.00, NULL),
    (6, 2, 40.00, NULL),
    (6, 6, 50.00, 'Interior only');

-- some background checks
INSERT INTO background_checks (user_id, check_type, status, requested_at, completed_at) VALUES
    (1, 'identity', 'approved', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days'),
    (2, 'identity', 'approved', NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days'),
    (2, 'background', 'approved', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days'),
    (3, 'identity', 'pending', NOW() - INTERVAL '2 days', NULL);

-- a few requests
INSERT INTO service_requests
    (client_id, category_id, description, street, city, state, zip, preferred_start, preferred_end, status) VALUES
    (4, 1, 'Kitchen sink leaking under cabinet.', '123 Seawall Blvd', 'Galveston', 'TX', '77550',
        NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 2 hours', 'open'),
    (4, 2, 'Biweekly house cleaning, 3 bed / 2 bath.', '123 Seawall Blvd', 'Galveston', 'TX', '77550',
        NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 3 hours', 'open'),
    (5, 3, 'AC not cooling, makes noise on startup.', '789 Broadway St', 'Galveston', 'TX', '77554',
        NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', 'booked');

-- request 3 booked with Mike, marked completed so we can test payment+review
INSERT INTO bookings (request_id, provider_id, scheduled_start, scheduled_end, agreed_price, status) VALUES
    (3, 3, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', 180.00, 'completed');

INSERT INTO payments (booking_id, amount, method, status, paid_at) VALUES
    (1, 180.00, 'credit_card', 'completed', NOW());

INSERT INTO reviews (booking_id, rating, comment) VALUES
    (1, 5, 'Mike fixed the AC quickly and explained everything. Highly recommend.');

-- sanity check
SELECT 'users' AS t, COUNT(*) FROM users UNION ALL
SELECT 'provider_profiles', COUNT(*) FROM provider_profiles UNION ALL
SELECT 'client_profiles', COUNT(*) FROM client_profiles UNION ALL
SELECT 'background_checks', COUNT(*) FROM background_checks UNION ALL
SELECT 'service_categories', COUNT(*) FROM service_categories UNION ALL
SELECT 'provider_services', COUNT(*) FROM provider_services UNION ALL
SELECT 'service_requests', COUNT(*) FROM service_requests UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings UNION ALL
SELECT 'payments', COUNT(*) FROM payments UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews;
