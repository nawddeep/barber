import { addMinutes } from "date-fns";
import { allowedHoldMethods, noShowCount, refundDecision } from "../rules";
import { allSlots, getAvailableSlots, priceFor } from "../slots";
import { canTransition, eventTypeFor, transitionError, UNDOABLE } from "../transitions";
import { findConflict } from "../slots";
import type {
  Barber, Booking, BookingEvent, BookingStatus, Branch, Customer, HoldMethod, Payment, PaymentMethod, PaymentStatus, Service,
} from "../types";
import { ApiError, run, toSlotData } from "./core";
import type { Db } from "../mock/db";

const iso = (d: Date) => d.toISOString();
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function ev(now: Date, type: BookingEvent["type"], note?: string): BookingEvent {
  return { at: iso(now), type, note };
}

function findBooking(db: Db, ref: string): Booking {
  const b = db.bookings.find((x) => x.ref === ref);
  if (b) return b;
  if (db.expiredRefs.includes(ref)) throw new ApiError("HOLD_EXPIRED", "Your hold ran out and the slot was released.");
  throw new ApiError("NOT_FOUND", `No booking ${ref}.`);
}

const paymentFor = (db: Db, ref: string) => db.payments.find((p) => p.bookingRef === ref);

export interface HoldPolicy {
  noShows: number;
  allowedMethods: HoldMethod[];
  /** True when the no-show rule (not the owner's hold mode) forced the fee. */
  feeForcedByNoShows: boolean;
}

/** Which hold options this phone number may use. Drives the "Hold your slot" cards in step 3. */
export function checkHoldPolicy(input: { phone: string }): Promise<HoldPolicy> {
  return run("checkHoldPolicy", { readOnly: true }, (db) => {
    const noShows = noShowCount(db.bookings, input.phone);
    const allowedMethods = allowedHoldMethods(db.settings, noShows);
    const base = allowedHoldMethods(db.settings, 0);
    return { noShows, allowedMethods, feeForcedByNoShows: base.includes("OTP") && !allowedMethods.includes("OTP") };
  });
}

export interface CreateHoldInput {
  branchId: string;
  serviceId: string;
  /** A barber id, or "any". */
  barberId: string;
  startsAt: string;
  customer: Customer;
  method: HoldMethod;
}

/** Reserves the slot as PENDING_FEE until it is paid or OTP-verified (see confirmBooking). */
export function createHold(input: CreateHoldInput): Promise<Booking> {
  return run("createHold", {}, (db, now) => {
    const { customer } = input;
    if (customer.name.trim().length < 2) throw new ApiError("INVALID_INPUT", "Enter your name.");
    if (!/^\d{10}$/.test(customer.phone)) throw new ApiError("INVALID_INPUT", "Enter a 10-digit mobile number.");

    const branch = db.branches.find((b) => b.id === input.branchId);
    if (!branch) throw new ApiError("NOT_FOUND", "Unknown branch.");
    if (branch.paused) throw new ApiError("BRANCH_PAUSED", `${branch.name} is not taking bookings right now.`);

    const noShows = noShowCount(db.bookings, customer.phone);
    const allowed = allowedHoldMethods(db.settings, noShows);
    if (!allowed.includes(input.method)) {
      if (input.method === "OTP" && db.settings.requireFeeAfterNoShowsEnabled && noShows >= db.settings.requireFeeAfterNoShows) {
        throw new ApiError("FEE_REQUIRED", "After missed bookings we ask for the booking fee.");
      }
      throw new ApiError("METHOD_NOT_ALLOWED", "That way of holding a slot is not available.");
    }

    const start = new Date(input.startsAt);
    const slots = allSlots(
      getAvailableSlots(
        { branchId: input.branchId, serviceId: input.serviceId, date: localDate(start), barberId: input.barberId },
        toSlotData(db),
        now,
      ),
    );
    const slot = slots.find((s) => +new Date(s.startsAt) === +start);
    if (!slot || !slot.available || !slot.barberId) {
      throw new ApiError("SLOT_UNAVAILABLE", "That slot is no longer available.");
    }

    const fee = input.method === "FEE" ? db.settings.feeInr : 0;
    const booking: Booking = {
      ref: `BR-${db.counters.nextRef++}`,
      branchId: input.branchId,
      serviceId: input.serviceId,
      barberId: slot.barberId,
      customer: { name: customer.name.trim(), phone: customer.phone },
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "PENDING_FEE",
      holdMethod: input.method,
      holdExpiresAt: iso(addMinutes(now, db.settings.unpaidHoldMinutes)),
      priceInr: priceFor(input.branchId, input.serviceId, db)!,
      feeInr: fee,
      createdAt: iso(now),
      events: [ev(now, "CREATED", "Booking created on website")],
    };
    db.bookings.push(booking);
    return booking;
  });
}

/** Gives up an unpaid hold and frees the slot. Safe to call twice. A hold with a paid fee cannot be released. */
export function releaseHold(input: { ref: string }): Promise<void> {
  return run("releaseHold", {}, (db) => {
    const booking = db.bookings.find((b) => b.ref === input.ref);
    if (!booking) return;
    if (booking.status !== "PENDING_FEE") throw new ApiError("INVALID_STATE", "Only unpaid holds can be released.");
    if (paymentFor(db, booking.ref)?.status === "PAID") throw new ApiError("INVALID_STATE", "The fee is already paid.");
    db.bookings = db.bookings.filter((b) => b.ref !== booking.ref);
  });
}

/** MOCK: a fake checkout. Always succeeds unless dev error mode is on. */
export function simulatePayment(input: { ref: string; method: PaymentMethod }): Promise<Payment> {
  return run("simulatePayment", { payment: true }, (db, now) => {
    const booking = findBooking(db, input.ref);
    if (booking.status !== "PENDING_FEE" || booking.holdMethod !== "FEE") {
      throw new ApiError("INVALID_STATE", "This booking does not need a fee.");
    }
    const existing = paymentFor(db, booking.ref);
    if (existing?.status === "PAID") return existing;
    const payment: Payment = {
      id: `pay-${db.counters.nextPayment++}`,
      bookingRef: booking.ref,
      amountInr: booking.feeInr,
      method: input.method,
      status: "PAID",
      createdAt: iso(now),
    };
    db.payments.push(payment);
    booking.events.push(ev(now, "FEE_RECEIVED", `₹${payment.amountInr} fee received`));
    return payment;
  });
}

/** Turns a hold into a CONFIRMED booking once the fee is paid or the phone is OTP-verified. */
export function confirmBooking(input: { ref: string }): Promise<Booking> {
  return run("confirmBooking", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    if (booking.status === "CONFIRMED") return booking;
    if (booking.status !== "PENDING_FEE") throw new ApiError("INVALID_STATE", "This booking cannot be confirmed.");

    if (booking.holdMethod === "FEE") {
      if (paymentFor(db, booking.ref)?.status !== "PAID") {
        throw new ApiError("PAYMENT_REQUIRED", "Pay the booking fee to confirm.");
      }
    } else {
      const verified = db.otp[booking.customer.phone]?.verifiedUntil;
      if (!verified || verified < +now) throw new ApiError("OTP_REQUIRED", "Verify your phone number to confirm.");
      booking.events.push(ev(now, "OTP_VERIFIED", "Phone verified by OTP"));
    }
    booking.status = "CONFIRMED";
    booking.holdExpiresAt = null;
    booking.events.push(ev(now, "CONFIRMED"));
    return booking;
  });
}

export interface CancelResult {
  booking: Booking;
  refundedInr: number;
}

/** Free cancellation, with the fee refunded, up to the refund window before the slot. */
export function cancelBooking(input: { ref: string }): Promise<CancelResult> {
  return run("cancelBooking", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    if (booking.status !== "PENDING_FEE" && booking.status !== "CONFIRMED") {
      throw new ApiError("INVALID_STATE", "This booking can no longer be cancelled.");
    }
    const payment = paymentFor(db, booking.ref);
    const decision = refundDecision(booking, payment, db.settings, now);
    booking.status = "CANCELLED";
    booking.holdExpiresAt = null;
    booking.events.push(ev(now, "CANCELLED"));
    if (decision.refund && payment) {
      payment.status = "REFUNDED";
      booking.events.push(ev(now, "REFUNDED", `₹${decision.amountInr} refunded`));
    }
    return { booking, refundedInr: decision.amountInr };
  });
}

/** Moves a booking to a new time and/or barber. Rejects anything that would overlap. */
export function rescheduleBooking(input: { ref: string; startsAt: string; barberId?: string }): Promise<Booking> {
  return run("rescheduleBooking", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    if (booking.status !== "PENDING_FEE" && booking.status !== "CONFIRMED") {
      throw new ApiError("INVALID_STATE", "This booking can no longer be moved.");
    }
    const start = new Date(input.startsAt);
    // Judge the move as if this booking were not on the calendar yet.
    const data = { ...toSlotData(db), bookings: db.bookings.filter((b) => b.ref !== booking.ref) };
    const slot = allSlots(
      getAvailableSlots(
        {
          branchId: booking.branchId,
          serviceId: booking.serviceId,
          date: localDate(start),
          barberId: input.barberId ?? booking.barberId,
        },
        data,
        now,
      ),
    ).find((s) => +new Date(s.startsAt) === +start);
    if (!slot || !slot.available || !slot.barberId) {
      throw new ApiError("SLOT_UNAVAILABLE", "That time is not available.");
    }
    booking.startsAt = slot.startsAt;
    booking.endsAt = slot.endsAt;
    booking.barberId = slot.barberId;
    booking.events.push(ev(now, "RESCHEDULED"));
    return booking;
  });
}

export function markNoShow(input: { ref: string }): Promise<Booking> {
  return run("markNoShow", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    if (booking.status !== "CONFIRMED") throw new ApiError("INVALID_STATE", "Only confirmed bookings can be marked no-show.");
    booking.status = "NO_SHOW";
    booking.events.push(ev(now, "NO_SHOW"));
    return booking;
  });
}

export interface BookingFilters {
  branchId?: string;
  status?: BookingStatus | BookingStatus[];
  /** yyyy-MM-dd, inclusive. */
  from?: string;
  to?: string;
  /** Matches name, phone or booking ref. */
  search?: string;
  sort?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/** A booking with the names and fee-payment info the admin screens show. */
export interface BookingRow extends Booking {
  serviceName: string;
  barberName: string;
  branchName: string;
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentMethod | null;
}

export function toBookingRow(db: Db, b: Booking): BookingRow {
  const pay = paymentFor(db, b.ref);
  return {
    ...b,
    serviceName: db.services.find((x) => x.id === b.serviceId)?.name ?? "",
    barberName: db.barbers.find((x) => x.id === b.barberId)?.name ?? "",
    branchName: db.branches.find((x) => x.id === b.branchId)?.name ?? "",
    paymentStatus: pay?.status ?? null,
    paymentMethod: pay?.method ?? null,
  };
}

export interface BookingList {
  items: BookingRow[];
  total: number;
  /** Counts per status for the current filters, ignoring the status filter itself. */
  counts: Record<"ALL" | BookingStatus, number>;
}

export function listBookings(filters: BookingFilters = {}): Promise<BookingList> {
  return run("listBookings", { readOnly: true }, (db) => {
    const q = filters.search?.trim().toLowerCase();
    const base = db.bookings.filter((b) => {
      if (filters.branchId && b.branchId !== filters.branchId) return false;
      const day = localDate(new Date(b.startsAt));
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (q && !(b.customer.name.toLowerCase().includes(q) || b.customer.phone.includes(q) || b.ref.toLowerCase().includes(q))) return false;
      return true;
    });
    const counts = { ALL: base.length, PENDING_FEE: 0, CONFIRMED: 0, IN_SERVICE: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
    for (const b of base) counts[b.status]++;
    const wanted = filters.status ? ([] as BookingStatus[]).concat(filters.status) : null;
    const filtered = wanted ? base.filter((b) => wanted.includes(b.status)) : base;
    const dir = filters.sort === "desc" ? -1 : 1;
    const sorted = [...filtered].sort((a, b) => dir * (+new Date(a.startsAt) - +new Date(b.startsAt)));
    const size = filters.pageSize ?? sorted.length;
    const page = Math.max(filters.page ?? 1, 1);
    const items = sorted.slice((page - 1) * size, page * size).map((b) => toBookingRow(db, b));
    return { items, total: sorted.length, counts };
  });
}

export interface BookingDetail {
  booking: Booking;
  payment: Payment | null;
  branch: Branch;
  service: Service;
  barber: Barber;
  visitCount: number;
}

export function getBooking(ref: string): Promise<BookingDetail> {
  return run("getBooking", { readOnly: true }, (db) => {
    const booking = findBooking(db, ref);
    return {
      booking,
      payment: paymentFor(db, ref) ?? null,
      branch: db.branches.find((b) => b.id === booking.branchId)!,
      service: db.services.find((s) => s.id === booking.serviceId)!,
      barber: db.barbers.find((b) => b.id === booking.barberId)!,
      visitCount: db.bookings.filter(
        (b) => b.customer.phone === booking.customer.phone && b.status === "COMPLETED",
      ).length,
    };
  });
}

// ---- Admin actions -------------------------------------------------------------------------------

function cashPayment(db: Db, booking: Booking, now: Date): Payment {
  const payment: Payment = {
    id: `pay-${db.counters.nextPayment++}`,
    bookingRef: booking.ref,
    amountInr: booking.feeInr,
    method: "CASH",
    status: "PAID",
    createdAt: iso(now),
  };
  db.payments.push(payment);
  return payment;
}

/** Moves a booking along its life: confirmed, in service, completed, no-show or cancelled. Blocks invalid jumps. */
export function updateBookingStatus(input: { ref: string; status: BookingStatus }): Promise<Booking> {
  return run("updateBookingStatus", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    const from = booking.status;
    const blocked = transitionError(from, input.status);
    if (blocked || !canTransition(from, input.status)) throw new ApiError("INVALID_STATE", blocked ?? "That change is not allowed.");

    let note: string | undefined;
    if (input.status === "CONFIRMED") {
      // The salon collected the fee in person.
      if (booking.holdMethod === "FEE" && paymentFor(db, booking.ref)?.status !== "PAID") {
        cashPayment(db, booking, now);
        booking.events.push(ev(now, "FEE_RECEIVED", `₹${booking.feeInr} fee collected at the salon`));
      }
      booking.holdExpiresAt = null;
    }
    if (input.status === "CANCELLED") {
      booking.holdExpiresAt = null;
      const pay = paymentFor(db, booking.ref);
      if (pay?.status === "PAID") pay.status = "REFUND_DUE";
      note = "Cancelled by the salon";
    }
    booking.status = input.status;
    booking.events.push({ ...ev(now, eventTypeFor(input.status), note), from });
    return booking;
  });
}

/** Takes back the most recent status change (the "Undo" in the toast). Refuses if it is no longer safe. */
export function undoStatusChange(input: { ref: string }): Promise<Booking> {
  return run("undoStatusChange", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    const last = booking.events.at(-1);
    if (!last?.from || last.type !== eventTypeFor(booking.status) || !UNDOABLE.includes(booking.status)) {
      throw new ApiError("INVALID_STATE", "There is nothing to undo.");
    }
    if (booking.status === "CANCELLED") {
      if (last.from !== "CONFIRMED") throw new ApiError("INVALID_STATE", "That cancellation cannot be undone.");
      const others = db.bookings.filter((b) => b.ref !== booking.ref);
      if (findConflict(booking.barberId, new Date(booking.startsAt), new Date(booking.endsAt), { breaks: db.breaks, bookings: others }, now)) {
        throw new ApiError("SLOT_UNAVAILABLE", "That slot has been taken since, so the booking cannot be restored.");
      }
      const pay = paymentFor(db, booking.ref);
      if (pay?.status === "REFUND_DUE") pay.status = "PAID";
    }
    booking.status = last.from;
    booking.events.pop();
    return booking;
  });
}

/** Sends the fee back on a cancelled booking (simulated). */
export function refundBooking(input: { ref: string }): Promise<Payment> {
  return run("refundBooking", {}, (db, now) => {
    const booking = findBooking(db, input.ref);
    const pay = paymentFor(db, booking.ref);
    if (booking.status !== "CANCELLED" || !pay || (pay.status !== "REFUND_DUE" && pay.status !== "PAID")) {
      throw new ApiError("INVALID_STATE", "There is no fee to refund on this booking.");
    }
    pay.status = "REFUNDED";
    booking.events.push(ev(now, "REFUNDED", `₹${pay.amountInr} refunded`));
    return pay;
  });
}

export interface AdminBookingInput {
  branchId: string;
  serviceId: string;
  /** A barber id, or "any". */
  barberId: string;
  startsAt: string;
  customer: Customer;
  /** COLLECTED: the fee was taken in person. NONE: no fee. */
  fee: "COLLECTED" | "NONE";
}

/** Walk-in or phone booking. Confirmed straight away, no hold. */
export function createAdminBooking(input: AdminBookingInput): Promise<Booking> {
  return run("createAdminBooking", {}, (db, now) => {
    const { customer } = input;
    if (customer.name.trim().length < 2) throw new ApiError("INVALID_INPUT", "Enter the customer's name.");
    if (!/^[6-9]\d{9}$/.test(customer.phone)) throw new ApiError("INVALID_INPUT", "Enter a valid 10-digit mobile number.");
    const branch = db.branches.find((b) => b.id === input.branchId);
    if (!branch) throw new ApiError("NOT_FOUND", "Unknown branch.");
    if (branch.paused) throw new ApiError("BRANCH_PAUSED", `${branch.name} is paused.`);

    const start = new Date(input.startsAt);
    const slot = allSlots(
      getAvailableSlots(
        { branchId: input.branchId, serviceId: input.serviceId, date: localDate(start), barberId: input.barberId },
        toSlotData(db),
        now,
      ),
    ).find((s) => +new Date(s.startsAt) === +start);
    if (!slot || !slot.available || !slot.barberId) throw new ApiError("SLOT_UNAVAILABLE", "That slot is not available.");

    const fee = input.fee === "COLLECTED" ? db.settings.feeInr : 0;
    const booking: Booking = {
      ref: `BR-${db.counters.nextRef++}`,
      branchId: input.branchId,
      serviceId: input.serviceId,
      barberId: slot.barberId,
      customer: { name: customer.name.trim(), phone: customer.phone },
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "CONFIRMED",
      holdMethod: input.fee === "COLLECTED" ? "FEE" : "NONE",
      holdExpiresAt: null,
      priceInr: priceFor(input.branchId, input.serviceId, db)!,
      feeInr: fee,
      createdAt: iso(now),
      events: [ev(now, "CREATED", "Booking added by the salon")],
    };
    if (fee > 0) {
      cashPayment(db, booking, now);
      booking.events.push(ev(now, "FEE_RECEIVED", `₹${fee} fee collected in person`));
    } else {
      booking.events.push(ev(now, "CONFIRMED", "Walk-in, no fee"));
    }
    db.bookings.push(booking);
    return booking;
  });
}
