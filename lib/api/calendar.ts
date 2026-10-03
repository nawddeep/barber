import { isBlocking } from "../slots";
import type { Barber, BarberBreak, Branch } from "../types";
import { ApiError, localIso, run } from "./core";
import { toBookingRow, type BookingRow } from "./bookings";

export interface CalendarData {
  branch: Branch;
  /** The branch's barbers, in display order. */
  barbers: Barber[];
  breaks: BarberBreak[];
  /** Bookings that hold a barber's time (confirmed, fee pending, in service, completed). Cancelled and no-shows are left out. */
  bookings: BookingRow[];
}

/** Everything the calendar draws for one branch between two days (yyyy-MM-dd, inclusive). */
export function getCalendarData(input: { branchId: string; from: string; to: string }): Promise<CalendarData> {
  return run("getCalendarData", { readOnly: true }, (db, now) => {
    const branch = db.branches.find((b) => b.id === input.branchId);
    if (!branch) throw new ApiError("NOT_FOUND", "Unknown branch.");
    const barbers = db.barbers.filter((b) => b.branchId === branch.id && !b.retired);
    const ids = new Set(barbers.map((b) => b.id));
    return {
      branch,
      barbers,
      breaks: db.breaks.filter((k) => ids.has(k.barberId)),
      bookings: db.bookings
        .filter((b) => b.branchId === branch.id && isBlocking(b, now) && localIso(new Date(b.startsAt)) >= input.from && localIso(new Date(b.startsAt)) <= input.to)
        .map((b) => toBookingRow(db, b)),
    };
  });
}
