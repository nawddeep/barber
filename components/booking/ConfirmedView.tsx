"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, CalendarIcon, CheckIcon, Flower, Logo, Modal, PinIcon, ScissorsIcon, useToast } from "@/components/ui";
import { ApiError, cancelBooking, getBooking, getSettings } from "@/lib/api";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { inr, maskPhone, time12 } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { buildIcs, directionsUrl, downloadFile } from "@/lib/ics";
import { refundDecision } from "@/lib/rules";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import type { Settings } from "@/lib/types";
import { useWizardStore } from "@/lib/wizard/store";
import { StatusChip } from "@/components/ui";

const LINE: Record<string, string> = { "hot-towel-shave": "will have the towels steaming" };

function Notch({ side }: { side: "left" | "right" }) {
  return <span aria-hidden="true" className={cn("absolute top-0 h-8 w-8 -translate-y-1/2 rounded-full bg-cream", side === "left" ? "-left-4" : "-right-4")} />;
}

function Tile({ tint, icon, label, children }: { tint: string; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      {icon ?? <Flower size={48} tint={tint} />}
      <div>
        <p className="text-sm text-muted-strong">{label}</p>
        <p className="font-bold text-ink">{children}</p>
      </div>
    </div>
  );
}

export function ConfirmedView({ bookingRef }: { bookingRef: string }) {
  const router = useRouter();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useApi(`booking:${bookingRef}:${tick}`, () => getBooking(bookingRef));
  const settings = useApi("confirmed-settings", () => getSettings(), DEFAULT_SETTINGS as Settings).data;

  if (q.error) {
    const missing = q.error instanceof ApiError && (q.error.code === "NOT_FOUND" || q.error.code === "HOLD_EXPIRED");
    return (
      <main className="grid min-h-screen place-items-center bg-green p-6 text-center text-white">
        <div className="max-w-md space-y-5">
          <Logo tone="light" className="text-4xl" />
          <h1 className="font-display text-4xl">{missing ? "We could not find that booking" : "Something went wrong"}</h1>
          <p className="text-white/85">{missing ? `Booking ${bookingRef} does not exist, or its hold ran out.` : "Please try again."}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {!missing && <Button variant="secondary" size="lg" onClick={q.reload}>Try again</Button>}
            <Button href="/book/branch" variant={missing ? "secondary" : "outline"} size="lg" className={missing ? "" : "border-white/40 text-white hover:bg-white/10"}>Book a slot</Button>
          </div>
        </div>
      </main>
    );
  }
  if (!q.loaded) {
    return <main className="min-h-screen bg-green" role="status" aria-label="Loading your booking" />;
  }

  const { booking, payment, branch, service, barber } = q.data;
  const start = new Date(booking.startsAt);
  const confirmed = booking.status === "CONFIRMED";
  const cancelled = booking.status === "CANCELLED";
  const pending = booking.status === "PENDING_FEE";
  const editable = confirmed || pending;
  const first = barber.name.split(" ")[0];
  const feePaid = payment?.status === "PAID" ? payment.amountInr : 0;

  const refund = refundDecision(booking, payment ?? undefined, settings, now());
  const chip =
    cancelled ? { status: booking.status, label: payment?.status === "REFUNDED" ? `Cancelled · ${inr(payment.amountInr)} refunded` : "Cancelled" }
    : confirmed ? { status: booking.status, label: feePaid ? `Confirmed · ${inr(feePaid)} paid` : "Confirmed · OTP verified" }
    : { status: booking.status, label: undefined };

  const title =
    confirmed ? "You're booked!"
    : cancelled ? "Booking cancelled"
    : pending ? "Almost booked"
    : booking.status === "IN_SERVICE" ? "Your visit is under way"
    : booking.status === "COMPLETED" ? "Thanks for visiting!"
    : "We missed you";
  const sub = confirmed
    ? `See you on ${format(start, "EEEE")}, ${first} ${LINE[service.id] ?? `will be ready for your ${service.name.toLowerCase()}`}. We've sent the details to ${maskPhone(booking.customer.phone)}.`
    : cancelled
      ? payment?.status === "REFUNDED"
        ? `Your ${inr(payment.amountInr)} fee is being refunded (simulated). Welcome back any time.`
        : "This booking was cancelled. Welcome back any time."
      : pending
        ? "This booking is not confirmed yet. Finish paying or verifying your number to keep the slot."
        : booking.status === "IN_SERVICE"
          ? `${first} is looking after you right now.`
          : booking.status === "COMPLETED"
            ? `We hope you loved your ${service.name.toLowerCase()}. Book your next one any time.`
            : "You did not make it to this booking. Book again whenever suits you.";

  const addToCalendar = () =>
    downloadFile(`barbr-${booking.ref}.ics`, buildIcs({ booking, branch, service, barber }), "text/calendar;charset=utf-8");

  const reschedule = () => {
    useWizardStore.getState().startReschedule({ ref: booking.ref, branchId: booking.branchId, serviceId: booking.serviceId, barberId: booking.barberId });
    router.push("/book/slot");
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      const r = await cancelBooking({ ref: booking.ref });
      toast.show({ message: r.refundedInr ? `Booking cancelled · ${inr(r.refundedInr)} refunded` : "Booking cancelled" });
      setCancelOpen(false);
      setTick((n) => n + 1);
    } catch (e) {
      toast.show({ message: e instanceof ApiError ? e.message : "Could not cancel. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const refundLine =
    feePaid === 0
      ? "You did not pay a fee, so there is nothing to refund."
      : refund.refund
        ? `Your ${inr(refund.amountInr)} fee will be refunded (simulated).`
        : `This is within ${settings.refundWindowHours} hours of your slot, so the ${inr(feePaid)} fee is not refunded.`;

  return (
    <div className="min-h-screen bg-cream">
      <header className="on-dark relative overflow-hidden rounded-b-[64px] bg-green pb-36 text-center text-white">
        <Flower size={300} tint="bg-green-soft" className="absolute -left-24 -top-24" aria-hidden="true" />
        <Flower size={360} tint="bg-green-soft" className="absolute -right-28 top-10" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1100px] px-6">
          <div className="flex items-center justify-between py-6">
            <Logo tone="light" href="/" className="text-3xl" />
            <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-white">Back to home</Link>
          </div>
          <div className="mt-2 flex justify-center">
            <Flower size={104} tint={cancelled ? "bg-status-cancelled" : "bg-yellow"}>
              {cancelled ? <span className="font-display text-4xl text-status-cancelled-ink">×</span> : <CheckIcon size={44} className="text-green-dark" strokeWidth={3} />}
            </Flower>
          </div>
          <h1 className="mt-6 font-display text-5xl text-white sm:text-6xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-lg text-white/85">{sub}</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-24 grid max-w-[1100px] gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[1.7fr_1fr]">
        <section aria-label="Booking details" className="rounded-[40px] bg-white p-6 shadow-[0_18px_40px_-24px_rgba(30,69,54,0.3)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-strong">Booking ref</p>
              <p className="font-display text-4xl text-green" data-testid="booking-ref">{booking.ref}</p>
            </div>
            <StatusChip status={chip.status} label={chip.label} className="min-h-9 px-4 text-sm" />
          </div>

          <div className="relative my-6 border-t-2 border-dashed border-line" aria-hidden="true">
            <Notch side="left" />
            <Notch side="right" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Tile tint="bg-yellow" label="Date & time" icon={<Flower size={48} tint="bg-yellow"><CalendarIcon size={20} className="text-green-dark" /></Flower>}>
              {format(start, "EEE, d MMM")} · {time12(booking.startsAt)}
            </Tile>
            <Tile tint="bg-[#F5B58B]" label="Service" icon={<Flower size={48} tint="bg-[#F5B58B]"><ScissorsIcon size={20} className="text-green-dark" /></Flower>}>
              {service.name} · {service.durationMin} min
            </Tile>
            <Tile tint="" label="Your barber" icon={<Avatar name={barber.name} size={48} decorative />}>{barber.name}</Tile>
            <Tile tint="bg-periwinkle" label="Branch" icon={<Flower size={48} tint="bg-periwinkle"><PinIcon size={20} className="text-green-dark" /></Flower>}>
              {branch.name}
            </Tile>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {confirmed && <Button onClick={addToCalendar}>Add to calendar</Button>}
            <Button href={directionsUrl(branch)} target="_blank" rel="noreferrer" variant="secondary">Get directions</Button>
            {editable && <Button variant="outline" onClick={reschedule}>Reschedule</Button>}
            {editable && <Button variant="outline" className="text-status-cancelled-ink" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}
            {(cancelled || !editable) && <Button href="/book/branch" variant="primary">Book again</Button>}
            {pending && <Button href="/book/details">Finish booking</Button>}
          </div>
        </section>

        <div className="space-y-6">
          {confirmed && (
            <section aria-labelledby="know-title" className="rounded-card bg-yellow p-6 text-green-dark">
              <h2 id="know-title" className="font-display text-2xl">Good to know</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>Arrive 5 minutes early.</li>
                {feePaid > 0 && settings.adjustFeeInBill && <li>Your {inr(feePaid)} fee is adjusted in the final bill.</li>}
                <li>Free cancellation up to {settings.refundWindowHours} hours before.</li>
              </ul>
            </section>
          )}
          {confirmed && (
            <section aria-label="SMS preview" className="rounded-card bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-strong">SMS sent just now</p>
              <p className="mt-3 rounded-2xl bg-status-confirmed/60 p-4 text-sm text-ink">
                Booking {booking.ref} confirmed. {service.name} with {first}, {format(start, "EEE d MMM, h:mm a")} at Barbr {branch.name}. See you there!
              </p>
            </section>
          )}
        </div>
      </main>

      {cancelOpen && (
        <Modal open onClose={() => setCancelOpen(false)} title="Cancel this booking?">
          <p className="text-ink">{service.name} on {format(start, "EEE, d MMM")} at {time12(booking.startsAt)}.</p>
          <p className="mt-3 rounded-2xl bg-butter p-3 font-medium text-ink" data-testid="refund-line">{refundLine}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep booking</Button>
            <Button onClick={doCancel} disabled={busy}>{busy ? "Cancelling…" : "Yes, cancel booking"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
