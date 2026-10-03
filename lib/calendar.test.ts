import { describe, expect, it } from "vitest";
import { addMinutes, startOfDay } from "date-fns";
import {
  HOUR_PX, blockBox, checkMove, clampStart, dropTarget, hourMarks, minutesOfDay, nowOffset, shortName, snapMinutes, weekDays, yToMinutes,
} from "./calendar";
import type { BarberBreak, Booking } from "./types";

const OPEN = 600; // 10 AM
const CLOSE = 1260; // 9 PM
const NOW = new Date(2026, 9, 2, 9, 0); // Friday, before opening
const DAY = new Date(2026, 9, 3); // Saturday

describe("positions", () => {
  it("uses 72px per hour", () => expect(HOUR_PX).toBe(72));
  it("puts the first slot at the top", () => {
    expect(blockBox(600, 630, OPEN)).toEqual({ top: 0, height: 36 });
  });
  it("sizes a block by its length", () => {
    expect(blockBox(600, 660, OPEN).height).toBe(72);
    expect(blockBox(840, 900, OPEN)).toEqual({ top: 288, height: 72 }); // 2 PM hour, 4 hours in
    expect(blockBox(870, 960, OPEN)).toEqual({ top: 324, height: 108 }); // 2:30 PM for 90 min
  });
  it("matches the time axis: a block at 2 PM lines up with the 2 PM line", () => {
    const lineAt2pm = ((14 * 60 - OPEN) / 60) * HOUR_PX;
    expect(blockBox(14 * 60, 15 * 60, OPEN).top).toBe(lineAt2pm);
  });
  it("works for a branch that opens at 11", () => {
    expect(blockBox(660, 690, 660).top).toBe(0);
    expect(blockBox(720, 750, 660).top).toBe(72);
  });
  it("reads the time of a date", () => expect(minutesOfDay(new Date(2026, 9, 2, 14, 30))).toBe(870));
});

describe("time axis", () => {
  it("has a mark every hour from opening to closing", () => {
    const m = hourMarks(OPEN, CLOSE);
    expect(m[0]).toBe(600);
    expect(m.at(-1)).toBe(1260);
    expect(m).toHaveLength(12);
  });
  it("starts at the next full hour when the branch opens on the half hour", () => {
    expect(hourMarks(630, 720)).toEqual([660, 720]);
  });
});

describe("snapping and clamping", () => {
  it("snaps to 30 minutes", () => {
    expect(snapMinutes(614)).toBe(600);
    expect(snapMinutes(616)).toBe(630);
    expect(snapMinutes(645)).toBe(660);
  });
  it("turns a y offset into a snapped time", () => {
    expect(yToMinutes(0, OPEN)).toBe(600);
    expect(yToMinutes(36, OPEN)).toBe(630);
    expect(yToMinutes(50, OPEN)).toBe(630); // 10:41 snaps down
    expect(yToMinutes(55, OPEN)).toBe(660); // 10:46 snaps up
    expect(yToMinutes(324, OPEN)).toBe(870);
  });
  it("keeps a block inside opening hours", () => {
    expect(clampStart(500, 60, OPEN, CLOSE)).toBe(600);
    expect(clampStart(1250, 60, OPEN, CLOSE)).toBe(1200); // a 60 min block must start by 8 PM
    expect(clampStart(900, 60, OPEN, CLOSE)).toBe(900);
  });
  it("lands a drag by the block's top edge, not the pointer", () => {
    // Grabbed 30px down the block; pointer at 400, column top at 100: block top is 270px in, which is 10 AM + 3.75h = 1:45 PM.
    const t = dropTarget({ pointerY: 400, grabOffsetPx: 30, columnTop: 100, openMin: OPEN, closeMin: CLOSE, durationMin: 60 });
    expect(t).toBe(yToMinutes(270, OPEN));
    expect(t).toBe(840); // 1:45 PM snaps up to 2 PM
  });
  it("clamps drags past the edges", () => {
    expect(dropTarget({ pointerY: -500, grabOffsetPx: 0, columnTop: 0, openMin: OPEN, closeMin: CLOSE, durationMin: 30 })).toBe(600);
    expect(dropTarget({ pointerY: 9999, grabOffsetPx: 0, columnTop: 0, openMin: OPEN, closeMin: CLOSE, durationMin: 60 })).toBe(1200);
  });
});

describe("now line", () => {
  it("sits at the right offset", () => {
    expect(nowOffset(15 * 60 + 22, OPEN, CLOSE)).toBeCloseTo(((15 * 60 + 22 - OPEN) / 60) * 72, 5);
    expect(nowOffset(600, OPEN, CLOSE)).toBe(0);
  });
  it("is hidden outside opening hours", () => {
    expect(nowOffset(599, OPEN, CLOSE)).toBeNull();
    expect(nowOffset(1261, OPEN, CLOSE)).toBeNull();
  });
});

describe("names and weeks", () => {
  it("shortens names", () => {
    expect(shortName("Rahul Sharma")).toBe("Rahul S.");
    expect(shortName("  Sameer   Jain ")).toBe("Sameer J.");
    expect(shortName("Cher")).toBe("Cher");
    expect(shortName("Mary Anne van der Berg")).toBe("Mary B.");
  });
  it("lists Monday to Sunday", () => {
    const d = weekDays(new Date(2026, 9, 2));
    expect(d).toHaveLength(7);
    expect(d[0].getDay()).toBe(1);
    expect(d[6].getDay()).toBe(0);
    expect(d[4].getDate()).toBe(2);
  });
});

describe("checkMove (drag-to-reschedule rules)", () => {
  const at = (h: number, m = 0) => addMinutes(startOfDay(DAY), h * 60 + m);
  const bk = (ref: string, barberId: string, h: number, m = 0, minutes = 60): Booking => ({
    ref, branchId: "main", serviceId: "s", barberId, customer: { name: "X", phone: "9000000000" },
    startsAt: at(h, m).toISOString(), endsAt: addMinutes(at(h, m), minutes).toISOString(), status: "CONFIRMED", holdMethod: "FEE",
    holdExpiresAt: null, priceInr: 300, feeInr: 99, createdAt: "", events: [],
  });
  const lunch: BarberBreak[] = [{ id: "l1", barberId: "a", startMin: 780, endMin: 840 }];
  const moving = bk("MOVE", "a", 10, 0, 60);
  const other = bk("OTHER", "a", 15, 0, 60);
  const base = { booking: moving, day: DAY, openMin: OPEN, closeMin: CLOSE, bookings: [moving, other], breaks: lunch, now: NOW };

  it("allows a free slot, and a move onto its own old slot range", () => {
    expect(checkMove({ ...base, barberId: "a", startMin: 11 * 60 })).toEqual({ ok: true });
    expect(checkMove({ ...base, barberId: "a", startMin: 10 * 60 + 30 })).toEqual({ ok: true }); // overlaps only itself
  });
  it("refuses an overlap with another booking, in either direction", () => {
    expect(checkMove({ ...base, barberId: "a", startMin: 15 * 60 })).toEqual({ ok: false, reason: "overlap" });
    expect(checkMove({ ...base, barberId: "a", startMin: 14 * 60 + 30 })).toEqual({ ok: false, reason: "overlap" });
    expect(checkMove({ ...base, barberId: "a", startMin: 15 * 60 + 30 })).toEqual({ ok: false, reason: "overlap" });
  });
  it("allows touching bookings (back to back)", () => {
    expect(checkMove({ ...base, barberId: "a", startMin: 16 * 60 })).toEqual({ ok: true });
    expect(checkMove({ ...base, barberId: "a", startMin: 14 * 60 })).toEqual({ ok: true });
  });
  it("only blocks the barber who is busy", () => {
    expect(checkMove({ ...base, barberId: "b", startMin: 15 * 60 })).toEqual({ ok: true });
  });
  it("refuses the lunch break", () => {
    expect(checkMove({ ...base, barberId: "a", startMin: 13 * 60 })).toEqual({ ok: false, reason: "break" });
    expect(checkMove({ ...base, barberId: "a", startMin: 12 * 60 + 30 })).toEqual({ ok: false, reason: "break" });
    expect(checkMove({ ...base, barberId: "a", startMin: 12 * 60 })).toEqual({ ok: true }); // ends exactly at 1 PM
  });
  it("refuses times outside opening hours", () => {
    expect(checkMove({ ...base, barberId: "a", startMin: 9 * 60 })).toEqual({ ok: false, reason: "hours" });
    expect(checkMove({ ...base, barberId: "a", startMin: 20 * 60 + 30 })).toEqual({ ok: false, reason: "hours" }); // 60 min would end at 9:30 PM
    expect(checkMove({ ...base, barberId: "a", startMin: 20 * 60 })).toEqual({ ok: true });
  });
  it("refuses the past", () => {
    const later = new Date(2026, 9, 3, 12, 0);
    expect(checkMove({ ...base, now: later, barberId: "b", startMin: 11 * 60 })).toEqual({ ok: false, reason: "past" });
    expect(checkMove({ ...base, now: later, barberId: "b", startMin: 12 * 60 })).toEqual({ ok: false, reason: "past" });
    expect(checkMove({ ...base, now: later, barberId: "b", startMin: 12 * 60 + 30 })).toEqual({ ok: true });
  });
  it("ignores cancelled bookings and expired holds", () => {
    const cancelled = { ...other, status: "CANCELLED" as const };
    expect(checkMove({ ...base, bookings: [moving, cancelled], barberId: "a", startMin: 15 * 60 })).toEqual({ ok: true });
    const dead = { ...other, status: "PENDING_FEE" as const, holdExpiresAt: addMinutes(NOW, -1).toISOString() };
    expect(checkMove({ ...base, bookings: [moving, dead], barberId: "a", startMin: 15 * 60 })).toEqual({ ok: true });
    const live = { ...dead, holdExpiresAt: addMinutes(NOW, 5).toISOString() };
    expect(checkMove({ ...base, bookings: [moving, live], barberId: "a", startMin: 15 * 60 })).toEqual({ ok: false, reason: "overlap" });
  });
  it("handles a longer booking that would span a neighbour", () => {
    const long = bk("LONG", "a", 10, 0, 120);
    expect(checkMove({ ...base, booking: long, bookings: [long, other], barberId: "a", startMin: 14 * 60 })).toEqual({ ok: false, reason: "overlap" });
    expect(checkMove({ ...base, booking: long, bookings: [long, other], barberId: "a", startMin: 16 * 60 })).toEqual({ ok: true });
  });
});
