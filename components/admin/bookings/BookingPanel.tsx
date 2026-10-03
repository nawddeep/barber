"use client";

import { format, isToday } from "date-fns";
import { useState } from "react";
import { Button, Flower, Modal, StatusChip, useToast } from "@/components/ui";
import {
  ApiError, getBooking, refundBooking, rescheduleBooking, undoStatusChange, updateBookingStatus, type BookingDetail,
} from "@/lib/api";
import { formatPhone, initials, inr, time12 } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { UNDOABLE } from "@/lib/transitions";
import type { Booking, BookingEvent, BookingStatus } from "@/lib/types";
import { RescheduleDialog } from "./RescheduleDialog";


const METHOD = { UPI: "UPI", CARD: "Card", NETBANKING: "Netbanking", CASH: "Cash" } as const;

const EVENT_TEXT: Record<BookingEvent["type"], string> = {
  CREATED: "Booking created",
  OTP_VERIFIED: "Phone verified by OTP",
  FEE_RECEIVED: "Fee received",
  CONFIRMED: "Booking confirmed",
  RESCHEDULED: "Booking rescheduled",
  CANCELLED: "Booking cancelled",
  REFUNDED: "Fee refunded",
  NO_SHOW: "Marked as no-show",
  IN_SERVICE: "Service started",
  COMPLETED: "Service completed",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted-strong">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

function FeeRow({ d }: { d: BookingDetail }) {
  const { booking, payment } = d;
  let text: string;
  let tone = "bg-butter text-ink";
  if (payment?.status === "PAID") text = `Booking fee · ${METHOD[payment.method]}|${inr(payment.amountInr)} paid`;
  else if (payment?.status === "REFUNDED") text = `Booking fee · ${METHOD[payment.method]}|${inr(payment.amountInr)} refunded`;
  else if (payment?.status === "REFUND_DUE") {
    text = `Booking fee|${inr(payment.amountInr)} refund due`;
    tone = "bg-status-cancelled text-status-cancelled-ink";
  } else if (booking.holdMethod === "FEE") text = `Booking fee|${inr(booking.feeInr)} pending`;
  else if (booking.holdMethod === "OTP") text = "Verified by OTP|No fee";
  else text = "Walk-in|No fee";
  const [left, right] = text.split("|");
  return (
    <p className={`mt-4 flex items-center justify-between gap-3 rounded-3xl px-5 py-4 font-bold ${tone}`}>
      <span>{left}</span>
      <span>{right}</span>
    </p>
  );
}

type Props = {
  bookingRef: string;
  /** Bump to reload after the list changed. */
  version: number;
  onChanged: () => void;
};

/** The booking detail panel. Reused by the Bookings page and the Calendar. */
export function BookingPanel({ bookingRef, version, onChanged }: Props) {
  const toast = useToast();
  const [local, setLocal] = useState(0);
  const q = useApi(`bp:${bookingRef}:${version}:${local}`, () => getBooking(bookingRef));
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [moving, setMoving] = useState(false);

  if (q.error) {
    return <p role="alert" className="rounded-card bg-white p-6 text-ink">{q.error instanceof ApiError ? q.error.message : "Could not load this booking."}</p>;
  }
  if (!q.loaded || q.data.booking.ref !== bookingRef) {
    return <div role="status" aria-label="Loading booking" className="h-96 animate-pulse rounded-card bg-cream-2" />;
  }

  const d = q.data;
  const { booking, payment, service, barber, branch } = d;
  const phone = booking.customer.phone;
  const refresh = () => {
    setLocal((n) => n + 1);
    onChanged();
  };
  const fail = (e: unknown) => toast.show({ message: e instanceof ApiError ? e.message : "Something went wrong. Please try again." });

  const undo = (label: string) =>
    toast.show({
      message: label,
      actionLabel: "Undo",
      duration: 5000,
      onAction: async () => {
        try {
          await undoStatusChange({ ref: booking.ref });
          toast.show({ message: "Change undone" });
          refresh();
        } catch (e) {
          fail(e);
        }
      },
    });

  const setStatus = async (status: BookingStatus, message: string) => {
    setBusy(true);
    try {
      const from = booking.status;
      await updateBookingStatus({ ref: booking.ref, status });
      refresh();
      const undoable = UNDOABLE.includes(status) && (status !== "CANCELLED" || from === "CONFIRMED");
      if (undoable) undo(message);
      else toast.show({ message });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const refund = async () => {
    setBusy(true);
    try {
      const p = await refundBooking({ ref: booking.ref });
      toast.show({ message: `${inr(p.amountInr)} refunded (simulated)` });
      refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const onMoved = (moved: Booking, was: { startsAt: string; barberId: string }) => {
    setMoving(false);
    refresh();
    toast.show({
      message: `Moved to ${format(new Date(moved.startsAt), "EEE d MMM")}, ${time12(moved.startsAt)}`,
      actionLabel: "Undo",
      duration: 5000,
      onAction: async () => {
        try {
          await rescheduleBooking({ ref: booking.ref, startsAt: was.startsAt, barberId: was.barberId });
          toast.show({ message: "Move undone" });
          refresh();
        } catch (e) {
          fail(e);
        }
      },
    });
  };

  const s = booking.status;
  const canRefund = s === "CANCELLED" && (payment?.status === "REFUND_DUE" || payment?.status === "PAID");
  const final = s === "COMPLETED" || s === "NO_SHOW" || (s === "CANCELLED" && !canRefund);

  return (
    <article aria-label={`Booking ${booking.ref}`} className="rounded-card bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-strong" data-testid="panel-ref">{booking.ref}</p>
        <StatusChip status={s} className="min-h-8 px-4 text-sm" />
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Flower size={64} tint="bg-yellow"><span className="font-display text-xl text-green-dark">{initials(booking.customer.name)}</span></Flower>
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-tight text-green">{booking.customer.name}</h2>
          <p className="text-sm text-muted-strong">{formatPhone(phone)} · {d.visitCount} past {d.visitCount === 1 ? "visit" : "visits"}</p>
        </div>
      </div>

      <dl className="mt-5 rounded-3xl bg-cream-2 px-5 py-3">
        <Row label="Service" value={service.name} />
        <Row label="Barber" value={barber.name} />
        <Row label="Branch" value={branch.name} />
        <Row label="When" value={`${format(new Date(booking.startsAt), "EEE, d MMM")} · ${time12(booking.startsAt)}`} />
      </dl>

      <FeeRow d={d} />

      <h3 className="mt-6 text-xs font-bold uppercase tracking-widest text-muted-strong">Activity</h3>
      <ol className="mt-2 space-y-1.5 text-[15px] text-ink">
        {booking.events.map((e, i) => (
          <li key={`${e.at}-${i}`}>
            <span className="text-muted-strong">{isToday(new Date(e.at)) ? time12(e.at) : `${format(new Date(e.at), "d MMM")}, ${time12(e.at)}`}</span> · {e.note ?? EVENT_TEXT[e.type]}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button href={`tel:+91${phone}`} aria-label={`Call ${booking.customer.name}`}>Call</Button>
        <Button href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" variant="secondary" aria-label={`WhatsApp ${booking.customer.name}`}>WhatsApp</Button>

        {s === "CONFIRMED" && (
          <>
            <Button variant="outline" onClick={() => setMoving(true)} disabled={busy}>Reschedule</Button>
            <Button variant="outline" className="text-status-cancelled-ink" onClick={() => setStatus("NO_SHOW", "Marked as no-show")} disabled={busy}>Mark no-show</Button>
            <Button variant="outline" onClick={() => setStatus("IN_SERVICE", "Service started")} disabled={busy}>Start service</Button>
            <Button variant="outline" onClick={() => setStatus("COMPLETED", "Marked as completed")} disabled={busy}>Mark completed</Button>
          </>
        )}
        {s === "IN_SERVICE" && (
          <Button variant="outline" className="col-span-2" onClick={() => setStatus("COMPLETED", "Marked as completed")} disabled={busy}>Mark completed</Button>
        )}
        {s === "PENDING_FEE" && (
          <>
            <Button variant="outline" onClick={() => setMoving(true)} disabled={busy}>Reschedule</Button>
            <Button variant="outline" onClick={() => setStatus("CONFIRMED", "Fee marked as received")} disabled={busy}>Fee received</Button>
          </>
        )}
        {(s === "CONFIRMED" || s === "PENDING_FEE") && (
          <Button variant="outline" className="col-span-2 text-status-cancelled-ink" onClick={() => setConfirmCancel(true)} disabled={busy}>Cancel booking</Button>
        )}
        {canRefund && (
          <Button className="col-span-2" onClick={refund} disabled={busy}>Refund {inr(payment!.amountInr)}</Button>
        )}
      </div>
      {final && <p className="mt-4 text-center text-sm text-muted-strong">This booking is {s === "COMPLETED" ? "completed" : s === "NO_SHOW" ? "a no-show" : "cancelled"}, so it can&apos;t be changed.</p>}

      {confirmCancel && (
        <Modal open onClose={() => setConfirmCancel(false)} title="Cancel this booking?">
          <p className="text-ink">{booking.customer.name}, {service.name}, {format(new Date(booking.startsAt), "EEE d MMM")} at {time12(booking.startsAt)}.</p>
          <p className="mt-3 rounded-2xl bg-butter p-3 text-sm font-medium text-ink">
            {payment?.status === "PAID" ? `The ${inr(payment.amountInr)} fee becomes a refund you can send from here.` : "No fee was paid, so there is nothing to refund."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep booking</Button>
            <Button onClick={() => { setConfirmCancel(false); void setStatus("CANCELLED", "Booking cancelled"); }}>Yes, cancel booking</Button>
          </div>
        </Modal>
      )}
      {moving && <RescheduleDialog booking={booking} onClose={() => setMoving(false)} onMoved={onMoved} />}
    </article>
  );
}
