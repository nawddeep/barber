import type { Booking, HoldMethod, Payment, Settings } from "./types";

export function noShowCount(bookings: Booking[], phone: string) {
  return bookings.filter((b) => b.customer.phone === phone && b.status === "NO_SHOW").length;
}

/** Which ways of holding a slot this customer may use right now. */
export function allowedHoldMethods(settings: Settings, noShows: number): HoldMethod[] {
  if (settings.requireFeeAfterNoShowsEnabled && noShows >= settings.requireFeeAfterNoShows) return ["FEE"];
  if (settings.holdMode === "FEE_ONLY") return ["FEE"];
  if (settings.holdMode === "OTP_ONLY") return ["OTP"];
  return ["FEE", "OTP"];
}

export interface RefundDecision {
  refund: boolean;
  amountInr: number;
}

/** Free cancellation up to `refundWindowHours` before the slot (exactly at the limit still counts). */
export function refundDecision(
  booking: Pick<Booking, "startsAt">,
  payment: Payment | undefined,
  settings: Settings,
  now: Date,
): RefundDecision {
  const paid = payment?.status === "PAID" ? payment.amountInr : 0;
  const msBefore = +new Date(booking.startsAt) - +now;
  const early = msBefore >= settings.refundWindowHours * 3_600_000;
  const refund = paid > 0 && settings.refundOnEarlyCancel && early;
  return { refund, amountInr: refund ? paid : 0 };
}

/** Amount left to pay at the salon. */
export function dueAtSalon(priceInr: number, feeInr: number, settings: Settings) {
  return settings.adjustFeeInBill ? Math.max(priceInr - feeInr, 0) : priceInr;
}
