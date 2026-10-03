import type { BookingStatus } from "@/lib/types";

/** Block colours from the calendar legend. */
export const BLOCK_STYLE: Partial<Record<BookingStatus, string>> = {
  CONFIRMED: "bg-status-confirmed",
  PENDING_FEE: "bg-butter",
  IN_SERVICE: "bg-status-service",
  COMPLETED: "bg-status-done",
};

/** The hatched look of a break. */
export const HATCH = "bg-[repeating-linear-gradient(135deg,#e6ddca_0_2px,#f3ecdd_2px_7px)]";
