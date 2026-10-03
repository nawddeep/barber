import { describe, expect, it } from "vitest";
import { addMinutes } from "date-fns";
import { computeStats, type StatsData } from "./stats";
import type { Barber, Booking, Branch, Payment, Service } from "./types";

// Friday 2 Oct 2026, 10:30 AM. Last Friday is 25 Sep.
const NOW = new Date(2026, 9, 2, 10, 30);
const DATE = "2026-10-02";
const at = (day: number, month: number, h: number, m = 0) => new Date(2026, month, day, h, m);

const week = (open: number, close: number) => Array.from({ length: 7 }, () => ({ open, close }));
const branches: Branch[] = [
  { id: "A", name: "Alpha", address: "", phone: "", weekHours: week(600, 720), paused: false },
  { id: "B", name: "Beta", address: "", phone: "", weekHours: week(600, 720), paused: false },
];
const services: Service[] = [{ id: "s", name: "Haircut", description: "", priceInr: 300, durationMin: 30, tint: "yellow" }];
const barbers: Barber[] = [
  { id: "a1", name: "Asha", specialty: "", rating: 5, branchId: "A" },
  { id: "a2", name: "Arun", specialty: "", rating: 5, branchId: "A" },
  { id: "b1", name: "Bela", specialty: "", rating: 5, branchId: "B" },
];

let n = 0;
function bk(o: { branch: string; barber: string; start: Date; status: Booking["status"]; method?: "FEE" | "OTP"; name?: string; holdMins?: number }): Booking {
  n += 1;
  return {
    ref: `T-${n}`, branchId: o.branch, serviceId: "s", barberId: o.barber, customer: { name: o.name ?? `Customer ${n}`, phone: "9000000000" },
    startsAt: o.start.toISOString(), endsAt: addMinutes(o.start, 30).toISOString(), status: o.status, holdMethod: o.method ?? "FEE",
    holdExpiresAt: o.status === "PENDING_FEE" ? addMinutes(NOW, o.holdMins ?? 5).toISOString() : null,
    priceInr: 300, feeInr: o.method === "OTP" ? 0 : 99, createdAt: NOW.toISOString(), events: [],
  };
}
const pay = (b: Booking, status: Payment["status"] = "PAID"): Payment => ({ id: `p-${b.ref}`, bookingRef: b.ref, amountInr: 99, method: "UPI", status, createdAt: NOW.toISOString() });

function scenario() {
  const confirmedPaid = bk({ branch: "A", barber: "a1", start: at(2, 9, 10), status: "CONFIRMED" });
  const completedOtp = bk({ branch: "A", barber: "a2", start: at(2, 9, 10), status: "COMPLETED", method: "OTP" });
  const noShowPaid = bk({ branch: "A", barber: "a1", start: at(2, 9, 10, 30), status: "NO_SHOW" });
  const cancelled = bk({ branch: "A", barber: "a2", start: at(2, 9, 10, 30), status: "CANCELLED" });
  const pending = bk({ branch: "A", barber: "a1", start: at(2, 9, 11), status: "PENDING_FEE" });
  const confirmedLater = bk({ branch: "A", barber: "a2", start: at(2, 9, 11), status: "CONFIRMED", name: "Zed" });
  const betaOtp = bk({ branch: "B", barber: "b1", start: at(2, 9, 11, 30), status: "CONFIRMED", method: "OTP", name: "Beta Guy" });
  const lastWeek = [bk({ branch: "A", barber: "a1", start: at(25, 8, 10), status: "COMPLETED" }), bk({ branch: "B", barber: "b1", start: at(25, 8, 10), status: "COMPLETED" })];
  const monday = bk({ branch: "A", barber: "a1", start: at(28, 8, 10), status: "COMPLETED" });
  const saturday = bk({ branch: "A", barber: "a1", start: at(3, 9, 10), status: "CONFIRMED" });
  const bookings = [confirmedPaid, completedOtp, noShowPaid, cancelled, pending, confirmedLater, betaOtp, ...lastWeek, monday, saturday];
  const payments = [pay(confirmedPaid), pay(noShowPaid), pay(confirmedLater), pay(cancelled, "REFUND_DUE")];
  const data: StatsData = { branches, services, barbers, breaks: [], bookings, payments };
  return data;
}

describe("computeStats", () => {
  const s = computeStats(scenario(), DATE, null, NOW);

  it("counts every booking that starts today, whatever its status", () => {
    expect(s.todayBookings).toBe(7);
    expect(s.sameWeekdayLastWeek).toBe(2);
  });
  it("adds up fees and splits paid from OTP", () => {
    expect(s.feePaidCount).toBe(3);
    expect(s.otpCount).toBe(2);
    // 3 paid fees + 1 refund still owed (money not yet returned)
    expect(s.feesCollectedInr).toBe(4 * 99);
  });
  it("counts no-shows and how many had paid", () => {
    expect(s.noShows).toBe(1);
    expect(s.noShowsPaidFee).toBe(1);
  });
  it("works out slots filled from barber capacity", () => {
    // 3 barbers x 120 min = 360. Blocking bookings today: confirmed, completed, pending hold, confirmed, beta = 5 x 30 = 150.
    expect(s.slotsFilledPct).toBe(Math.round((150 / 360) * 100));
  });
  it("builds Monday to Sunday with past, today and future", () => {
    expect(s.week.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(s.week.map((d) => d.count)).toEqual([1, 0, 0, 0, 6, 1, 0]); // cancelled bookings are not counted
    expect(s.week.map((d) => d.kind)).toEqual(["past", "past", "past", "past", "today", "future", "future"]);
  });
  it("splits today by branch", () => {
    expect(s.byBranch).toEqual([
      { branchId: "A", name: "Alpha", count: 6 },
      { branchId: "B", name: "Beta", count: 1 },
    ]);
  });
  it("lists what is still to come today, soonest first, with names filled in", () => {
    expect(s.upNext.map((r) => r.startsAt)).toEqual([at(2, 9, 11), at(2, 9, 11), at(2, 9, 11, 30)].map((d) => d.toISOString()));
    expect(s.upNext.at(-1)).toMatchObject({ customerName: "Beta Guy", serviceName: "Haircut", barberName: "Bela", branchName: "Beta", status: "CONFIRMED", holdMethod: "OTP" });
    expect(s.upNext.some((r) => r.status === "PENDING_FEE")).toBe(true);
    expect(s.upNext.every((r) => r.status === "CONFIRMED" || r.status === "PENDING_FEE")).toBe(true);
  });
  it("flags holds awaiting a fee and refunds still owed", () => {
    expect(s.attention.awaitingFee).toBe(1);
    expect(s.attention.refundRequests).toBe(1);
  });
  it("ignores an expired hold when counting awaiting fees", () => {
    const d = scenario();
    d.bookings.find((b) => b.status === "PENDING_FEE")!.holdExpiresAt = addMinutes(NOW, -1).toISOString();
    expect(computeStats(d, DATE, null, NOW).attention.awaitingFee).toBe(0);
  });
  it("filters everything by branch", () => {
    const b = computeStats(scenario(), DATE, "B", NOW);
    expect(b.todayBookings).toBe(1);
    expect(b.sameWeekdayLastWeek).toBe(1);
    expect(b.otpCount).toBe(1);
    expect(b.feesCollectedInr).toBe(0);
    expect(b.byBranch).toHaveLength(1);
    expect(b.slotsFilledPct).toBe(Math.round((30 / 120) * 100));
    expect(b.attention).toMatchObject({ awaitingFee: 0, refundRequests: 0 });
  });
  it("excludes paused branches from capacity", () => {
    const d = scenario();
    d.branches = d.branches.map((x) => (x.id === "B" ? { ...x, paused: true } : x));
    // 2 barbers x 120 = 240; Beta's booking no longer counts.
    expect(computeStats(d, DATE, null, NOW).slotsFilledPct).toBe(Math.round((120 / 240) * 100));
  });
  it("is zero, not NaN, when there is nothing", () => {
    const empty = computeStats({ branches, services, barbers, breaks: [], bookings: [], payments: [] }, DATE, null, NOW);
    expect(empty).toMatchObject({ todayBookings: 0, feesCollectedInr: 0, slotsFilledPct: 0, noShows: 0 });
    expect(empty.upNext).toEqual([]);
  });

  it("finds a barber gap of at least 2 free hours", () => {
    const data: StatsData = {
      branches: [{ ...branches[0], weekHours: week(600, 1080) }], services,
      barbers: [barbers[0]], breaks: [], payments: [],
      bookings: [bk({ branch: "A", barber: "a1", start: at(2, 9, 10, 30), status: "CONFIRMED" })],
    };
    const g = computeStats(data, DATE, null, NOW).attention.gaps;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ barberName: "Asha", branchName: "Alpha" });
    expect(g[0].startsAt).toBe(at(2, 9, 11).toISOString()); // the 10:30 booking ends at 11:00, and 11:00 to 13:00 is free
  });
});
