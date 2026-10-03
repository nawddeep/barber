import type { Settings } from "./types";

/**
 * Starting fee rules. Kept apart from the validation schema so pages that only need the numbers
 * (almost all of them) do not download the validation library.
 */
export const DEFAULT_SETTINGS: Settings = {
  feeInr: 99,
  holdMode: "CUSTOMER_CHOOSES",
  adjustFeeInBill: true,
  refundOnEarlyCancel: true,
  refundWindowHours: 3,
  unpaidHoldMinutes: 10,
  advanceBookingDays: 14,
  requireFeeAfterNoShowsEnabled: true,
  requireFeeAfterNoShows: 2,
};
