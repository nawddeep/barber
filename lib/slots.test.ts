import { describe, expect, it } from "vitest";
import { addDays, addMinutes, format, startOfDay } from "date-fns";
import { buildSeed } from "./mock/seed";
import { DEFAULT_SETTINGS } from "./settings-schema";
import { allSlots, getAvailableSlots, occupiedMinutes, type SlotData } from "./slots";
import type { Booking } from "./types";

// Friday 2 Oct 2026, 9:00 AM local: before opening, so nothing is "past".
const NOW = new Date(2026, 9, 2, 9, 0);
const TOMORROW = "2026-10-03";

function data(bookings: Booking[] = []): SlotData {
  const db = buildSeed(NOW, DEFAULT_SETTINGS);
  return { ...db, bookings };
}

function booking(barberId: string, start: Date, minutes: number, status: Booking["status"] = "CONFIRMED"): Booking {
  return {
    ref: `T-${barberId}-${+start}`, branchId: "main-street", serviceId: "classic-haircut", barberId,
    customer: { name: "Test", phone: "9999999999" }, startsAt: start.toISOString(),
    endsAt: addMinutes(start, minutes).toISOString(), status, holdMethod: "FEE",
    holdExpiresAt: status === "PENDING_FEE" ? addMinutes(NOW, 5).toISOString() : null,
    priceInr: 299, feeInr: 99, createdAt: NOW.toISOString(), events: [],
  };
}

const at = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
};
const q = (over: Partial<Parameters<typeof getAvailableSlots>[0]> = {}) => ({
  branchId: "main-street", serviceId: "hot-towel-shave", date: TOMORROW, barberId: "jhon-main-street", ...over,
});
const label = (iso: string) => format(new Date(iso), "H:mm");
const find = (groups: ReturnType<typeof getAvailableSlots>, time: string) =>
  allSlots(groups).find((s) => label(s.startsAt) === time);

describe("occupiedMinutes", () => {
  it("rounds up to whole 30-minute slots", () => {
    expect(occupiedMinutes(25)).toBe(30);
    expect(occupiedMinutes(30)).toBe(30);
    expect(occupiedMinutes(40)).toBe(60);
    expect(occupiedMinutes(50)).toBe(60);
  });
});

describe("getAvailableSlots", () => {
  it("runs from opening time until the service still fits before closing", () => {
    const slots = allSlots(getAvailableSlots(q(), data(), NOW));
    expect(label(slots[0].startsAt)).toBe("10:00");
    // Hot Towel Shave occupies 60 min, so the last start is 8:00 PM (ends at closing).
    expect(label(slots.at(-1)!.startsAt)).toBe("20:00");
  });

  it("groups by morning, afternoon and evening", () => {
    const g = getAvailableSlots(q(), data(), NOW);
    expect(g.morning.every((s) => new Date(s.startsAt).getHours() < 12)).toBe(true);
    expect(g.afternoon.every((s) => { const h = new Date(s.startsAt).getHours(); return h >= 12 && h < 17; })).toBe(true);
    expect(g.evening.every((s) => new Date(s.startsAt).getHours() >= 17)).toBe(true);
    expect(g.morning.length + g.afternoon.length + g.evening.length).toBeGreaterThan(10);
  });

  it("blocks consecutive slots for a service longer than 30 minutes", () => {
    const d = data([booking("jhon-main-street", at(TOMORROW, 11), 60)]);
    const g = getAvailableSlots(q(), d, NOW);
    expect(find(g, "10:00")!.available).toBe(true); // 10:00-11:00 touches but does not overlap
    expect(find(g, "10:30")!.available).toBe(false);
    expect(find(g, "11:00")!.available).toBe(false);
    expect(find(g, "11:30")!.available).toBe(false);
    expect(find(g, "12:00")!.available).toBe(true);
  });

  it("respects the 1 PM to 2 PM lunch break", () => {
    const g = getAvailableSlots(q(), data(), NOW);
    expect(find(g, "12:00")!.available).toBe(true); // ends exactly at 1 PM
    expect(find(g, "12:30")!.available).toBe(false);
    expect(find(g, "13:00")!.available).toBe(false);
    expect(find(g, "13:30")!.available).toBe(false);
    expect(find(g, "14:00")!.available).toBe(true);
  });

  it("never offers past times", () => {
    const later = new Date(2026, 9, 2, 15, 10);
    const slots = allSlots(getAvailableSlots(q({ date: "2026-10-02" }), data(), later));
    expect(label(slots[0].startsAt)).toBe("15:30");
  });

  it("returns nothing for yesterday and beyond the 14-day limit", () => {
    const d = data();
    const day = (n: number) => format(addDays(startOfDay(NOW), n), "yyyy-MM-dd");
    expect(allSlots(getAvailableSlots(q({ date: day(-1) }), d, NOW))).toHaveLength(0);
    expect(allSlots(getAvailableSlots(q({ date: day(14) }), d, NOW)).length).toBeGreaterThan(0);
    expect(allSlots(getAvailableSlots(q({ date: day(15) }), d, NOW))).toHaveLength(0);
  });

  it("returns nothing for a paused branch, an unoffered service or a barber from another branch", () => {
    const d = data();
    expect(allSlots(getAvailableSlots(q({ branchId: "city-mall", barberId: "any" }), d, NOW))).toHaveLength(0);
    d.branchServices = d.branchServices.filter((bs) => !(bs.branchId === "main-street" && bs.serviceId === "hot-towel-shave"));
    expect(allSlots(getAvailableSlots(q(), d, NOW))).toHaveLength(0);
    expect(allSlots(getAvailableSlots(q({ barberId: "dev-lake-view" }), data(), NOW))).toHaveLength(0);
  });

  it("ignores cancelled bookings and expired unpaid holds, but honours live holds", () => {
    const start = at(TOMORROW, 11);
    const cancelled = booking("jhon-main-street", start, 60, "CANCELLED");
    const liveHold = booking("jhon-main-street", at(TOMORROW, 16), 60, "PENDING_FEE");
    const deadHold = { ...booking("jhon-main-street", at(TOMORROW, 18), 60, "PENDING_FEE"), holdExpiresAt: addMinutes(NOW, -1).toISOString() };
    const g = getAvailableSlots(q(), data([cancelled, liveHold, deadHold]), NOW);
    expect(find(g, "11:00")!.available).toBe(true);
    expect(find(g, "16:00")!.available).toBe(false);
    expect(find(g, "18:00")!.available).toBe(true);
  });

  describe("any barber", () => {
    it("is open while at least one barber is free, and says who is assigned", () => {
      const d = data([booking("jhon-main-street", at(TOMORROW, 11), 60)]);
      const slot = find(getAvailableSlots(q({ barberId: "any" }), d, NOW), "11:00")!;
      expect(slot.available).toBe(true);
      expect(slot.freeBarberIds).not.toContain("jhon-main-street");
      expect(slot.freeBarberIds).toHaveLength(3);
      expect(slot.barberId).toBe(slot.freeBarberIds.includes(slot.barberId!) ? slot.barberId : null);
    });

    it("is taken only when every barber is busy", () => {
      const all = ["jhon", "arjun", "kabir", "dev"].map((k) => booking(`${k}-main-street`, at(TOMORROW, 11), 60));
      const slot = find(getAvailableSlots(q({ barberId: "any" }), data(all), NOW), "11:00")!;
      expect(slot.available).toBe(false);
      expect(slot.barberId).toBeNull();
    });

    it("spreads assignments towards the least busy barber", () => {
      const busy = [booking("jhon-main-street", at(TOMORROW, 10), 60), booking("arjun-main-street", at(TOMORROW, 15), 60)];
      const slot = find(getAvailableSlots(q({ barberId: "any" }), data(busy), NOW), "11:00")!;
      expect(["kabir-main-street", "dev-main-street"]).toContain(slot.barberId);
    });
  });

  it("uses one slot for a 25-minute kids haircut", () => {
    const slot = find(getAvailableSlots(q({ serviceId: "kids-haircut" }), data(), NOW), "10:00")!;
    expect(+new Date(slot.endsAt) - +new Date(slot.startsAt)).toBe(30 * 60_000);
  });
});
