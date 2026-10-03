# Barbr: frontend-only salon booking site

You are building the FRONTEND ONLY of "Barbr", a booking website for a salon business with multiple branches. There is no backend in this project. Do not add a database, ORM, server actions that store data, or any real third-party service.

## Product
- Customers book a slot: pick a branch from a dropdown, pick a service, pick a date, time and barber, then hold the slot by EITHER paying a small booking fee OR verifying their phone number with an OTP. The owner decides which options are offered.
- The owner has an admin panel to track bookings, see a barber calendar, and control branches and fee rules.
- Surfaces: landing page, 4-step booking flow, owner admin panel. Everything must also work well on a 390px-wide phone.

## Stack
Next.js (App Router) + TypeScript, Tailwind CSS, Zustand (localStorage persistence for the demo; sessionStorage for the booking wizard), React Hook Form + zod, date-fns, Vitest (unit), Playwright (e2e). Deploy to Vercel as a demo.
Not included on purpose: database, Prisma, Razorpay, SMS provider, real login, cron jobs.

## Frontend-only rules
- All data comes from a mock service layer in /lib/api. Every function is async, typed, returns after a fake delay (300 to 600 ms), and can fail on purpose in a "simulate errors" dev mode.
- Mock data lives in /lib/mock and is persisted in localStorage, so a booking made on the public flow appears in admin and a fee change in admin changes the public flow. "Reset demo data" button in the admin footer.
- Payment and OTP are SIMULATED: a fake payment sheet that looks like a checkout and always succeeds unless dev error mode is on; OTP accepts "4815" and shows it in a small dev hint under the input. Mark every simulated spot with a `// MOCK:` comment so it can be found with one search.
- Admin login is a mock screen with demo credentials shown on the page (owner@barbr.demo / demo1234; staff@barbr.demo / demo1234), clearly labelled demo.

## Design reference
Screenshots are in /design. Match them closely. If a screenshot and this brief disagree, the screenshot wins for look and layout; this brief wins for behaviour.

### Screenshot mapping
Folder: /design. Always use the file this table maps to a screen.

| Screen | File |
|---|---|
| Landing (top: hero, quick-book, popular services) | Screenshot 2026-10-02 at 3.53.07 PM.png |
| Landing (middle: combo card, how it works, branches, barbers heading) | Screenshot 2026-10-02 at 3.53.21 PM.png |
| Landing (bottom: barbers, "Hold your slot your way", footer) | Screenshot 2026-10-02 at 3.53.28 PM.png |
| Booking step 1: branch and service | Screenshot 2026-10-02 at 3.53.35 PM.png |
| Booking step 2: date, time, barber | Screenshot 2026-10-02 at 3.53.43 PM.png |
| Booking step 3: details and hold fee | Screenshot 2026-10-02 at 3.53.51 PM.png |
| Booking step 4: confirmed | Screenshot 2026-10-02 at 3.53.59 PM.png |
| Admin dashboard | Screenshot 2026-10-02 at 3.54.06 PM.png |
| Admin bookings | Screenshot 2026-10-02 at 3.54.19 PM.png |
| Admin calendar | Screenshot 2026-10-02 at 3.54.30 PM.png |
| Admin branches and fees | Screenshot 2026-10-02 at 3.54.40 PM.png |
| Mobile home | Screenshot 2026-10-02 at 3.54.49 PM.png |
| Mobile pick slot | Screenshot 2026-10-02 at 3.54.57 PM.png |
| Mobile confirm and pay | Screenshot 2026-10-02 at 3.55.07 PM.png |

All 12 screens have a screenshot. The landing page is a full-page capture split across three files. No admin screen has a mobile screenshot (admin mobile layout is derived from the brief).

### Differences noticed between screenshots and brief
- Dashboard/"Up next" uses chip labels "Fee paid" and "OTP verified" in addition to the status chips below. Treat them as hold-method labels on CONFIRMED bookings: "Fee paid" = green confirmed style, "OTP verified" = butter style.
- Screenshots say OTP slots are held "15 minutes" while the brief says unpaid fee holds expire after 10 minutes. Keep the setting `unpaidHoldMinutes` (10/15/30, default 10) and use it for copy.
- Step 2 mock shows 2 Oct as "Today" and 3 Oct selected; seed data is generated relative to the real today.
- Mobile screenshots contain a few rendering glitches (overlapping icon on the branch select, double back arrow, clipped rating chip). Do not copy these.
- Photos in the screenshots are placeholders (one hero shave photo, four barber portraits, an owner portrait).

## Design tokens (Tailwind v4: `@theme` block in app/globals.css, mirrored in lib/tokens.ts; there is no tailwind.config)
- Colours: green #2A5C4A (primary), dark green #1E4536, yellow #F8DC55, butter #FFF79F, orange #E8732A, cream #FBF7F0, cream-2 #F3ECDD, admin background #F6F1E6, ink #1B2B25, muted #5E7068, blue #3F6FE0, border #E6DDCA. Darker orange for small text on cream: #B84E0C.
- Status chips: Confirmed bg #BFE3D0 text #14382A; Fee pending bg #FFF79F text #4A3F00; In service bg #F5B58B text #4A1D04; Completed bg #E6E0D0 text #3A3626; Cancelled and No-show bg #FBE0D4 text #7A3306.
- Fonts via next/font: "Bagel Fat One" for logo, headings and big numbers; "DM Sans" (400, 500, 700) for everything else. Never use the display font for small text or tables.
- Shapes: very round. Cards radius 28 to 40px, buttons and chips pill-shaped, inputs radius 18px. Signature "flower" shape: eight circles around a centre circle, used as a clip-path for icon tiles and images (SVG clipPath, objectBoundingBox units: centre circle r=.3 at .5,.5; eight r=.2 circles at distance .3 from the centre).
- Buttons: primary = green bg, white text; secondary = yellow bg, dark green text; accent = orange bg with INK text (not white).
- Currency INR (₹). Dates like "Sat, 3 Oct". Times like "2:30 PM".
- Accessibility: real buttons, links, labels on every input, aria-label on icon-only buttons, text contrast 4.5:1, tap targets at least 44px.

## Routes
```
/                       landing page
/book/branch            step 1
/book/slot              step 2
/book/details           step 3
/book/confirmed/[ref]   step 4
/admin/login
/admin                  dashboard
/admin/bookings
/admin/calendar
/admin/branches
```

## Business rules (implemented in the mock layer)
- Booking fee default ₹99, adjusted in the final bill (customer pays service price minus fee at the salon).
- Hold modes: FEE_ONLY, OTP_ONLY, CUSTOMER_CHOOSES.
- Unpaid fee holds expire after 10 minutes and the slot is released (countdown plus client-side timer).
- Free cancellation up to 3 hours before the slot, with the fee refunded (simulated). After that, no refund.
- After 2 no-shows, a customer who chose OTP only must pay the fee next time.
- Customers can book up to 14 days ahead. Slot grid is 30 minutes. A service occupies as many consecutive slots as its duration needs.
- A barber can never be double-booked: the mock layer must reject an overlapping booking.

## Sample data
Branches: Main Street (10 AM to 9 PM), Station Road (10 AM to 9 PM), Lake View (10 AM to 9 PM), City Mall (11 AM to 10 PM, paused).
Services: Hot Towel Shave ₹499 40 min; Classic Haircut ₹299 30 min; Fade & Styling ₹349 40 min; Beard Trim ₹199 20 min; Haircut + Beard ₹449 50 min; Kids Haircut ₹199 25 min.
Barbers: Jhon Abraham (Fades), Arjun Mehta (Styling), Kabir Khan (Beards), Dev Sharma (Hot towel shaves). Lunch break 1 PM to 2 PM.
Seed about 40 bookings across today and the next 7 days in all statuses, so the admin screens look full.

## Working rules
- Work in small steps. After each phase run lint, type-check and tests, then summarise what changed and what to check by eye.
- Do not add libraries that were not asked for without saying why.
- No lorem ipsum. Use the sample data.
- Ask before anything destructive.
- Next.js here is v16 / React 19 / Tailwind 4: read node_modules/next/dist/docs before using unfamiliar APIs. Use `npx next typegen` if `LayoutProps` is missing.
- Phases come from "Barbr_frontend_phases.md" in the project root. Run one at a time, in order.
