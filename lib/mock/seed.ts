// MOCK: demo data, generated relative to today so it never goes stale.
import { addDays, addMinutes, format, startOfDay } from "date-fns";
import { findConflict, occupiedMinutes, priceFor } from "../slots";
import type {
  Barber, BarberBreak, Booking, BookingEvent, Branch, BranchService, Customer, Payment, Service, Settings,
} from "../types";
import type { Db } from "./db";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const allDays = (open: number, close: number) => Array.from({ length: 7 }, () => ({ open, close }));

export const SEED_BRANCHES: Branch[] = [
  { id: "main-street", name: "Main Street", address: "12 Main Street, Indiranagar", phone: "+91 80000 10001", weekHours: allDays(600, 1260), paused: false },
  { id: "station-road", name: "Station Road", address: "4 Station Road, Opp. Metro", phone: "+91 80000 10002", weekHours: allDays(600, 1260), paused: false },
  { id: "lake-view", name: "Lake View", address: "88 Lake View Avenue", phone: "+91 80000 10003", weekHours: allDays(600, 1260), paused: false },
  { id: "city-mall", name: "City Mall", address: "Level 2, City Mall", phone: "+91 80000 10004", weekHours: allDays(660, 1320), paused: true },
];

export const SEED_SERVICES: Service[] = [
  { id: "hot-towel-shave", name: "Hot Towel Shave", description: "Steamed towels, classic razor, calm finish", priceInr: 499, durationMin: 40, tint: "yellow" },
  { id: "classic-haircut", name: "Classic Haircut", description: "Scissor and clipper finish", priceInr: 299, durationMin: 30, tint: "mint" },
  { id: "fade-styling", name: "Fade & Styling", description: "Skin, low, mid or high fade", priceInr: 349, durationMin: 40, tint: "peach" },
  { id: "beard-trim", name: "Beard Trim", description: "Shape, line-up and oil", priceInr: 199, durationMin: 20, tint: "lavender" },
  { id: "haircut-beard", name: "Haircut + Beard", description: "The full look in one slot", priceInr: 449, durationMin: 50, tint: "butter" },
  { id: "kids-haircut", name: "Kids Haircut", description: "For ages under 12", priceInr: 199, durationMin: 25, tint: "yellow" },
];

const PEOPLE = [
  { key: "jhon", name: "Jhon Abraham", specialty: "Fades & classic cuts", rating: 4.9 },
  { key: "arjun", name: "Arjun Mehta", specialty: "Styling & texture", rating: 4.8 },
  { key: "kabir", name: "Kabir Khan", specialty: "Beard sculpting", rating: 4.9 },
  { key: "dev", name: "Dev Sharma", specialty: "Hot towel shaves", rating: 4.7 },
] as const;

/** Barbers working at each branch (4, 3, 3, 2). Each branch has its own records, so no cross-branch clashes. */
const STAFFING: Record<string, string[]> = {
  "main-street": ["jhon", "arjun", "kabir", "dev"],
  "station-road": ["jhon", "arjun", "kabir"],
  "lake-view": ["arjun", "kabir", "dev"],
  "city-mall": ["kabir", "dev"],
};

const FIRST = ["Rahul", "Aarav", "Karan", "Vivek", "Siddharth", "Imran", "Mohit", "Nikhil", "Rohit", "Sameer", "Yash", "Amit", "Harsh", "Pranav", "Tarun", "Ayush", "Dhruv", "Manav", "Zaid", "Kunal", "Neil", "Ishaan", "Varun", "Tushar"];
const LAST = ["Sharma", "Mehta", "Bhatia", "Patel", "Rao", "Ali", "Jain", "Rathi", "Gupta", "Joshi", "Verma", "Nair", "Kapoor", "Singh"];

/** Every barber record, one per branch. Also used as instant first-paint data on public pages. */
export const SEED_BARBERS: Barber[] = SEED_BRANCHES.flatMap((b) =>
  STAFFING[b.id].map((key) => {
    const p = PEOPLE.find((x) => x.key === key)!;
    return { id: `${key}-${b.id}`, name: p.name, specialty: p.specialty, rating: p.rating, branchId: b.id };
  }),
);

export const REPEAT_NO_SHOW_PHONE = "9000000001";

export function buildSeed(now: Date, settings: Settings): Db {
  const today = startOfDay(now);
  const rand = mulberry32(Number(format(now, "yyyyMMdd")));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const branches = SEED_BRANCHES.map((b) => ({ ...b }));
  const services = SEED_SERVICES.map((s) => ({ ...s }));
  const branchServices: BranchService[] = branches.flatMap((b) =>
    services.map((s) => ({ branchId: b.id, serviceId: s.id })),
  );
  // One example of a per-branch price override.
  branchServices.find((bs) => bs.branchId === "lake-view" && bs.serviceId === "hot-towel-shave")!.priceOverrideInr = 449;

  const barbers: Barber[] = SEED_BARBERS.map((b) => ({ ...b }));
  const breaks: BarberBreak[] = barbers.map((b) => ({ id: `lunch-${b.id}`, barberId: b.id, startMin: 780, endMin: 840 }));

  const db: Db = {
    seededOn: format(now, "yyyy-MM-dd"),
    settings: { ...settings },
    branches, services, branchServices, barbers, breaks,
    bookings: [],
    payments: [],
    expiredRefs: [],
    otp: {},
    counters: { nextRef: 20481, nextPayment: 1 },
  };

  const iso = (d: Date) => d.toISOString();
  const used = new Set<string>();

  function customer(): Customer {
    for (;;) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      if (!used.has(name)) {
        used.add(name);
        return { name, phone: `${pick(["98", "97", "99", "96", "90"])}${Math.floor(10_000_000 + rand() * 89_999_999)}` };
      }
    }
  }

  function add(opts: {
    branchId: string; serviceId: string; barberId: string; start: Date; customer: Customer;
    status: Booking["status"]; method: Booking["holdMethod"]; holdMins?: number; refundDue?: boolean;
  }) {
    const service = services.find((s) => s.id === opts.serviceId)!;
    const end = addMinutes(opts.start, occupiedMinutes(service.durationMin));
    const ref = `BR-${db.counters.nextRef++}`;
    const fee = opts.method === "FEE" ? settings.feeInr : 0;
    const created = addMinutes(opts.start, -(60 + Math.floor(rand() * 2000)));
    const events: BookingEvent[] = [{ at: iso(created), type: "CREATED", note: "Booking created on website" }];
    if (opts.method === "OTP") events.push({ at: iso(addMinutes(created, 1)), type: "OTP_VERIFIED", note: "Phone verified by OTP" });
    const hasPayment = opts.method === "FEE" && opts.status !== "PENDING_FEE";
    if (hasPayment) events.push({ at: iso(addMinutes(created, 2)), type: "FEE_RECEIVED", note: `₹${fee} fee received` });
    if (opts.status === "NO_SHOW") events.push({ at: iso(end), type: "NO_SHOW" });
    if (opts.status === "CANCELLED") events.push({ at: iso(addMinutes(created, 30)), type: "CANCELLED" });

    const booking: Booking = {
      ref,
      branchId: opts.branchId,
      serviceId: opts.serviceId,
      barberId: opts.barberId,
      customer: opts.customer,
      startsAt: iso(opts.start),
      endsAt: iso(end),
      status: opts.status,
      holdMethod: opts.method,
      holdExpiresAt: opts.status === "PENDING_FEE" ? iso(addMinutes(now, opts.holdMins ?? 5)) : null,
      priceInr: priceFor(opts.branchId, opts.serviceId, db)!,
      feeInr: fee,
      createdAt: iso(created),
      events,
    };
    db.bookings.push(booking);
    if (hasPayment || (opts.status === "CANCELLED" && opts.method === "FEE")) {
      const refunded = opts.status === "CANCELLED" && !opts.refundDue;
      const payment: Payment = {
        id: `pay-${db.counters.nextPayment++}`,
        bookingRef: ref,
        amountInr: fee,
        method: pick(["UPI", "UPI", "UPI", "CARD", "NETBANKING"] as const),
        status: opts.status === "CANCELLED" ? (refunded ? "REFUNDED" : "REFUND_DUE") : "PAID",
        createdAt: iso(addMinutes(created, 2)),
      };
      db.payments.push(payment);
    }
  }

  function statusFor(start: Date, end: Date): Booking["status"] {
    const r = rand();
    if (end <= now) return r < 0.8 ? "COMPLETED" : r < 0.92 ? "NO_SHOW" : "CANCELLED";
    if (start <= now) return "IN_SERVICE";
    return r < 0.76 ? "CONFIRMED" : r < 0.84 ? "PENDING_FEE" : "CANCELLED";
  }

  // 1. The booking shown in the designs: Aarav Mehta, Hot Towel Shave, Jhon, Main Street, today 2:30 PM.
  add({
    branchId: "main-street", serviceId: "hot-towel-shave", barberId: "jhon-main-street",
    start: addMinutes(today, 14 * 60 + 30), customer: { name: "Aarav Mehta", phone: "9876543210" },
    status: "CONFIRMED", method: "FEE",
  });

  // 1b. While the shop is open, one haircut is always in the chair right now.
  const halfHour = new Date(Math.floor(+now / 1_800_000) * 1_800_000);
  if (halfHour.getHours() >= 10 && halfHour.getHours() < 21 && +halfHour + 1_800_000 > +now) {
    add({
      branchId: "main-street", serviceId: "classic-haircut", barberId: "kabir-main-street",
      start: halfHour, customer: { name: "Karan Bhatia", phone: "9712345604" },
      status: "IN_SERVICE", method: "FEE",
    });
  }

  // 2. A customer with two earlier no-shows, to exercise the "fee required" rule.
  for (const dayOffset of [-6, -3]) {
    add({
      branchId: "station-road", serviceId: "classic-haircut", barberId: "arjun-station-road",
      start: addMinutes(addDays(today, dayOffset), 11 * 60), customer: { name: "Test Repeat", phone: REPEAT_NO_SHOW_PHONE },
      status: "NO_SHOW", method: "OTP",
    });
  }

  // 3. Random bookings: ~12 today, ~4 on each of the next 7 days, ~3 on each of the last 7 days.
  const plan: Array<[number, number]> = [[0, 12], ...[1, 2, 3, 4, 5, 6, 7].map((d): [number, number] => [d, 4]), ...[-7, -6, -5, -4, -3, -2, -1].map((d): [number, number] => [d, 3])];
  const branchWeights = ["main-street", "main-street", "main-street", "station-road", "station-road", "lake-view", "city-mall"];

  for (const [offset, count] of plan) {
    const day = addDays(today, offset);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 200) {
      const branchId = pick(branchWeights);
      const branch = branches.find((b) => b.id === branchId)!;
      const hours = branch.weekHours[day.getDay()]!;
      const service = pick(services);
      const barber = pick(barbers.filter((b) => b.branchId === branch.id));
      const occupied = occupiedMinutes(service.durationMin);
      const slots = Math.floor((hours.close - hours.open - occupied) / 30) + 1;
      const start = addMinutes(day, hours.open + 30 * Math.floor(rand() * slots));
      const end = addMinutes(start, occupied);
      if (findConflict(barber.id, start, end, db, now)) continue;
      const status = statusFor(start, end);
      const method = status === "PENDING_FEE" ? "FEE" : rand() < 0.88 ? "FEE" : "OTP";
      add({
        branchId: branch.id, serviceId: service.id, barberId: barber.id, start, customer: customer(),
        status, method, holdMins: 2 + Math.floor(rand() * 8),
        // Some early cancellations still owe a refund, to feed "Needs your attention".
        refundDue: status === "CANCELLED" && start > now && rand() < 0.3,
      });
      placed++;
    }
  }

  db.bookings.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return db;
}
