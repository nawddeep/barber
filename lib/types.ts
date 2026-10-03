export type BookingStatus =
  | "PENDING_FEE"
  | "CONFIRMED"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type HoldMethod = "FEE" | "OTP";
export type HoldMode = "FEE_ONLY" | "OTP_ONLY" | "CUSTOMER_CHOOSES";
export type PaymentMethod = "UPI" | "CARD" | "NETBANKING" | "CASH";

/** Opening hours for one weekday, in minutes after midnight (local time). */
export interface DayHours {
  open: number;
  close: number;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  /** Index = date-fns getDay(): 0 Sunday … 6 Saturday. null = closed that day. */
  weekHours: (DayHours | null)[];
  /** Paused branches are hidden from the public flow; existing bookings stay. */
  paused: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  priceInr: number;
  durationMin: number;
  tint: "yellow" | "mint" | "peach" | "lavender" | "butter";
}

export interface BranchService {
  branchId: string;
  serviceId: string;
  priceOverrideInr?: number;
}

export interface Barber {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  branchId: string;
  /** Removed from the team. Kept so old bookings still show the barber's name. */
  retired?: boolean;
}

export interface BarberBreak {
  id: string;
  barberId: string;
  startMin: number;
  endMin: number;
}

export interface Customer {
  name: string;
  /** 10-digit Indian mobile number, no country code. */
  phone: string;
}

export type BookingEventType =
  | "CREATED"
  | "OTP_VERIFIED"
  | "FEE_RECEIVED"
  | "CONFIRMED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "REFUNDED"
  | "NO_SHOW"
  | "IN_SERVICE"
  | "COMPLETED";

export interface BookingEvent {
  at: string;
  type: BookingEventType;
  note?: string;
  /** Set on status changes made from the admin panel: the status before the change (used for Undo). */
  from?: BookingStatus;
}

export interface Booking {
  /** Looks like "BR-20481". */
  ref: string;
  branchId: string;
  serviceId: string;
  barberId: string;
  customer: Customer;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  /** NONE = a walk-in or phone booking added by the salon with no fee. */
  holdMethod: HoldMethod | "NONE";
  /** Only set while status is PENDING_FEE. */
  holdExpiresAt: string | null;
  priceInr: number;
  /** Fee charged to hold the slot. 0 for OTP holds. */
  feeInr: number;
  createdAt: string;
  events: BookingEvent[];
}

export type PaymentStatus = "PAID" | "REFUNDED" | "REFUND_DUE" | "FAILED";

/** Simulated payment. // MOCK: no real gateway exists. */
export interface Payment {
  id: string;
  bookingRef: string;
  amountInr: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
}

export interface Settings {
  feeInr: number;
  holdMode: HoldMode;
  adjustFeeInBill: boolean;
  /** Master switch for "Refund on early cancellation". */
  refundOnEarlyCancel: boolean;
  refundWindowHours: number;
  unpaidHoldMinutes: number;
  advanceBookingDays: number;
  /** Master switch for "Require fee after N no-shows". */
  requireFeeAfterNoShowsEnabled: boolean;
  requireFeeAfterNoShows: number;
}
