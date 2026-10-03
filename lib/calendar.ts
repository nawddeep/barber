import { addMinutes, addDays, startOfDay, startOfWeek } from "date-fns";
import { findConflict, SLOT_MIN } from "./slots";
import type { BarberBreak, Booking } from "./types";

/** 72 pixels per hour on the calendar. */
export const HOUR_PX = 72;
export const SNAP_MIN = SLOT_MIN;

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Where a block sits: top and height in pixels, measured from the opening time. */
export function blockBox(startMin: number, endMin: number, openMin: number, hourPx = HOUR_PX) {
  return { top: ((startMin - openMin) / 60) * hourPx, height: ((endMin - startMin) / 60) * hourPx };
}

export const snapMinutes = (min: number, snap = SNAP_MIN) => Math.round(min / snap) * snap;

/** The time (minutes after midnight) at a pixel offset from the top of the grid, snapped to the slot grid. */
export function yToMinutes(y: number, openMin: number, hourPx = HOUR_PX, snap = SNAP_MIN) {
  return snapMinutes(openMin + (y / hourPx) * 60, snap);
}

/** Keeps a block of `durationMin` inside opening hours. */
export const clampStart = (startMin: number, durationMin: number, openMin: number, closeMin: number) =>
  Math.min(Math.max(startMin, openMin), Math.max(openMin, closeMin - durationMin));

/**
 * Where a dragged block lands. `pointerY` and `columnTop` are screen coordinates; `grabOffsetPx` is how far down
 * the block the pointer grabbed it, so the block's top (not the pointer) decides the start time.
 */
export function dropTarget(o: { pointerY: number; grabOffsetPx: number; columnTop: number; openMin: number; closeMin: number; durationMin: number }) {
  const raw = yToMinutes(o.pointerY - o.grabOffsetPx - o.columnTop, o.openMin);
  return clampStart(raw, o.durationMin, o.openMin, o.closeMin);
}

/** Pixel offset of the "now" line, or null when it is outside opening hours. */
export function nowOffset(nowMin: number, openMin: number, closeMin: number, hourPx = HOUR_PX) {
  if (nowMin < openMin || nowMin > closeMin) return null;
  return ((nowMin - openMin) / 60) * hourPx;
}

/** Minutes after midnight for each full hour shown on the time axis. */
export function hourMarks(openMin: number, closeMin: number) {
  const marks: number[] = [];
  for (let m = Math.ceil(openMin / 60) * 60; m <= closeMin; m += 60) marks.push(m);
  return marks;
}

/** "Rahul Sharma" becomes "Rahul S." so it fits a small block. */
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export const weekDays = (date: Date) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, { weekStartsOn: 1 }), i));

export type MoveProblem = "hours" | "past" | "break" | "overlap";

export const MOVE_PROBLEM_TEXT: Record<MoveProblem, string> = {
  hours: "That is outside opening hours.",
  past: "That time has already passed.",
  break: "That falls in the barber's break.",
  overlap: "That time overlaps another booking.",
};

/**
 * Can this booking move to `startMin` on `day` with `barberId`? Uses the same rules as the slot logic:
 * inside opening hours, not in the past, not in a break, and never overlapping another booking for that barber.
 */
export function checkMove(o: {
  booking: Pick<Booking, "ref" | "startsAt" | "endsAt">;
  barberId: string;
  day: Date;
  startMin: number;
  openMin: number;
  closeMin: number;
  bookings: Booking[];
  breaks: BarberBreak[];
  now: Date;
}): { ok: true } | { ok: false; reason: MoveProblem } {
  const duration = (+new Date(o.booking.endsAt) - +new Date(o.booking.startsAt)) / 60000;
  if (o.startMin < o.openMin || o.startMin + duration > o.closeMin) return { ok: false, reason: "hours" };
  const start = addMinutes(startOfDay(o.day), o.startMin);
  const end = addMinutes(start, duration);
  if (start <= o.now) return { ok: false, reason: "past" };
  // The booking being moved must not block itself.
  const others = o.bookings.filter((b) => b.ref !== o.booking.ref);
  const conflict = findConflict(o.barberId, start, end, { breaks: o.breaks, bookings: others }, o.now);
  if (conflict === "break") return { ok: false, reason: "break" };
  if (conflict === "booking") return { ok: false, reason: "overlap" };
  return { ok: true };
}
