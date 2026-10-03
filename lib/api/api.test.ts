import { addDays, addMinutes, format, startOfDay } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import { setClock } from "../clock";
import { resetDemoData, loadDb, saveDb } from "../mock/db";
import { setDevConfig } from "../mock/dev";
import { REPEAT_NO_SHOW_PHONE, buildSeed } from "../mock/seed";
import { DEFAULT_SETTINGS } from "../settings-schema";
import { isBlocking } from "../slots";
import * as api from "./index";

const NOW = new Date(2026, 9, 2, 9, 0); // Friday 9:00 AM
const TOMORROW = addDays(startOfDay(NOW), 1);
const at = (h: number, m = 0, base = TOMORROW) => addMinutes(base, h * 60 + m).toISOString();
const customer = { name: "Asha Rao", phone: "9811122233" };

const hold = (over: Partial<api.CreateHoldInput> = {}) =>
  api.createHold({
    branchId: "main-street", serviceId: "classic-haircut", barberId: "kabir-main-street",
    startsAt: at(16), customer, method: "FEE", ...over,
  });

const code = async (p: Promise<unknown>) => {
  try { await p; return "ok"; } catch (e) { return e instanceof api.ApiError ? e.code : "other"; }
};

beforeEach(() => {
  setClock(NOW);
  window.localStorage.clear();
  setDevConfig({ delay: false, errorMode: "off" });
  resetDemoData(NOW);
});

/** Flow tests start from an empty calendar so they cannot collide with random seed bookings. */
function emptyCalendar() {
  const db = loadDb(NOW);
  db.bookings = db.bookings.filter((b) => b.customer.phone === REPEAT_NO_SHOW_PHONE);
  db.payments = [];
  saveDb(db);
}

describe("seed data", () => {
  it("has about 40 bookings over today and the next 7 days, in every status, with no barber overlaps", () => {
    const db = loadDb(NOW);
    const from = startOfDay(NOW);
    const to = addDays(from, 8);
    const near = db.bookings.filter((b) => new Date(b.startsAt) >= from && new Date(b.startsAt) < to);
    expect(near.length).toBeGreaterThanOrEqual(38);
    expect(near.length).toBeLessThanOrEqual(48);
    // Statuses depend on the time of day, so check them with the clock mid-afternoon.
    const midday = new Date(2026, 9, 2, 15, 10);
    const statuses = new Set(buildSeed(midday, DEFAULT_SETTINGS).bookings.map((b) => b.status));
    for (const s of ["PENDING_FEE", "CONFIRMED", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(statuses.has(s as never), s).toBe(true);
    }
    const live = db.bookings.filter((b) => isBlocking(b, NOW));
    for (const a of live) {
      for (const b of live) {
        if (a.ref >= b.ref || a.barberId !== b.barberId) continue;
        expect(+new Date(a.startsAt) < +new Date(b.endsAt) && +new Date(b.startsAt) < +new Date(a.endsAt), `${a.ref}/${b.ref}`).toBe(false);
      }
    }
  });

  it("contains the booking from the designs as BR-20481", async () => {
    const d = await api.getBooking("BR-20481");
    expect(d.booking.customer.name).toBe("Aarav Mehta");
    expect(d.service.name).toBe("Hot Towel Shave");
    expect(d.barber.name).toBe("Jhon Abraham");
  });
});

describe("catalog", () => {
  it("hides paused branches from the public list", async () => {
    expect((await api.listBranches()).map((b) => b.name)).toEqual(["Main Street", "Station Road", "Lake View"]);
    expect(await api.listBranches({ includePaused: true })).toHaveLength(4);
  });
  it("applies branch price overrides", async () => {
    const main = (await api.listServices("main-street")).find((s) => s.id === "hot-towel-shave")!;
    const lake = (await api.listServices("lake-view")).find((s) => s.id === "hot-towel-shave")!;
    expect([main.priceInr, lake.priceInr]).toEqual([499, 449]);
  });
  it("counts open slots per day and finds the next free slot", async () => {
    const counts = await api.getSlotCounts({ branchId: "main-street", serviceId: "classic-haircut", barberId: "any", from: format(TOMORROW, "yyyy-MM-dd"), days: 7 });
    expect(counts).toHaveLength(7);
    expect(counts.every((c) => c.count > 0)).toBe(true);
    const next = await api.getNextFreeSlot({ branchId: "main-street", serviceId: "classic-haircut" });
    expect(next && +new Date(next.startsAt) > +NOW).toBe(true);
  });
});

describe("holds and confirmation", () => {
  beforeEach(emptyCalendar);
  it("fee path: hold, pay, confirm", async () => {
    const h = await hold();
    expect(h).toMatchObject({ status: "PENDING_FEE", feeInr: 99, holdMethod: "FEE" });
    expect(h.holdExpiresAt).toBe(addMinutes(NOW, 10).toISOString());
    expect(await code(api.confirmBooking({ ref: h.ref }))).toBe("PAYMENT_REQUIRED");
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    const c = await api.confirmBooking({ ref: h.ref });
    expect(c.status).toBe("CONFIRMED");
    expect(c.holdExpiresAt).toBeNull();
  });

  it("OTP path: needs the right code, then confirms with no fee", async () => {
    const h = await hold({ method: "OTP" });
    expect(h.feeInr).toBe(0);
    expect(await code(api.confirmBooking({ ref: h.ref }))).toBe("OTP_REQUIRED");
    expect(await code(api.verifyOtp({ phone: customer.phone, code: "0000" }))).toBe("OTP_INVALID");
    await api.verifyOtp({ phone: customer.phone, code: "4815" });
    expect((await api.confirmBooking({ ref: h.ref })).status).toBe("CONFIRMED");
  });

  it("rejects an overlapping booking for the same barber", async () => {
    await hold({ startsAt: at(16) });
    expect(await code(hold({ startsAt: at(16), customer: { name: "Other", phone: "9822233344" } }))).toBe("SLOT_UNAVAILABLE");
    // Classic haircut = 1 slot, so the next half hour is free.
    expect(await code(hold({ startsAt: at(16, 30) }))).toBe("ok");
  });

  it("rejects a booking that overlaps an existing longer service", async () => {
    await hold({ serviceId: "hot-towel-shave", startsAt: at(16) }); // occupies 16:00-17:00
    expect(await code(hold({ startsAt: at(16, 30), customer: { name: "Other", phone: "9822233344" } }))).toBe("SLOT_UNAVAILABLE");
  });

  it("releases an unpaid hold after 10 minutes", async () => {
    const h = await hold();
    setClock(addMinutes(NOW, 10));
    expect(await code(api.confirmBooking({ ref: h.ref }))).toBe("HOLD_EXPIRED");
    expect(await code(api.simulatePayment({ ref: h.ref, method: "UPI" }))).toBe("HOLD_EXPIRED");
    // The slot is free again for someone else.
    expect(await code(hold({ customer: { name: "Other", phone: "9822233344" } }))).toBe("ok");
  });

  it("keeps the slot held until the last second of the hold", async () => {
    const h = await hold();
    setClock(addMinutes(NOW, 9));
    expect(await code(hold({ customer: { name: "Other", phone: "9822233344" } }))).toBe("SLOT_UNAVAILABLE");
    await api.simulatePayment({ ref: h.ref, method: "CARD" });
    expect((await api.confirmBooking({ ref: h.ref })).status).toBe("CONFIRMED");
  });

  it("assigns a barber for 'any barber'", async () => {
    const h = await hold({ barberId: "any" });
    expect(h.barberId).toMatch(/-main-street$/);
  });

  it("validates the customer and the branch", async () => {
    expect(await code(hold({ customer: { name: "A", phone: customer.phone } }))).toBe("INVALID_INPUT");
    expect(await code(hold({ customer: { name: "Asha", phone: "12345" } }))).toBe("INVALID_INPUT");
    expect(await code(hold({ branchId: "city-mall", barberId: "any" }))).toBe("BRANCH_PAUSED");
  });

  it("rejects past times and dates beyond 14 days", async () => {
    expect(await code(hold({ startsAt: addMinutes(startOfDay(NOW), 8 * 60).toISOString() }))).toBe("SLOT_UNAVAILABLE");
    expect(await code(hold({ startsAt: at(16, 0, addDays(startOfDay(NOW), 15)) }))).toBe("SLOT_UNAVAILABLE");
  });
});

describe("hold rules from settings", () => {
  beforeEach(emptyCalendar);
  it("FEE_ONLY refuses OTP, OTP_ONLY refuses the fee", async () => {
    await api.saveSettings({ holdMode: "FEE_ONLY" });
    expect(await code(hold({ method: "OTP" }))).toBe("METHOD_NOT_ALLOWED");
    await api.saveSettings({ holdMode: "OTP_ONLY" });
    expect(await code(hold({ method: "FEE" }))).toBe("METHOD_NOT_ALLOWED");
    expect(await code(hold({ method: "OTP" }))).toBe("ok");
  });

  it("requires the fee after 2 no-shows", async () => {
    const repeat = { name: "Test Repeat", phone: REPEAT_NO_SHOW_PHONE };
    const policy = await api.checkHoldPolicy({ phone: REPEAT_NO_SHOW_PHONE });
    expect(policy).toMatchObject({ noShows: 2, allowedMethods: ["FEE"], feeForcedByNoShows: true });
    expect(await code(hold({ customer: repeat, method: "OTP" }))).toBe("FEE_REQUIRED");
    expect(await code(hold({ customer: repeat, method: "FEE" }))).toBe("ok");
    expect((await api.checkHoldPolicy({ phone: customer.phone })).allowedMethods).toEqual(["FEE", "OTP"]);
  });

  it("a fee change applies to new holds", async () => {
    await api.saveSettings({ feeInr: 150 });
    expect((await hold()).feeInr).toBe(150);
  });

  it("holds last as long as the owner says", async () => {
    await api.saveSettings({ unpaidHoldMinutes: 30 });
    expect((await hold()).holdExpiresAt).toBe(addMinutes(NOW, 30).toISOString());
  });
});

describe("OTP limits", () => {
  it("locks for 30 seconds after 3 wrong codes, then accepts the right one", async () => {
    const phone = customer.phone;
    expect(await code(api.verifyOtp({ phone, code: "1111" }))).toBe("OTP_INVALID");
    expect(await code(api.verifyOtp({ phone, code: "2222" }))).toBe("OTP_INVALID");
    expect(await code(api.verifyOtp({ phone, code: "3333" }))).toBe("OTP_LOCKED");
    expect(await code(api.verifyOtp({ phone, code: "4815" }))).toBe("OTP_LOCKED");
    setClock(addMinutes(NOW, 1));
    expect(await code(api.verifyOtp({ phone, code: "4815" }))).toBe("ok");
  });
});

describe("releaseHold and ignoreRef", () => {
  beforeEach(emptyCalendar);

  it("frees an unpaid hold, and is safe to repeat", async () => {
    const h = await hold();
    expect(await code(hold({ customer: { name: "Other", phone: "9822233344" } }))).toBe("SLOT_UNAVAILABLE");
    await api.releaseHold({ ref: h.ref });
    await api.releaseHold({ ref: h.ref });
    expect(await code(hold({ customer: { name: "Other", phone: "9822233344" } }))).toBe("ok");
    expect(await code(api.getBooking(h.ref))).toBe("NOT_FOUND");
  });
  it("refuses to release a confirmed booking or a paid hold", async () => {
    const h = await hold();
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    expect(await code(api.releaseHold({ ref: h.ref }))).toBe("INVALID_STATE");
    await api.confirmBooking({ ref: h.ref });
    expect(await code(api.releaseHold({ ref: h.ref }))).toBe("INVALID_STATE");
  });
  it("ignoreRef shows a booking's own slot as free while rescheduling it", async () => {
    const h = await hold({ barberId: "kabir-main-street", startsAt: at(16) });
    const day = format(TOMORROW, "yyyy-MM-dd");
    const q = { branchId: "main-street", serviceId: "classic-haircut", barberId: "kabir-main-street", date: day };
    const find = (g: Awaited<ReturnType<typeof api.getSlots>>) => [...g.morning, ...g.afternoon, ...g.evening].find((s) => s.startsAt === h.startsAt)!;
    expect(find(await api.getSlots(q)).available).toBe(false);
    expect(find(await api.getSlots({ ...q, ignoreRef: h.ref })).available).toBe(true);
    const counts = (ref?: string) => api.getSlotCounts({ ...q, from: day, days: 1, ignoreRef: ref });
    expect((await counts(h.ref))[0].count).toBe((await counts())[0].count + 1);
  });
});

describe("cancel, refund, reschedule, no-show", () => {
  beforeEach(emptyCalendar);
  async function confirmed(startsAt = at(16)) {
    const h = await hold({ startsAt });
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    return api.confirmBooking({ ref: h.ref });
  }

  it("refunds the fee when cancelling well ahead", async () => {
    const b = await confirmed();
    const r = await api.cancelBooking({ ref: b.ref });
    expect(r).toMatchObject({ refundedInr: 99, booking: { status: "CANCELLED" } });
    expect((await api.getBooking(b.ref)).payment?.status).toBe("REFUNDED");
  });

  it("refunds at exactly 3 hours and not 1 minute later", async () => {
    const start = addMinutes(startOfDay(NOW), 16 * 60); // today 4 PM
    setClock(addMinutes(start, -300));
    const b = await confirmed(start.toISOString());
    setClock(addMinutes(start, -180));
    expect((await api.cancelBooking({ ref: b.ref })).refundedInr).toBe(99);

    setClock(addMinutes(start, -300));
    const b2 = await confirmed(addMinutes(start, 30).toISOString());
    setClock(addMinutes(start, 30 - 179));
    expect((await api.cancelBooking({ ref: b2.ref })).refundedInr).toBe(0);
  });

  it("a cancelled booking frees the slot", async () => {
    const b = await confirmed();
    await api.cancelBooking({ ref: b.ref });
    expect(await code(hold({ customer: { name: "Other", phone: "9822233344" } }))).toBe("ok");
    expect(await code(api.cancelBooking({ ref: b.ref }))).toBe("INVALID_STATE");
  });

  it("reschedules to a free time and refuses an overlap", async () => {
    const b = await confirmed(at(16));
    const other = await hold({ startsAt: at(18), customer: { name: "Other", phone: "9822233344" } });
    expect(await code(api.rescheduleBooking({ ref: b.ref, startsAt: other.startsAt }))).toBe("SLOT_UNAVAILABLE");
    const moved = await api.rescheduleBooking({ ref: b.ref, startsAt: at(17) });
    expect(moved.startsAt).toBe(at(17));
    // Moving onto its own slot range is fine (it ignores itself).
    expect(await code(api.rescheduleBooking({ ref: b.ref, startsAt: at(17, 30) }))).toBe("ok");
  });

  it("marks no-shows only on confirmed bookings", async () => {
    const b = await confirmed();
    expect((await api.markNoShow({ ref: b.ref })).status).toBe("NO_SHOW");
    expect(await code(api.markNoShow({ ref: b.ref }))).toBe("INVALID_STATE");
  });
});

describe("listBookings", () => {
  it("filters, searches, counts and paginates", async () => {
    const all = await api.listBookings();
    expect(all.counts.ALL).toBe(all.total);
    const byStatus = await api.listBookings({ status: "NO_SHOW" });
    expect(byStatus.items.every((b) => b.status === "NO_SHOW")).toBe(true);
    expect(byStatus.counts.ALL).toBe(all.counts.ALL); // counts ignore the status filter
    expect((await api.listBookings({ search: "BR-20481" })).items.map((b) => b.ref)).toEqual(["BR-20481"]);
    expect((await api.listBookings({ search: "aarav mehta" })).items[0].customer.name).toBe("Aarav Mehta");
    expect((await api.listBookings({ search: "9876543210" })).total).toBe(1);
    const page = await api.listBookings({ pageSize: 10, page: 2 });
    expect(page.items).toHaveLength(10);
    const today = format(NOW, "yyyy-MM-dd");
    const day = await api.listBookings({ from: today, to: today, branchId: "main-street" });
    expect(day.items.every((b) => b.branchId === "main-street" && format(new Date(b.startsAt), "yyyy-MM-dd") === today)).toBe(true);
  });
});

describe("settings and branches", () => {
  it("validates the fee as a whole number from 0 to 2000", async () => {
    expect(await code(api.saveSettings({ feeInr: 2001 }))).toBe("INVALID_INPUT");
    expect(await code(api.saveSettings({ feeInr: -1 }))).toBe("INVALID_INPUT");
    expect(await code(api.saveSettings({ feeInr: 9.5 }))).toBe("INVALID_INPUT");
    expect((await api.saveSettings({ feeInr: 0 })).feeInr).toBe(0);
    expect((await api.getSettings()).feeInr).toBe(0);
  });

  it("pausing a branch removes it from the public list but keeps its bookings", async () => {
    const before = (await api.listBookings({ branchId: "lake-view" })).total;
    const lake = (await api.listBranches()).find((b) => b.id === "lake-view")!;
    await api.saveBranch({ ...lake, paused: true });
    expect((await api.listBranches()).map((b) => b.id)).not.toContain("lake-view");
    expect((await api.listBookings({ branchId: "lake-view" })).total).toBe(before);
  });
});

describe("dev error mode", () => {
  beforeEach(emptyCalendar);
  it("payment mode fails the payment but keeps the hold", async () => {
    const h = await hold();
    setDevConfig({ errorMode: "payment" });
    expect(await code(api.simulatePayment({ ref: h.ref, method: "UPI" }))).toBe("PAYMENT_FAILED");
    expect((await api.listBranches()).length).toBe(3);
    setDevConfig({ errorMode: "off" });
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    expect((await api.confirmBooking({ ref: h.ref })).status).toBe("CONFIRMED");
  });
  it("'all' mode fails every call", async () => {
    setDevConfig({ errorMode: "all" });
    expect(await code(api.listBranches())).toBe("SIMULATED_ERROR");
  });
});

describe("getStats", () => {
  it("matches a hand count of the seed", async () => {
    const db = loadDb(NOW);
    const today = format(NOW, "yyyy-MM-dd");
    const todays = db.bookings.filter((b) => format(new Date(b.startsAt), "yyyy-MM-dd") === today);
    const s = await api.getStats({ date: today });
    expect(s.todayBookings).toBe(todays.length);
    expect(s.noShows).toBe(todays.filter((b) => b.status === "NO_SHOW").length);
    expect(s.otpCount).toBe(todays.filter((b) => b.holdMethod === "OTP").length);
    expect(s.byBranch.reduce((n, b) => n + b.count, 0)).toBe(todays.length);
    expect(s.week).toHaveLength(7);
    expect(s.week[4].kind).toBe("today"); // Friday
    expect(s.slotsFilledPct).toBeGreaterThan(0);
    expect(s.slotsFilledPct).toBeLessThanOrEqual(100);
    const paid = db.payments.filter((p) => todays.some((b) => b.ref === p.bookingRef) && (p.status === "PAID" || p.status === "REFUND_DUE"));
    expect(s.feesCollectedInr).toBe(paid.reduce((n, p) => n + p.amountInr, 0));
  });

  it("filters by branch", async () => {
    const all = await api.getStats({ date: format(NOW, "yyyy-MM-dd") });
    const main = await api.getStats({ date: format(NOW, "yyyy-MM-dd") }, "main-street");
    expect(main.todayBookings).toBe(all.byBranch.find((b) => b.branchId === "main-street")!.count);
    expect(main.byBranch).toHaveLength(1);
  });

  it("new bookings show up in the stats", async () => {
    emptyCalendar();
    const day = format(TOMORROW, "yyyy-MM-dd");
    const before = (await api.getStats({ date: day })).todayBookings;
    await hold();
    expect((await api.getStats({ date: day })).todayBookings).toBe(before + 1);
  });
});

describe("admin: status changes, undo and refunds", () => {
  beforeEach(emptyCalendar);
  async function confirmedBooking(startsAt = at(16)) {
    const h = await hold({ startsAt });
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    return api.confirmBooking({ ref: h.ref });
  }

  it("walks a booking through service to completed", async () => {
    const b = await confirmedBooking();
    expect((await api.updateBookingStatus({ ref: b.ref, status: "IN_SERVICE" })).status).toBe("IN_SERVICE");
    const done = await api.updateBookingStatus({ ref: b.ref, status: "COMPLETED" });
    expect(done.status).toBe("COMPLETED");
    expect(done.events.at(-1)).toMatchObject({ type: "COMPLETED", from: "IN_SERVICE" });
  });

  it("blocks invalid transitions with a clear message", async () => {
    const b = await confirmedBooking();
    await api.updateBookingStatus({ ref: b.ref, status: "COMPLETED" });
    await expect(api.updateBookingStatus({ ref: b.ref, status: "CONFIRMED" })).rejects.toMatchObject({ code: "INVALID_STATE", message: "A completed booking cannot become confirmed." });
    await expect(api.updateBookingStatus({ ref: b.ref, status: "CANCELLED" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect((await api.getBooking(b.ref)).booking.status).toBe("COMPLETED");
    const c = await confirmedBooking(at(17));
    await expect(api.updateBookingStatus({ ref: c.ref, status: "PENDING_FEE" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(api.updateBookingStatus({ ref: c.ref, status: "CONFIRMED" })).rejects.toMatchObject({ message: "This booking is already confirmed." });
  });

  it("undoes a no-show, and only the most recent change", async () => {
    const b = await confirmedBooking();
    await api.updateBookingStatus({ ref: b.ref, status: "NO_SHOW" });
    const back = await api.undoStatusChange({ ref: b.ref });
    expect(back.status).toBe("CONFIRMED");
    expect(back.events.some((e) => e.type === "NO_SHOW")).toBe(false);
    expect(await code(api.undoStatusChange({ ref: b.ref }))).toBe("INVALID_STATE"); // nothing left to undo
  });

  it("cancelling leaves a refund due, undo restores the fee and the booking", async () => {
    const b = await confirmedBooking();
    await api.updateBookingStatus({ ref: b.ref, status: "CANCELLED" });
    expect((await api.getBooking(b.ref)).payment?.status).toBe("REFUND_DUE");
    const restored = await api.undoStatusChange({ ref: b.ref });
    expect(restored.status).toBe("CONFIRMED");
    expect((await api.getBooking(b.ref)).payment?.status).toBe("PAID");
  });

  it("refuses to undo a cancellation once the slot was taken", async () => {
    const b = await confirmedBooking();
    await api.updateBookingStatus({ ref: b.ref, status: "CANCELLED" });
    await hold({ customer: { name: "Other", phone: "9822233344" } }); // same barber, same time
    expect(await code(api.undoStatusChange({ ref: b.ref }))).toBe("SLOT_UNAVAILABLE");
    expect((await api.getBooking(b.ref)).booking.status).toBe("CANCELLED");
  });

  it("refunds a cancelled booking once", async () => {
    const b = await confirmedBooking();
    expect(await code(api.refundBooking({ ref: b.ref }))).toBe("INVALID_STATE"); // not cancelled
    await api.updateBookingStatus({ ref: b.ref, status: "CANCELLED" });
    const p = await api.refundBooking({ ref: b.ref });
    expect(p).toMatchObject({ status: "REFUNDED", amountInr: 99 });
    expect((await api.getBooking(b.ref)).booking.events.at(-1)?.type).toBe("REFUNDED");
    expect(await code(api.refundBooking({ ref: b.ref }))).toBe("INVALID_STATE");
  });

  it("confirms an unpaid hold when the fee is collected at the salon", async () => {
    const h = await hold();
    const c = await api.updateBookingStatus({ ref: h.ref, status: "CONFIRMED" });
    expect(c.status).toBe("CONFIRMED");
    expect((await api.getBooking(h.ref)).payment).toMatchObject({ method: "CASH", status: "PAID", amountInr: 99 });
    expect(await code(api.undoStatusChange({ ref: h.ref }))).toBe("INVALID_STATE"); // collecting a fee is not undoable
  });

  it("the customer-facing no-show rule still counts admin no-shows", async () => {
    for (const t of [14, 15]) {
      const b = await confirmedBooking(at(t));
      await api.updateBookingStatus({ ref: b.ref, status: "NO_SHOW" });
    }
    expect((await api.checkHoldPolicy({ phone: customer.phone })).allowedMethods).toEqual(["FEE"]);
  });
});

describe("admin: walk-in bookings", () => {
  beforeEach(emptyCalendar);
  const walkIn = (over: Partial<api.AdminBookingInput> = {}) =>
    api.createAdminBooking({
      branchId: "main-street", serviceId: "classic-haircut", barberId: "kabir-main-street", startsAt: at(16),
      customer: { name: "Walk In", phone: "9833344455" }, fee: "NONE", ...over,
    });

  it("creates a confirmed booking with no fee", async () => {
    const b = await walkIn();
    expect(b).toMatchObject({ status: "CONFIRMED", holdMethod: "NONE", feeInr: 0, holdExpiresAt: null });
    expect((await api.getBooking(b.ref)).payment).toBeNull();
  });
  it("records a fee collected in person as a cash payment", async () => {
    const b = await walkIn({ fee: "COLLECTED" });
    expect(b).toMatchObject({ holdMethod: "FEE", feeInr: 99 });
    expect((await api.getBooking(b.ref)).payment).toMatchObject({ method: "CASH", status: "PAID" });
  });
  it("uses the same slot rules: no overlaps, no paused branches, valid details", async () => {
    await walkIn();
    expect(await code(walkIn({ customer: { name: "Other", phone: "9822233344" } }))).toBe("SLOT_UNAVAILABLE");
    expect(await code(walkIn({ branchId: "city-mall", barberId: "any" }))).toBe("BRANCH_PAUSED");
    expect(await code(walkIn({ customer: { name: "X", phone: "9822233344" }, startsAt: at(17) }))).toBe("INVALID_INPUT");
    expect(await code(walkIn({ customer: { name: "Xx", phone: "123" }, startsAt: at(17) }))).toBe("INVALID_INPUT");
  });
  it("assigns a barber for 'any' and shows up on the dashboard", async () => {
    const day = format(TOMORROW, "yyyy-MM-dd");
    const before = (await api.getStats({ date: day })).todayBookings;
    const b = await walkIn({ barberId: "any", startsAt: at(18) });
    expect(b.barberId).toMatch(/-main-street$/);
    expect((await api.getStats({ date: day })).todayBookings).toBe(before + 1);
  });
});

describe("listBookings for the admin table", () => {
  it("returns names and fee payment, and accepts several statuses at once", async () => {
    const { items } = await api.listBookings({ search: "BR-20481" });
    expect(items[0]).toMatchObject({ serviceName: "Hot Towel Shave", barberName: "Jhon Abraham", branchName: "Main Street", paymentStatus: "PAID", paymentMethod: expect.any(String) });
    const both = await api.listBookings({ status: ["CONFIRMED", "IN_SERVICE"] });
    expect(both.items.every((b) => b.status === "CONFIRMED" || b.status === "IN_SERVICE")).toBe(true);
    const one = await api.listBookings({ status: "CONFIRMED" });
    const svc = await api.listBookings({ status: "IN_SERVICE" });
    expect(both.total).toBe(one.total + svc.total);
    expect(both.counts.CONFIRMED + both.counts.IN_SERVICE).toBe(both.total);
  });
  it("sorts by time both ways", async () => {
    const asc = (await api.listBookings({ sort: "asc", pageSize: 200 })).items.map((b) => b.startsAt);
    const desc = (await api.listBookings({ sort: "desc", pageSize: 200 })).items.map((b) => b.startsAt);
    expect(asc).toEqual([...asc].sort());
    expect(desc).toEqual([...asc].reverse());
  });
  it("the status counts add up to All, so the tabs never disagree with the table", async () => {
    const { counts, total } = await api.listBookings({ from: format(NOW, "yyyy-MM-dd"), to: format(addDays(NOW, 7), "yyyy-MM-dd") });
    const sum = counts.PENDING_FEE + counts.CONFIRMED + counts.IN_SERVICE + counts.COMPLETED + counts.CANCELLED + counts.NO_SHOW;
    expect(sum).toBe(counts.ALL);
    expect(counts.ALL).toBe(total);
  });
});

describe("getCalendarData", () => {
  it("returns the branch's barbers, breaks and the bookings that hold time in range", async () => {
    const today = format(NOW, "yyyy-MM-dd");
    const cal = await api.getCalendarData({ branchId: "main-street", from: today, to: today });
    expect(cal.barbers.map((b) => b.name)).toEqual(["Jhon Abraham", "Arjun Mehta", "Kabir Khan", "Dev Sharma"]);
    expect(cal.breaks).toHaveLength(4);
    expect(cal.breaks.every((k) => k.startMin === 780 && k.endMin === 840)).toBe(true);
    expect(cal.bookings.every((b) => b.branchId === "main-street" && !["CANCELLED", "NO_SHOW"].includes(b.status))).toBe(true);
    expect(cal.bookings.every((b) => format(new Date(b.startsAt), "yyyy-MM-dd") === today)).toBe(true);
    expect(cal.bookings.find((b) => b.ref === "BR-20481")).toMatchObject({ customer: { name: "Aarav Mehta" }, serviceName: "Hot Towel Shave", barberName: "Jhon Abraham" });
  });
  it("matches the database, booking for booking", async () => {
    const db = loadDb(NOW);
    const from = format(NOW, "yyyy-MM-dd");
    const to = format(addDays(NOW, 6), "yyyy-MM-dd");
    const cal = await api.getCalendarData({ branchId: "station-road", from, to });
    const expected = db.bookings.filter((b) => b.branchId === "station-road" && isBlocking(b, NOW) && format(new Date(b.startsAt), "yyyy-MM-dd") >= from && format(new Date(b.startsAt), "yyyy-MM-dd") <= to);
    expect(cal.bookings.map((b) => b.ref).sort()).toEqual(expected.map((b) => b.ref).sort());
  });
  it("hides a booking when it is cancelled and shows a new one straight away", async () => {
    emptyCalendar();
    const h = await hold();
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    await api.confirmBooking({ ref: h.ref });
    const day = format(TOMORROW, "yyyy-MM-dd");
    expect((await api.getCalendarData({ branchId: "main-street", from: day, to: day })).bookings.map((b) => b.ref)).toContain(h.ref);
    await api.updateBookingStatus({ ref: h.ref, status: "CANCELLED" });
    expect((await api.getCalendarData({ branchId: "main-street", from: day, to: day })).bookings.map((b) => b.ref)).not.toContain(h.ref);
  });
  it("rejects an unknown branch", async () => {
    expect(await code(api.getCalendarData({ branchId: "nope", from: "2026-10-02", to: "2026-10-02" }))).toBe("NOT_FOUND");
  });
});

describe("branches: summaries, pausing and the full config", () => {
  const week = (open: number, close: number) => Array.from({ length: 7 }, () => ({ open, close }));
  const base = (over: Partial<Parameters<typeof api.saveBranchConfig>[0]> = {}) => ({
    name: "Harbour Point", address: "9 Harbour Road", phone: "+91 80000 10009", weekHours: week(600, 1260),
    services: [{ serviceId: "classic-haircut" }, { serviceId: "beard-trim", priceOverrideInr: 249 }],
    team: [{ name: "Zoya Khan", specialty: "Fades", breaks: [{ startMin: 900, endMin: 930 }] }], ...over,
  });

  it("gives every branch its numbers, the same ones the dashboard shows", async () => {
    const today = format(NOW, "yyyy-MM-dd");
    const sums = await api.listBranchSummaries();
    expect(sums.map((s) => [s.branch.id, s.barberCount])).toEqual([["main-street", 4], ["station-road", 3], ["lake-view", 3], ["city-mall", 2]]);
    const stats = await api.getStats({ date: today });
    for (const s of sums) {
      expect(s.bookingsToday).toBe(stats.byBranch.find((b) => b.branchId === s.branch.id)!.count);
      expect(s.feesTodayInr).toBe((await api.getStats({ date: today }, s.branch.id)).feesCollectedInr);
    }
  });

  it("pausing hides a branch from the public list and stops new slots, but keeps its bookings", async () => {
    const before = (await api.listBookings({ branchId: "lake-view" })).total;
    await api.setBranchPaused({ branchId: "lake-view", paused: true });
    expect((await api.listBranches()).map((b) => b.id)).not.toContain("lake-view");
    expect((await api.listBranches({ includePaused: true })).find((b) => b.id === "lake-view")!.paused).toBe(true);
    expect(await code(hold({ branchId: "lake-view", barberId: "any", serviceId: "classic-haircut" }))).toBe("BRANCH_PAUSED");
    expect((await api.listBookings({ branchId: "lake-view" })).total).toBe(before);
    await api.setBranchPaused({ branchId: "lake-view", paused: false });
    expect((await api.listBranches()).map((b) => b.id)).toContain("lake-view");
    expect(await code(api.setBranchPaused({ branchId: "nope", paused: true }))).toBe("NOT_FOUND");
  });

  it("creates a branch with services, price overrides, a barber and a break", async () => {
    const b = await api.saveBranchConfig(base());
    expect(b).toMatchObject({ id: "harbour-point", name: "Harbour Point", paused: false });
    expect((await api.listBranches()).map((x) => x.id)).toContain("harbour-point");
    const services = await api.listServices("harbour-point");
    expect(services.map((s) => [s.id, s.priceInr])).toEqual([["classic-haircut", 299], ["beard-trim", 249]]);
    const team = await api.getBranchDetail("harbour-point");
    expect(team.team).toHaveLength(1);
    expect(team.team[0].barber).toMatchObject({ id: "zoya-harbour-point", name: "Zoya Khan" });
    expect(team.team[0].breaks).toEqual([{ id: "brk-zoya-harbour-point-1", barberId: "zoya-harbour-point", startMin: 900, endMin: 930 }]);
    // Customers can book there, but not the service it does not offer, and not during the break.
    const day = format(TOMORROW, "yyyy-MM-dd");
    const slots = await api.getSlots({ branchId: "harbour-point", serviceId: "classic-haircut", barberId: "any", date: day });
    const all = [...slots.morning, ...slots.afternoon, ...slots.evening];
    expect(all.find((s) => format(new Date(s.startsAt), "H:mm") === "15:00")!.available).toBe(false);
    expect(all.find((s) => format(new Date(s.startsAt), "H:mm") === "14:30")!.available).toBe(true);
    const none = await api.getSlots({ branchId: "harbour-point", serviceId: "kids-haircut", barberId: "any", date: day });
    expect([...none.morning, ...none.afternoon, ...none.evening]).toHaveLength(0);
  });

  it("gives a new branch a unique id even when the name repeats", async () => {
    await api.saveBranchConfig(base({ name: "Main Street" }));
    expect((await api.listBranches({ includePaused: true })).map((b) => b.id)).toContain("main-street-2");
  });

  it("editing hours changes the slots; a closed weekday has none", async () => {
    const cfg = async () => {
      const d = await api.getBranchDetail("station-road");
      return {
        id: "station-road", name: d.branch.name, address: d.branch.address, phone: d.branch.phone, weekHours: d.branch.weekHours,
        services: d.offered.map((o) => ({ serviceId: o.serviceId, priceOverrideInr: o.priceOverrideInr })),
        team: d.team.map((t) => ({ id: t.barber.id, name: t.barber.name, specialty: t.barber.specialty, breaks: t.breaks.map((k) => ({ startMin: k.startMin, endMin: k.endMin })) })),
      };
    };
    const c = await cfg();
    const hours = [...c.weekHours];
    hours[TOMORROW.getDay()] = { open: 720, close: 900 }; // tomorrow: noon to 3 PM
    await api.saveBranchConfig({ ...c, weekHours: hours });
    const day = format(TOMORROW, "yyyy-MM-dd");
    const g = await api.getSlots({ branchId: "station-road", serviceId: "classic-haircut", barberId: "any", date: day });
    const times = [...g.morning, ...g.afternoon, ...g.evening].map((s) => format(new Date(s.startsAt), "H:mm"));
    expect(times[0]).toBe("12:00");
    expect(times.at(-1)).toBe("14:30");
    hours[TOMORROW.getDay()] = null;
    await api.saveBranchConfig({ ...c, weekHours: hours });
    const closed = await api.getSlots({ branchId: "station-road", serviceId: "classic-haircut", barberId: "any", date: day });
    expect([...closed.morning, ...closed.afternoon, ...closed.evening]).toHaveLength(0);
  });

  it("removes a barber without bookings but keeps their name on history; refuses when bookings are upcoming", async () => {
    emptyCalendar();
    const d = await api.getBranchDetail("main-street");
    const cfg = (team: typeof d.team) => ({
      id: "main-street", name: d.branch.name, address: d.branch.address, phone: d.branch.phone, weekHours: d.branch.weekHours,
      services: d.offered.map((o) => ({ serviceId: o.serviceId })),
      team: team.map((t) => ({ id: t.barber.id, name: t.barber.name, specialty: t.barber.specialty, breaks: t.breaks.map((k) => ({ startMin: k.startMin, endMin: k.endMin })) })),
    });
    // Kabir has an upcoming booking, so he cannot go, and the rename in the same request is not applied either.
    const h = await hold({ barberId: "kabir-main-street" });
    await api.simulatePayment({ ref: h.ref, method: "UPI" });
    await api.confirmBooking({ ref: h.ref });
    const renamed = { ...cfg(d.team), name: "Renamed Street", team: cfg(d.team).team.filter((t) => t.id !== "kabir-main-street") };
    await expect(api.saveBranchConfig(renamed)).rejects.toMatchObject({ code: "INVALID_STATE", message: expect.stringContaining("Kabir Khan has 1 upcoming booking") });
    expect((await api.getBranchDetail("main-street")).branch.name).toBe("Main Street");
    expect((await api.getBranchDetail("main-street")).team).toHaveLength(4);
    // Dev has no upcoming bookings (only a past, completed one), so Dev can go.
    const seeded = loadDb(NOW);
    const past = addDays(startOfDay(NOW), -2);
    seeded.bookings.push({
      ref: "BR-OLD", branchId: "main-street", serviceId: "classic-haircut", barberId: "dev-main-street", customer: { name: "Old Timer", phone: "9800000001" },
      startsAt: addMinutes(past, 660).toISOString(), endsAt: addMinutes(past, 690).toISOString(), status: "COMPLETED", holdMethod: "OTP", holdExpiresAt: null,
      priceInr: 299, feeInr: 0, createdAt: past.toISOString(), events: [],
    });
    saveDb(seeded);
    await api.saveBranchConfig({ ...cfg(d.team), team: cfg(d.team).team.filter((t) => t.id !== "dev-main-street") });
    expect((await api.listBarbers("main-street")).map((b) => b.name)).not.toContain("Dev Sharma");
    const cal = await api.getCalendarData({ branchId: "main-street", from: format(TOMORROW, "yyyy-MM-dd"), to: format(TOMORROW, "yyyy-MM-dd") });
    expect(cal.barbers.map((b) => b.name)).not.toContain("Dev Sharma");
    // Old bookings still know who Dev was.
    const old = (await api.listBookings({ pageSize: 500 })).items.find((b) => b.barberId === "dev-main-street");
    expect(old?.barberName).toBe("Dev Sharma");
    // And he no longer counts towards capacity.
    expect(loadDb(NOW).barbers.find((b) => b.id === "dev-main-street")?.retired).toBe(true);
  });

  it("checks everything before changing anything", async () => {
    const before = JSON.stringify(loadDb(NOW).branches);
    await expect(api.saveBranchConfig(base({ name: "" }))).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Enter the branch name" });
    await expect(api.saveBranchConfig(base({ services: [] }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(api.saveBranchConfig(base({ services: [{ serviceId: "nope" }] }))).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Unknown service." });
    await expect(api.saveBranchConfig(base({ id: "ghost" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.saveBranchConfig(base({ id: "main-street", team: [{ id: "arjun-station-road", name: "Arjun Mehta", specialty: "", breaks: [] }] }))).rejects.toMatchObject({ code: "INVALID_INPUT", message: "That barber does not work at this branch." });
    expect(JSON.stringify(loadDb(NOW).branches)).toBe(before);
  });
});
