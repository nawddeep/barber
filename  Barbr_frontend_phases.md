# Barbr salon booking: frontend-only Claude Code prompts

These prompts build only the frontend. There is no real database, payment gateway or SMS service. Everything runs on mock data behind a typed service layer, so a backend developer can later replace the mock layer without touching the screens.

Paste one phase at a time, in order. Finish and check each phase before the next.

## Before you start

1. Make an empty project folder, open Claude Code in it, and keep your screenshots in a folder named `design` in the same folder.
2. Phase 0 asks Claude Code to match each screenshot to its screen, so file names don't matter.
3. The 12 screens are: landing; booking step 1 (branch and service); step 2 (date, time, barber); step 3 (details and hold fee); step 4 (confirmed); admin dashboard; admin bookings; admin calendar; admin branches and fees; mobile home; mobile pick slot; mobile confirm and pay.

## Stack (frontend only)

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Zustand for state, with localStorage persistence for the demo
- React Hook Form + zod for forms
- date-fns for dates
- Vitest for unit tests, Playwright for end-to-end tests
- Deploy to Vercel as a static or server-rendered demo

Not included on purpose: database, Prisma, Razorpay, SMS provider, real login, cron jobs.

---

## Phase 0: Brief and rules (run first)

```
You are building the FRONTEND ONLY of "Barbr", a booking website for a salon business with multiple branches. There is no backend in this project. Read this whole brief and save it as /CLAUDE.md so it applies to every later session. Do not write app code yet.

PRODUCT
- Customers book a slot: pick a branch from a dropdown, pick a service, pick a date, time and barber, then hold the slot by EITHER paying a small booking fee OR verifying their phone number with an OTP. The owner decides which options are offered.
- The owner has an admin panel to track bookings, see a barber calendar, and control branches and fee rules.
- Surfaces: landing page, 4-step booking flow, owner admin panel. Everything must also work well on a 390px-wide phone.

FRONTEND-ONLY RULES
- All data comes from a mock service layer in /lib/api. Every function is async, typed, returns after a short fake delay (300 to 600 ms), and can fail on purpose in a "simulate errors" dev mode.
- Mock data lives in /lib/mock and is persisted in localStorage, so a booking made on the public flow appears in the admin panel and a fee change in admin changes the public flow. Add a "Reset demo data" button in the admin footer.
- Payment and OTP are SIMULATED: a fake payment sheet that looks like a checkout and always succeeds unless the dev error mode is on; OTP accepts "4815" and shows it in a small dev hint under the input. Mark every simulated spot with a "// MOCK:" comment so a backend developer can find them with one search.
- Admin login is a mock screen with demo credentials shown on the page (owner@barbr.demo / demo1234). Clearly label it as demo.
- Do not add a database, ORM, server actions that store data, or any real third-party service.

DESIGN REFERENCE
Screenshots are in /design. Match them closely. If a screenshot and this brief disagree, the screenshot wins for look and layout; this brief wins for behaviour.

SCREENSHOT MAPPING
First list every file in /design and look at each image. Match them to the 12 screens: landing; booking step 1; step 2; step 3; step 4; admin dashboard; admin bookings; admin calendar; admin branches and fees; mobile home; mobile pick slot; mobile confirm and pay. Save the mapping in /CLAUDE.md as a table. Later prompts refer to screens by name: always use the file this table maps to that screen. If a screen has no screenshot, tell me.

DESIGN TOKENS (put in tailwind.config and a tokens file)
- Colours: green #2A5C4A (primary), dark green #1E4536, yellow #F8DC55, butter #FFF79F, orange #E8732A, cream #FBF7F0, cream-2 #F3ECDD, admin background #F6F1E6, ink #1B2B25, muted #5E7068, blue #3F6FE0, border #E6DDCA. Darker orange for small text on cream: #B84E0C.
- Status chips: Confirmed bg #BFE3D0 text #14382A; Fee pending bg #FFF79F text #4A3F00; In service bg #F5B58B text #4A1D04; Completed bg #E6E0D0 text #3A3626; Cancelled and No-show bg #FBE0D4 text #7A3306.
- Fonts via next/font: "Bagel Fat One" for logo, headings and big numbers; "DM Sans" (400, 500, 700) for everything else. Never use the display font for small text or tables.
- Shapes: very round. Cards radius 28 to 40px, buttons and chips pill-shaped, inputs radius 18px. Signature "flower" shape: eight circles around a centre circle, used as a clip-path for icon tiles and images (SVG clipPath with objectBoundingBox units: centre circle r=.3 at .5,.5; eight r=.2 circles at distance .3 from the centre).
- Buttons: primary = green bg, white text; secondary = yellow bg, dark green text; accent = orange bg with INK text (not white).
- Currency INR (₹). Dates like "Sat, 3 Oct". Times like "2:30 PM".
- Accessibility: real buttons, links, labels on every input, aria-label on icon-only buttons, text contrast 4.5:1, tap targets at least 44px.

ROUTES
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

BUSINESS RULES (implemented in the mock layer)
- Booking fee default ₹99, adjusted in the final bill (customer pays service price minus fee at the salon).
- Hold modes: FEE_ONLY, OTP_ONLY, CUSTOMER_CHOOSES.
- Unpaid fee holds expire after 10 minutes and the slot is released (simulate with a countdown and a client-side timer).
- Free cancellation up to 3 hours before the slot, with the fee refunded (simulated). After that, no refund.
- After 2 no-shows, a customer who chose OTP only must pay the fee next time.
- Customers can book up to 14 days ahead. Slot grid is 30 minutes. A service occupies as many consecutive slots as its duration needs.
- A barber can never be double-booked: the mock layer must reject an overlapping booking.

SAMPLE DATA
Branches: Main Street (10 AM to 9 PM), Station Road (10 AM to 9 PM), Lake View (10 AM to 9 PM), City Mall (11 AM to 10 PM, paused).
Services: Hot Towel Shave ₹499 40 min; Classic Haircut ₹299 30 min; Fade & Styling ₹349 40 min; Beard Trim ₹199 20 min; Haircut + Beard ₹449 50 min; Kids Haircut ₹199 25 min.
Barbers: Jhon Abraham (Fades), Arjun Mehta (Styling), Kabir Khan (Beards), Dev Sharma (Hot towel shaves). Lunch break 1 PM to 2 PM.
Seed about 40 bookings across today and the next 7 days in all statuses, so the admin screens look full.

WORKING RULES
- Work in small steps. After each phase run lint, type-check and tests, then summarise what changed and what to check by eye.
- Do not add libraries I did not ask for without telling me why.
- No lorem ipsum. Use the sample data.
- Ask me before anything destructive.

Now: confirm the stack (Next.js App Router, TypeScript, Tailwind, Zustand, React Hook Form, zod, date-fns, Vitest, Playwright), write /CLAUDE.md including the screenshot mapping table, and list any questions. Do not start Phase 1.
```

**Check:** `CLAUDE.md` exists with the tokens, routes, mock-layer rules and the mapping table.

---

## Phase 1: Project setup and design system

```
Read /CLAUDE.md and look at the screenshots in /design. Set up the project and build the design system. No pages yet.

1. Scaffold Next.js (App Router, TypeScript, Tailwind, ESLint) in this folder. Add Vitest and Playwright config.
2. Load Bagel Fat One and DM Sans with next/font. Put all colour tokens from CLAUDE.md in tailwind.config.
3. Build reusable components in /components/ui to match the screenshots:
   - Button (primary, secondary, accent, outline; sizes md and lg; renders as button or link)
   - Input, Select (native select styled like the design), Label, OtpInput (4 boxes), Toggle, SegmentedControl
   - Chip and StatusChip (all booking statuses)
   - Flower (clip-path wrapper for icon tiles and images)
   - Card variants (cream, white, green, yellow, orange, blue)
   - Stepper (4 steps: Branch & service, Date & time, Your details, Done)
   - Logo ("BARBR" in the display font)
   - Icons: scissors, pin, calendar, phone, chat, check, arrow-right, arrow-left, star, user, settings, dashboard, list, wallet, search (stroke icons, width 2.2, round caps)
   - Toast and Modal/Sheet primitives
4. Create /app/design-system/page.tsx showing every component and variant, so I can compare it to the designs.

Done when: the design-system page renders with no console errors, lint and type-check pass, and colours and fonts match CLAUDE.md. List the components built.
```

**Check:** open `/design-system` and compare buttons, chips and flower shapes to the designs.

---

## Phase 2: Mock data, service layer and slot logic

```
Read /CLAUDE.md. Build the mock data layer and the pure logic behind it. No screens yet.

1. /lib/types.ts: Branch, Service, BranchService (optional price override), Barber, BarberBreak, Customer, Booking (ref like "BR-20481", branchId, serviceId, barberId, customer, startsAt, endsAt, status PENDING_FEE | CONFIRMED | IN_SERVICE | COMPLETED | CANCELLED | NO_SHOW, holdMethod FEE | OTP, holdExpiresAt, priceInr, feeInr, createdAt), Payment (simulated), Settings (feeInr, holdMode, adjustFeeInBill, refundWindowHours, unpaidHoldMinutes, advanceBookingDays, requireFeeAfterNoShows).
2. /lib/mock: seed data from CLAUDE.md, generated relative to today's date so it never goes stale; a localStorage-backed store with a "reset demo data" function.
3. /lib/slots.ts (pure functions, no UI): getAvailableSlots({ branchId, serviceId, date, barberId }) returns 30-minute start times grouped Morning (before 12), Afternoon (12 to 5), Evening (after 5), respecting branch hours, barber breaks, existing bookings, service duration, no past times, and the advance-booking limit. For barberId "any", a slot is available if at least one barber is free and the result says which barber would be assigned.
4. /lib/api (async, typed, fake delay, optional dev error mode): listBranches, listServices, listBarbers, getSlots, createHold, verifyOtp (accepts 4815), simulatePayment, confirmBooking, cancelBooking (applies the 3-hour refund rule), rescheduleBooking, markNoShow, listBookings(filters), getBooking(ref), getStats(range, branchId), getSettings, saveSettings, saveBranch. Every simulated spot is marked "// MOCK:".
5. Reject overlapping bookings for the same barber and expire unpaid holds.
6. Vitest tests for slots and for the booking rules: duration spanning slots, breaks, overlap attempts, expired holds, refund-window edge cases, "any barber" assignment.

Done when: tests pass and I can call the API functions from a small test page and see sensible results. Print the test summary.
```

**Check:** run the tests and open the test page to see seeded branches, barbers and slots.

---

## Phase 3: Landing page

```
Build the landing page at "/" to match the landing screenshot (and the mobile home screenshot). Use the components from Phase 1 and data from the mock API.

Sections in order:
1. Green hero (bottom corners rounded 64px): nav with BARBR logo, Services, Branches, Barbers, How it works, Sign in, yellow "Book a slot" button; pill "4 branches · open 10 AM – 9 PM"; heading "Book your next grooming" with "grooming" in yellow; subtext; two buttons; a row of barber avatars; on the right a large flower-shaped photo with a yellow flower behind it, an orange circle, a small blue flower, a rating chip ("★ 4.9 · Hot Towel Shave") and a "Next free slot" chip computed from the slot logic.
2. Quick-book card overlapping the hero bottom: Branch select, Service select, Date input and an orange "Find slots" button. It goes to /book/slot with the choices carried over.
3. Services: a large yellow featured card (Hot Towel Shave) spanning two rows, three coloured cards (green, orange, blue) and one wide dashed "Haircut + Beard Combo" card. Each starts the booking flow with that service preselected.
4. How it works: three white cards with numbered flower tiles.
5. Branches: four cards, the first filled green. Status chip (Open now, Busy today, Paused) and next slot from mock data. "Book here" preselects the branch.
6. Barbers: four tinted cards with photo, specialty, rating.
7. "Hold your slot your way": green panel with the fee option, the OTP option and a visual OTP card. Only show the options the current settings allow.
8. Footer with "Fresh cut. Zero waiting." and a book button.

Mobile layout follows the mobile home screenshot: branch selector chip at the top, service carousel, "Find your barber" row, floating pill bottom nav.

Use the photos in /design if there are any; otherwise use neutral placeholder images and tell me. Add metadata and Open Graph tags, next/image with alt text, and aim for Lighthouse accessibility 95 or higher.

Done when: desktop at 1440px and mobile at 390px both match the screenshots closely, links work and the quick-book card carries its choices into the flow. Show screenshots at both widths.
```

---

## Phase 4: Booking steps 1 and 2

```
Build booking steps 1 and 2 to match the step 1 and step 2 screenshots (mobile: the mobile pick slot screenshot).

Shared:
- A booking wizard layout: 4-step Stepper in the header, two columns on desktop (left content, right sticky "Your booking" summary card) and one column on mobile where the summary becomes a sticky bottom bar with the Continue button.
- Wizard state in a Zustand store persisted in sessionStorage, and mirrored in the URL where it makes sense. Refreshing keeps progress. Opening a later step without earlier choices redirects back.

Step 1: /book/branch
- Branch dropdown (native select). Below it a green info card for the selected branch: name, hours, open or busy status, "Next free slot". Changing the branch clears barber and time choices.
- Six service cards in a 3x2 grid with flower icon tile, name, description, price, duration. The selected card gets a green border, a check badge and updates the summary. Prices respect branch overrides.
- Summary card: branch, service, duration, price, the yellow booking-fee box ("Holds your slot. Adjusted in your final bill, so you pay ₹X at the salon") and a Continue button.

Step 2: /book/slot
- Seven-day strip with "Today", slot counts per day and the month title. Selected day is filled green. Respect the 14-day limit.
- Slot grid grouped Morning / Afternoon / Evening from the mock API. Taken slots are disabled with a line-through. Selected slot is orange with ink text. Show a loading skeleton and an empty state ("No slots left today, try tomorrow").
- Barber picker: "Any barber" (flower tile with a bolt icon) plus each barber with photo, specialty and rating. Changing the barber reloads the slots.
- Summary updates with date, time and barber. Continue goes to /book/details.

All controls are keyboard accessible, with aria-pressed on selectable cards, days and slots.

Done when: a user can go through steps 1 and 2 on desktop and mobile, the summary always matches the selection, and component tests cover selection and slot loading. Show screenshots next to the designs.
```

---

## Phase 5: Details, simulated OTP and payment, confirmation

```
Build steps 3 and 4. Match the step 3, step 4 and mobile confirm-and-pay screenshots. Remember: OTP and payment are SIMULATED (see CLAUDE.md).

Step 3: /book/details
- "Your details" card: full name, mobile number with a fixed +91 prefix and a "Send OTP" button, a 4-box OTP input and a resend countdown. Validate with React Hook Form and zod (10-digit Indian mobile number, name at least 2 characters). Show a small dev hint "Demo code: 4815" under the OTP input. Wrong code shows an error; 3 wrong codes lock the input for 30 seconds.
- "How would you like to hold your slot?" with two selectable option cards: "Pay booking fee ₹99" and "Verify my number (free)". Respect the hold mode in settings: show only the allowed option(s). If this phone number already has 2 or more no-shows in mock data and OTP-only would apply, force the fee option and explain why in one friendly line.
- Fee option shows UPI, Card and Netbanking tabs; the Confirm button opens a fake payment sheet (a modal that looks like a checkout, with a "Pay ₹99" button, a processing state and a success state). In dev error mode it can fail and offer retry without losing the held slot.
- Terms checkbox: free cancellation up to 3 hours before the slot.
- The summary changes with the choice: fee option shows "Pay now ₹99" and "Confirm & pay ₹99"; OTP option shows "Pay now ₹0" and "Verify & hold slot".
- A visible 10-minute hold countdown for the fee option. When it expires, go back to step 2 with choices kept and a clear message.

Step 4: /book/confirmed/[ref]
- Green header with the big flower check and "You're booked!"; a ticket-style card with a dashed divider and side notches showing ref, status chip, date and time, service, barber photo and name and branch; buttons: Add to calendar (generate and download a real .ics file in the browser), Get directions (opens a maps search link), Reschedule (back to step 2 for this booking), Cancel booking (confirmation modal that shows whether the fee will be refunded under the 3-hour rule). Side cards: "Good to know" and an SMS preview (just a styled mock).
- The booking is saved in the mock store, so it appears in the admin panel.

Done when: both paths (fee and OTP) work end to end on desktop and mobile, a booking made here shows up in admin later, and Playwright tests cover both paths plus cancel. Show screenshots.
```

---

## Phase 6: Admin shell, mock login and dashboard

```
Build the admin shell and dashboard. Match the admin dashboard screenshot.

1. /admin/login: brand-styled page with the demo credentials shown (owner@barbr.demo / demo1234) and a "Demo only" label. Mock session in localStorage; a client-side guard redirects /admin/* to the login when there is no session. Logout in the sidebar. Add roles OWNER and STAFF (staff@barbr.demo / demo1234); STAFF cannot open Branches & fees.
2. Admin layout: dark green 260px sidebar with BARBR logo, "Owner panel", nav items (Dashboard, Bookings, Calendar, Branches & fees, Barbers, Customers, Payments, Settings), active item in yellow, and the owner card at the bottom. Barbers, Customers, Payments and Settings are simple "coming soon" pages. On mobile the sidebar becomes a drawer. A "Reset demo data" link sits in the footer.
3. Dashboard at /admin:
   - Greeting with the date and a branch filter (All branches plus each branch) that filters the whole page; "+ New booking" button.
   - Four KPI cards: Today's bookings (with comparison to the same weekday last week), Booking fees collected (with paid and OTP counts), Slots filled % with a progress bar, No-shows today.
   - "Bookings this week" bar chart (today dark green, future days yellow, past days light green) with numbers above the bars and a text alternative for screen readers.
   - "By branch today" horizontal bars.
   - "Up next" list with time, customer, service, barber, branch and status chip.
   - "Needs your attention" card: bookings awaiting fee, refund requests, barber gaps.
4. Every number is computed by getStats in the mock API from the seed data, never hardcoded, and covered by Vitest tests.

Done when: login and the guard work, STAFF restrictions work, and the dashboard numbers match the seed data when checked by hand. Show screenshots at 1440px and 390px.
```

---

## Phase 7: Admin bookings

```
Build /admin/bookings to match the admin bookings screenshot.

- Header with title, count, "Export CSV" and "+ New booking" buttons.
- Filter bar: search by name, phone or booking ref; branch select; date range select (Today, This week, This month, custom); status tabs with live counts (All, Confirmed, Fee pending, Completed, Cancelled, No-show). Filters live in the URL so a view can be bookmarked.
- Table with columns Customer (name and masked phone), Service and barber, Branch, When, Status chip. Pagination (25 per page), sortable by time, and a keyboard-accessible selected row highlighted in butter yellow.
- Right detail panel for the selected booking: ref, status, customer with visit count, summary rows, fee payment row (method and amount), activity timeline (created, OTP verified, fee received) and actions: Call (tel link), WhatsApp (wa.me link), Reschedule, Mark no-show, plus Cancel and Refund where allowed. On mobile the panel opens as a full-screen sheet.
- "+ New booking": a form for walk-in or phone bookings (branch, service, barber, slot from the slot logic, customer name and phone, "fee collected in person" or "no fee").
- CSV export of the currently filtered bookings, generated in the browser.
- Every status change goes through the mock API, updates the counts, and shows a toast with Undo for 5 seconds where safe. Invalid transitions are blocked (for example a COMPLETED booking cannot become CONFIRMED).

Done when: all filters and actions work on the mock data, the CSV matches the table, and tests cover filtering and status transitions. Show screenshots at 1440px and 390px (the table becomes cards on mobile).
```

---

## Phase 8: Admin calendar

```
Build /admin/calendar to match the admin calendar screenshot.

- Header: branch select, Day/Week toggle, previous/next/Today controls, date label.
- Legend chips: Confirmed, Fee pending, In service, Completed, Break (hatched).
- Day view: one column per barber of the selected branch (photo and name), a time axis from opening to closing with 72px per hour, hour grid lines, booking blocks positioned by start time and duration and coloured by status, showing customer and service. Barber breaks shown as hatched blocks. An orange "now" line with a time label that updates every minute on today's date.
- Clicking a block opens the same detail panel as the Bookings page. Clicking an empty slot opens the "New booking" form prefilled with that barber and time.
- Drag a block to another time or barber to reschedule: validate with the slot logic, show a toast with Undo, and refuse a move that would overlap another booking. Also provide a non-drag way to do the same (a "Move" button in the detail panel) for keyboard users.
- Week view: seven days for one chosen barber, compact blocks.

Done when: blocks line up exactly with the booking times in the mock data, drag-to-reschedule can never create an overlap, and Vitest tests cover the position and overlap maths. Show screenshots.
```

---

## Phase 9: Branches and fee rules

```
Build /admin/branches to match the admin branches screenshot. OWNER only.

Left: a 2x2 grid of branch cards. Each shows name, hours and barber count, a switch to turn bookings on or off for that branch (the active card is green), today's bookings and today's fees, and a "Manage branch" button. "+ Add branch" opens a form. "Manage branch" opens a drawer to edit name, address, phone, opening hours per weekday, which services the branch offers with optional price overrides, and its barbers with their breaks.

Right: a "Booking fee rules" panel:
- Segmented control for how customers hold a slot: Fee only, Phone OTP only, Customer chooses.
- Booking fee amount with a ₹ prefix, validated as a whole number from 0 to 2000.
- Toggles: Adjust fee in final bill; Refund on early cancellation (with a number input for hours, default 3); Require fee after 2 no-shows (with a number input).
- Select for how long unpaid slots are held (10, 15 or 30 minutes).
- Save changes with validation, a success toast and an "applies to new bookings only" note.

A paused branch disappears from the public branch dropdown; existing bookings stay untouched.

Done when: changing a setting changes real behaviour on the public booking flow (for example switching to Fee only hides the OTP option; changing the fee changes the summary), and tests cover the validation. Show screenshots.
```

---

## Phase 10: Responsive polish, states and tests

```
Review the whole app against every screenshot in /design and fix gaps.

1. Check every page at 390, 768, 1024 and 1440px. Fix overflow, cramped tables (admin tables become cards on mobile) and anything tappable under 44px.
2. Add every missing state: loading skeletons, empty states, error states with retry, "branch paused", "no slots", "payment failed" (retry keeps the held slot), "hold expired", offline notice.
3. Keyboard and screen-reader pass: visible focus rings on green and cream backgrounds, logical tab order, aria-live for slot loading and toasts, labelled icon buttons, reduced-motion support.
4. Performance: next/image everywhere, fonts with display swap, no layout shift in the hero, Lighthouse 90 or higher on performance and 95 or higher on accessibility for /, /book/branch and /admin.
5. Playwright end-to-end tests: book with fee, book with OTP, cancel within the refund window, admin changes a booking status, admin changes the fee rules and the public flow reflects it.
6. Give me a list of any remaining differences from the designs.

Done when: the test suite passes and Lighthouse targets are met.
```

---

## Phase 11: Backend handoff and deploy

```
Prepare the frontend for a future backend and deploy the demo.

1. Create /docs/API-CONTRACT.md that lists every function in /lib/api with its input and output types, the screens that use it, the business rules it must enforce on the server (no double-booking, 10-minute hold expiry, 3-hour refund window, OTP limits, fee rules), and which parts are simulated today (every "// MOCK:" comment, grouped by file). Include a suggested REST endpoint for each function.
2. Add a single switch (an environment variable) that selects the mock layer or a real HTTP client with the same function signatures, with the HTTP client left as clearly marked stubs that throw "Backend not connected".
3. Write /README.md: setup, scripts, folder map, how the mock layer works, demo credentials, how to reset the demo data, how to run tests.
4. Deploy to Vercel as a demo and add a banner on the admin pages saying "Demo data: stored in your browser only".

Done when: the contract matches the code exactly, switching the variable to the real client shows the "Backend not connected" message instead of breaking silently, and the deployed demo works end to end.
```

---

## Tips for working with Claude Code

- Start each phase in a fresh session; `CLAUDE.md` carries the rules forward.
- After each phase ask: "Compare what you built with the screenshots in /design and list every visual difference."
- If a phase is too big, say: "Do only the first half and stop so I can review."
- Commit after every phase so you can roll back.
- The photos in the designs are small placeholders. Replace them with licensed photos before launch.