import { format } from "date-fns";
import type { BookingRow } from "./api/bookings";

/**
 * One CSV cell. Quotes values with commas, quotes or line breaks, and defuses spreadsheet formulas:
 * text starting with = + - @ would be run as a formula by Excel, so it gets a leading apostrophe.
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const toCsv = (rows: Array<Array<string | number | null | undefined>>) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

const HOLD = { FEE: "Fee", OTP: "OTP", NONE: "Walk-in" } as const;

export const BOOKING_CSV_HEADER = [
  "Ref", "Customer", "Phone", "Service", "Barber", "Branch", "Date", "Time", "Status", "Hold method", "Price (INR)", "Fee (INR)", "Fee payment",
];

/** The bookings exactly as filtered on screen (all pages), one row each. */
export function bookingsToCsv(rows: BookingRow[]) {
  return toCsv([
    BOOKING_CSV_HEADER,
    ...rows.map((b) => [
      b.ref, b.customer.name, b.customer.phone, b.serviceName, b.barberName, b.branchName,
      format(new Date(b.startsAt), "yyyy-MM-dd"), format(new Date(b.startsAt), "h:mm a"),
      b.status, HOLD[b.holdMethod], b.priceInr, b.feeInr, b.paymentStatus ?? "None",
    ]),
  ]);
}
