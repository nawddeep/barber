import type { BookingEventType, BookingStatus } from "./types";

/** Which status changes the salon may make from the admin panel. Cancelled, completed and no-show are final. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_FEE: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_SERVICE", "COMPLETED", "NO_SHOW", "CANCELLED"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const WORD: Record<BookingStatus, string> = {
  PENDING_FEE: "fee-pending",
  CONFIRMED: "confirmed",
  IN_SERVICE: "in-service",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no-show",
};

export const canTransition = (from: BookingStatus, to: BookingStatus) => TRANSITIONS[from].includes(to);

/** A friendly reason a change is blocked, or null when it is allowed. */
export function transitionError(from: BookingStatus, to: BookingStatus): string | null {
  if (from === to) return `This booking is already ${WORD[from]}.`;
  if (canTransition(from, to)) return null;
  return `A ${WORD[from]} booking cannot become ${WORD[to]}.`;
}

export const eventTypeFor = (status: BookingStatus): BookingEventType =>
  status === "PENDING_FEE" ? "CREATED" : status;

/** Changes the salon can take back with Undo. Cancelling is only undoable from CONFIRMED (a lapsed hold cannot be revived). */
export const UNDOABLE: BookingStatus[] = ["IN_SERVICE", "COMPLETED", "NO_SHOW", "CANCELLED"];
