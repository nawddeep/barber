-- =============================================================================
-- BARBR SALON BOOKING SYSTEM - POSTGRESQL SCHEMA (01_schema.sql)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop existing tables/types if re-running script (optional cleanup)
DROP TABLE IF EXISTS booking_events CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS barber_breaks CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS branch_services CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS hold_method CASCADE;
DROP TYPE IF EXISTS hold_mode CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS admin_role CASCADE;

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
CREATE TYPE booking_status AS ENUM (
  'PENDING_FEE', 
  'CONFIRMED', 
  'IN_SERVICE', 
  'COMPLETED', 
  'CANCELLED', 
  'NO_SHOW'
);

CREATE TYPE hold_method AS ENUM ('FEE', 'OTP', 'NONE');
CREATE TYPE hold_mode AS ENUM ('FEE_ONLY', 'OTP_ONLY', 'CUSTOMER_CHOOSES');
CREATE TYPE payment_method AS ENUM ('UPI', 'CARD', 'NETBANKING', 'CASH');
CREATE TYPE payment_status AS ENUM ('PAID', 'REFUNDED', 'REFUND_DUE', 'FAILED');
CREATE TYPE admin_role AS ENUM ('OWNER', 'STAFF');

-- -----------------------------------------------------------------------------
-- 1. BRANCHES
-- Stores salon locations and operating hours per day of week (minutes from midnight).
-- -----------------------------------------------------------------------------
CREATE TABLE branches (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    week_hours JSONB NOT NULL, -- Array of 7 day objects: [{"open": 600, "close": 1260} | null]
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. SERVICES
-- Master catalog of salon services.
-- -----------------------------------------------------------------------------
CREATE TABLE services (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price_inr INTEGER NOT NULL CHECK (price_inr >= 0),
    duration_min INTEGER NOT NULL CHECK (duration_min > 0),
    tint VARCHAR(20) NOT NULL DEFAULT 'yellow',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. BRANCH SERVICES (Junction table with price overrides per branch)
-- -----------------------------------------------------------------------------
CREATE TABLE branch_services (
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    service_id VARCHAR(50) REFERENCES services(id) ON DELETE CASCADE,
    price_override_inr INTEGER CHECK (price_override_inr >= 0),
    PRIMARY KEY (branch_id, service_id)
);

-- -----------------------------------------------------------------------------
-- 4. BARBERS
-- Staff members assigned to branches.
-- -----------------------------------------------------------------------------
CREATE TABLE barbers (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    rating NUMERIC(2, 1) NOT NULL DEFAULT 5.0 CHECK (rating >= 1.0 AND rating <= 5.0),
    retired BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. BARBER BREAKS
-- Daily recurring break times for barbers (e.g. lunch 780m - 840m).
-- -----------------------------------------------------------------------------
CREATE TABLE barber_breaks (
    id VARCHAR(50) PRIMARY KEY,
    barber_id VARCHAR(50) NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
    end_min INTEGER NOT NULL CHECK (end_min > start_min AND end_min <= 1440)
);

-- -----------------------------------------------------------------------------
-- 6. CUSTOMERS
-- Customer profiles identified by 10-digit phone number.
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
    phone VARCHAR(10) PRIMARY KEY CHECK (phone ~ '^\d{10}$'),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. BOOKINGS
-- Main appointment table.
-- -----------------------------------------------------------------------------
CREATE TABLE bookings (
    ref VARCHAR(20) PRIMARY KEY, -- Human-readable ref e.g. "BR-20481"
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    service_id VARCHAR(50) NOT NULL REFERENCES services(id),
    barber_id VARCHAR(50) NOT NULL REFERENCES barbers(id),
    customer_phone VARCHAR(10) NOT NULL REFERENCES customers(phone),
    customer_name VARCHAR(100) NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status booking_status NOT NULL DEFAULT 'PENDING_FEE',
    hold_method hold_method NOT NULL,
    hold_expires_at TIMESTAMP WITH TIME ZONE,
    price_inr INTEGER NOT NULL CHECK (price_inr >= 0),
    fee_inr INTEGER NOT NULL DEFAULT 0 CHECK (fee_inr >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_booking_duration CHECK (ends_at > starts_at)
);

-- EXCLUSION CONSTRAINT: Prevents double-booking overlapping time slots for the same barber
ALTER TABLE bookings ADD CONSTRAINT prevent_barber_double_booking
EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
) WHERE (status IN ('CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'PENDING_FEE'));

-- -----------------------------------------------------------------------------
-- 8. BOOKING EVENTS
-- Audit log of status transitions and changes.
-- -----------------------------------------------------------------------------
CREATE TABLE booking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_ref VARCHAR(20) NOT NULL REFERENCES bookings(ref) ON DELETE CASCADE,
    at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL,
    note TEXT,
    from_status booking_status
);

-- -----------------------------------------------------------------------------
-- 9. PAYMENTS
-- Payments & refunds linked 1:1 with bookings.
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    booking_ref VARCHAR(20) UNIQUE NOT NULL REFERENCES bookings(ref) ON DELETE CASCADE,
    amount_inr INTEGER NOT NULL CHECK (amount_inr >= 0),
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'PAID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 10. SYSTEM SETTINGS
-- Single-row table storing business rules & booking parameters.
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    fee_inr INTEGER NOT NULL DEFAULT 99,
    hold_mode hold_mode NOT NULL DEFAULT 'CUSTOMER_CHOOSES',
    adjust_fee_in_bill BOOLEAN NOT NULL DEFAULT TRUE,
    refund_on_early_cancel BOOLEAN NOT NULL DEFAULT TRUE,
    refund_window_hours INTEGER NOT NULL DEFAULT 3,
    unpaid_hold_minutes INTEGER NOT NULL DEFAULT 10,
    advance_booking_days INTEGER NOT NULL DEFAULT 14,
    require_fee_after_no_shows_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    require_fee_after_no_shows INTEGER NOT NULL DEFAULT 2
);

-- -----------------------------------------------------------------------------
-- 11. ADMIN USERS
-- Salon staff and owner account authentication.
-- -----------------------------------------------------------------------------
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role admin_role NOT NULL DEFAULT 'STAFF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 12. OTP VERIFICATIONS
-- Transient OTP verification state per phone number.
-- -----------------------------------------------------------------------------
CREATE TABLE otp_verifications (
    phone VARCHAR(10) PRIMARY KEY CHECK (phone ~ '^\d{10}$'),
    wrong_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    verified_until TIMESTAMP WITH TIME ZONE
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR FAST QUERYING
-- -----------------------------------------------------------------------------
-- Slot availability check index (barber + start/end)
CREATE INDEX idx_bookings_barber_slot ON bookings (barber_id, starts_at, ends_at)
WHERE status IN ('CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'PENDING_FEE');

-- Admin dashboard index (branch + date filter)
CREATE INDEX idx_bookings_branch_starts ON bookings (branch_id, starts_at);

-- No-show tracking index for customer phone
CREATE INDEX idx_bookings_customer_noshow ON bookings (customer_phone, status)
WHERE status = 'NO_SHOW';

-- Pending hold expiry index for background cleanup
CREATE INDEX idx_bookings_hold_expiry ON bookings (hold_expires_at)
WHERE status = 'PENDING_FEE';
