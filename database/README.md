# Barbr PostgreSQL Database Setup

This directory contains the PostgreSQL SQL files for the **Barbr** salon booking system database.

## Files

* [`01_schema.sql`](file:///Users/nikhilyadav/Documents/Projects/Barber/barber/database/01_schema.sql): Full PostgreSQL DDL schema containing tables, enums, foreign keys, indexes, and double-booking exclusion constraints.
* [`02_seed.sql`](file:///Users/nikhilyadav/Documents/Projects/Barber/barber/database/02_seed.sql): Initial seed data including system settings, branches, services, barbers, breaks, demo accounts, and sample bookings.

---

## How to Setup & Run

### 1. Requirements
* **PostgreSQL** v13 or higher.
* `contrib` package (for `uuid-ossp` and `btree_gist` extensions).

### 2. Create the Database

Using `psql` shell:

```bash
# Create database
createdb barbr_db

# Execute schema
psql -d barbr_db -f database/01_schema.sql

# Execute seed data
psql -d barbr_db -f database/02_seed.sql
```

---

## Database Schema Highlights

### Key Tables & Features
1. **`branches`**: Multi-branch support with `week_hours` stored as JSONB (minutes from midnight).
2. **`services` & `branch_services`**: Global catalog with per-branch price overrides (`price_override_inr`).
3. **`barbers` & `barber_breaks`**: Staff scheduling with lunch break windows.
4. **`bookings`**:
   - Primary key: `ref` (e.g. `BR-20481`).
   - `starts_at` & `ends_at` timestamps.
   - Slot reservation statuses: `PENDING_FEE`, `CONFIRMED`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
5. **Double-Booking Exclusion Constraint**:
   - Uses PostgreSQL `EXCLUDE USING gist` with `tstzrange` to mathematically prevent overlapping bookings for the same barber.
6. **`payments`**: Track simulated/real booking fees and refund states.
7. **`booking_events`**: Audit log for status changes and history.

---

## Connection & Integration with Next.js

Set your `.env.local` connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/barbr_db?schema=public"
```

You can interact with PostgreSQL using:
- **Prisma**: `npx prisma db pull`
- **Drizzle ORM**: `npx drizzle-kit introspect`
- **pg / postgres.js**: Direct SQL queries using node-postgres.
