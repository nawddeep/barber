-- =============================================================================
-- BARBR SALON BOOKING SYSTEM - SEED DATA (02_seed.sql)
-- =============================================================================

-- 1. Insert Initial System Settings
INSERT INTO settings (
    id, fee_inr, hold_mode, adjust_fee_in_bill, refund_on_early_cancel, 
    refund_window_hours, unpaid_hold_minutes, advance_booking_days, 
    require_fee_after_no_shows_enabled, require_fee_after_no_shows
) VALUES (
    1, 99, 'CUSTOMER_CHOOSES', TRUE, TRUE, 
    3, 10, 14, 
    TRUE, 2
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert Admin Users (Demo Credentials)
-- Password hash placeholder for 'demo1234'
INSERT INTO admin_users (email, password_hash, name, role) VALUES
('owner@barbr.demo', '$2a$10$demo1234placeholderhashforownerrole', 'Salon owner', 'OWNER'),
('staff@barbr.demo', '$2a$10$demo1234placeholderhashforstaffrole', 'Front desk', 'STAFF')
ON CONFLICT (email) DO NOTHING;

-- 3. Insert Branches
INSERT INTO branches (id, name, address, phone, week_hours, paused) VALUES
('main-street', 'Main Street', '12 Main Street, Indiranagar', '+91 80000 10001', 
 '[{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260}]'::jsonb, false),
('station-road', 'Station Road', '4 Station Road, Opp. Metro', '+91 80000 10002', 
 '[{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260}]'::jsonb, false),
('lake-view', 'Lake View', '88 Lake View Avenue', '+91 80000 10003', 
 '[{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260},{"open":600,"close":1260}]'::jsonb, false),
('city-mall', 'City Mall', 'Level 2, City Mall', '+91 80000 10004', 
 '[{"open":660,"close":1320},{"open":660,"close":1320},{"open":660,"close":1320},{"open":660,"close":1320},{"open":660,"close":1320},{"open":660,"close":1320},{"open":660,"close":1320}]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Services
INSERT INTO services (id, name, description, price_inr, duration_min, tint) VALUES
('hot-towel-shave', 'Hot Towel Shave', 'Steamed towels, classic razor, calm finish', 499, 40, 'yellow'),
('classic-haircut', 'Classic Haircut', 'Scissor and clipper finish', 299, 30, 'mint'),
('fade-styling', 'Fade & Styling', 'Skin, low, mid or high fade', 349, 40, 'peach'),
('beard-trim', 'Beard Trim', 'Shape, line-up and oil', 199, 20, 'lavender'),
('haircut-beard', 'Haircut + Beard', 'The full look in one slot', 449, 50, 'butter'),
('kids-haircut', 'Kids Haircut', 'For ages under 12', 199, 25, 'yellow')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Branch Services (with price overrides)
INSERT INTO branch_services (branch_id, service_id, price_override_inr) VALUES
('main-street', 'hot-towel-shave', NULL),
('main-street', 'classic-haircut', NULL),
('main-street', 'fade-styling', NULL),
('main-street', 'beard-trim', NULL),
('main-street', 'haircut-beard', NULL),
('main-street', 'kids-haircut', NULL),

('station-road', 'hot-towel-shave', NULL),
('station-road', 'classic-haircut', NULL),
('station-road', 'fade-styling', NULL),
('station-road', 'beard-trim', NULL),
('station-road', 'haircut-beard', NULL),
('station-road', 'kids-haircut', NULL),

('lake-view', 'hot-towel-shave', 449), -- Price override example
('lake-view', 'classic-haircut', NULL),
('lake-view', 'fade-styling', NULL),
('lake-view', 'beard-trim', NULL),
('lake-view', 'haircut-beard', NULL),
('lake-view', 'kids-haircut', NULL),

('city-mall', 'hot-towel-shave', NULL),
('city-mall', 'classic-haircut', NULL),
('city-mall', 'fade-styling', NULL),
('city-mall', 'beard-trim', NULL),
('city-mall', 'haircut-beard', NULL),
('city-mall', 'kids-haircut', NULL)
ON CONFLICT (branch_id, service_id) DO NOTHING;

-- 6. Insert Barbers
INSERT INTO barbers (id, branch_id, name, specialty, rating, retired) VALUES
('jhon-main-street', 'main-street', 'Jhon Abraham', 'Fades & classic cuts', 4.9, false),
('arjun-main-street', 'main-street', 'Arjun Mehta', 'Styling & texture', 4.8, false),
('kabir-main-street', 'main-street', 'Kabir Khan', 'Beard sculpting', 4.9, false),
('dev-main-street', 'main-street', 'Dev Sharma', 'Hot towel shaves', 4.7, false),

('jhon-station-road', 'station-road', 'Jhon Abraham', 'Fades & classic cuts', 4.9, false),
('arjun-station-road', 'station-road', 'Arjun Mehta', 'Styling & texture', 4.8, false),
('kabir-station-road', 'station-road', 'Kabir Khan', 'Beard sculpting', 4.9, false),

('arjun-lake-view', 'lake-view', 'Arjun Mehta', 'Styling & texture', 4.8, false),
('kabir-lake-view', 'lake-view', 'Kabir Khan', 'Beard sculpting', 4.9, false),
('dev-lake-view', 'lake-view', 'Dev Sharma', 'Hot towel shaves', 4.7, false),

('kabir-city-mall', 'city-mall', 'Kabir Khan', 'Beard sculpting', 4.9, false),
('dev-city-mall', 'city-mall', 'Dev Sharma', 'Hot towel shaves', 4.7, false)
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Barber Breaks (Lunch 1 PM to 2 PM -> 780 to 840 minutes)
INSERT INTO barber_breaks (id, barber_id, start_min, end_min) VALUES
('lunch-jhon-main-street', 'jhon-main-street', 780, 840),
('lunch-arjun-main-street', 'arjun-main-street', 780, 840),
('lunch-kabir-main-street', 'kabir-main-street', 780, 840),
('lunch-dev-main-street', 'dev-main-street', 780, 840),
('lunch-jhon-station-road', 'jhon-station-road', 780, 840),
('lunch-arjun-station-road', 'arjun-station-road', 780, 840),
('lunch-kabir-station-road', 'kabir-station-road', 780, 840),
('lunch-arjun-lake-view', 'arjun-lake-view', 780, 840),
('lunch-kabir-lake-view', 'kabir-lake-view', 780, 840),
('lunch-dev-lake-view', 'dev-lake-view', 780, 840),
('lunch-kabir-city-mall', 'kabir-city-mall', 780, 840),
('lunch-dev-city-mall', 'dev-city-mall', 780, 840)
ON CONFLICT (id) DO NOTHING;

-- 8. Insert Sample Customers
INSERT INTO customers (phone, name) VALUES
('9876543210', 'Aarav Mehta'),
('9712345604', 'Karan Bhatia'),
('9000000001', 'Test Repeat')
ON CONFLICT (phone) DO NOTHING;

-- 9. Insert Featured Sample Booking (Aarav Mehta - Hot Towel Shave)
INSERT INTO bookings (
    ref, branch_id, service_id, barber_id, customer_phone, customer_name,
    starts_at, ends_at, status, hold_method, hold_expires_at, price_inr, fee_inr
) VALUES (
    'BR-20481', 'main-street', 'hot-towel-shave', 'jhon-main-street', '9876543210', 'Aarav Mehta',
    CURRENT_DATE + TIME '14:30', CURRENT_DATE + TIME '15:10', 'CONFIRMED', 'FEE', NULL, 499, 99
) ON CONFLICT (ref) DO NOTHING;

INSERT INTO booking_events (booking_ref, type, note) VALUES
('BR-20481', 'CREATED', 'Booking created on website'),
('BR-20481', 'FEE_RECEIVED', '₹99 fee received'),
('BR-20481', 'CONFIRMED', 'Booking confirmed');

INSERT INTO payments (id, booking_ref, amount_inr, method, status) VALUES
('pay-1', 'BR-20481', 99, 'UPI', 'PAID')
ON CONFLICT (id) DO NOTHING;
