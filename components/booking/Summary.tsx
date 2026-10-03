"use client";

import { format, parseISO } from "date-fns";
import Image from "next/image";
import { ArrowRightIcon, Button, Flower, ScissorsIcon } from "@/components/ui";
import { inr, time12 } from "@/lib/format";
import { SHAVE_PHOTO } from "@/lib/images";
import { useCheckoutStore, type StepAction } from "@/lib/wizard/checkout";
import { useWizardStore } from "@/lib/wizard/store";
import { HoldTimer } from "./HoldTimer";
import { useLookups } from "@/lib/wizard/useLookups";
import type { Settings } from "@/lib/types";

export const NEXT_HREF: Record<number, string> = { 1: "/book/slot", 2: "/book/details" };

/** The yellow "Booking fee" box. Wording follows the owner's hold mode. */
export function FeeBox({ settings, dueAtSalon, compact }: { settings: Settings; dueAtSalon: number; compact?: boolean }) {
  if (settings.holdMode === "OTP_ONLY") {
    return (
      <div className="rounded-3xl bg-butter p-4">
        <p className="font-bold text-ink">{compact ? "Hold your slot free" : "Free to hold"}</p>
        {!compact && <p className="mt-1 text-sm text-ink">Verify your phone number with an OTP. No booking fee.</p>}
      </div>
    );
  }
  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-full bg-butter px-5 py-3 font-bold text-ink">
        <span>Booking fee to hold slot</span>
        <span>{inr(settings.feeInr)}</span>
      </div>
    );
  }
  return (
    <div className="rounded-3xl bg-butter p-4">
      <p className="flex items-center justify-between font-bold text-ink">
        <span>Booking fee</span>
        <span>{inr(settings.feeInr)}</span>
      </p>
      <p className="mt-1 text-sm text-ink">
        {settings.adjustFeeInBill
          ? `Holds your slot. Adjusted in your final bill, so you pay ${inr(dueAtSalon)} at the salon.`
          : "Holds your slot. Charged on top of the service price."}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

function useSummary() {
  const s = useWizardStore();
  const l = useLookups(s.branchId, s.serviceId);
  const barber = l.barbers.find((b) => b.id === (s.assignedBarberId ?? s.barberId));
  const barberLabel = barber ? barber.name : s.barberId === "any" ? "Any barber" : "";
  return { s, l, barberLabel };
}

function ActionButton({ action, fallbackLabel, href, enabled }: { action: StepAction | null; fallbackLabel: string; href: string; enabled: boolean }) {
  if (action) {
    return (
      <Button size="lg" className="w-full" onClick={action.onClick} disabled={action.disabled || action.busy}>
        {action.busy ? "Working…" : action.label}
      </Button>
    );
  }
  return enabled ? (
    <Button href={href} size="lg" className="w-full">
      {fallbackLabel} <ArrowRightIcon size={20} />
    </Button>
  ) : (
    <Button size="lg" className="w-full" disabled>
      {fallbackLabel} <ArrowRightIcon size={20} />
    </Button>
  );
}

export function SummaryCard({ step }: { step: number }) {
  const { s, l, barberLabel } = useSummary();
  const { action, method, holdExpiresAt } = useCheckoutStore();
  const canContinue = step === 1 ? !!(s.branchId && s.serviceId) : !!s.startsAt;
  const price = l.service?.priceInr ?? 0;
  const when = s.startsAt ? `${format(new Date(s.startsAt), "EEE, d MMM")} · ${time12(s.startsAt)}` : "–";

  if (step === 3) {
    const fee = method === "FEE" ? l.settings.feeInr : 0;
    return (
      <section aria-label="Your booking" className="rounded-card-lg bg-white p-6 shadow-[0_18px_40px_-24px_rgba(30,69,54,0.3)] lg:sticky lg:top-6">
        <h2 className="font-display text-2xl text-green">Your booking</h2>
        <div className="mt-4 flex items-center gap-3 rounded-3xl bg-cream-2 p-3">
          {s.serviceId === "hot-towel-shave" ? (
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
              <Image src={SHAVE_PHOTO} alt="" fill sizes="56px" className="object-cover object-[35%_50%]" />
            </span>
          ) : (
            <Flower size={56} tint="bg-yellow"><ScissorsIcon size={22} className="text-green-dark" /></Flower>
          )}
          <div>
            <p className="font-display text-xl leading-tight text-green">{l.service?.name ?? "–"}</p>
            <p className="text-sm text-muted-strong">{l.branch?.name} · {l.service?.durationMin} min</p>
          </div>
        </div>
        <dl className="mt-3 text-[15px]">
          <Row label="When" value={when} />
          <Row label="Barber" value={barberLabel || "–"} />
          <Row label="Service price" value={inr(price)} />
          <Row label="Booking fee" value={method === "FEE" ? `${inr(fee)}${l.settings.adjustFeeInBill ? " (adjusted in bill)" : ""}` : "Free (OTP)"} />
        </dl>
        <div className="my-4 border-t-2 border-dashed border-line" />
        <p className="flex items-baseline justify-between">
          <span className="font-bold text-ink">Pay now</span>
          <span className="font-display text-4xl text-orange-ink">{inr(fee)}</span>
        </p>
        {holdExpiresAt && (
          <p className="mt-3 rounded-2xl bg-butter p-3 text-sm"><HoldTimer expiresAt={holdExpiresAt} onExpire={() => {}} /></p>
        )}
        <div className="mt-5">
          <ActionButton action={action} fallbackLabel="Confirm" href="/book/details" enabled={false} />
          <p className="mt-3 text-center text-xs text-muted-strong">Secure checkout · SMS confirmation to your number</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Your booking" className="rounded-card-lg bg-white p-6 shadow-[0_18px_40px_-24px_rgba(30,69,54,0.3)] lg:sticky lg:top-6">
      <h2 className="font-display text-2xl text-green">{s.rescheduleRef ? `Rescheduling ${s.rescheduleRef}` : "Your booking"}</h2>
      <dl className="mt-3 text-[15px]">
        <Row label="Branch" value={l.branch?.name ?? "–"} />
        <Row label="Service" value={l.service?.name ?? "–"} />
        {step === 1 && <Row label="Duration" value={l.service ? `${l.service.durationMin} min` : "–"} />}
        {step === 2 && (
          <>
            <Row label="Date" value={s.startsAt ? format(new Date(s.startsAt), "EEE, d MMM") : s.date ? format(parseISO(s.date), "EEE, d MMM") : "–"} />
            <Row label="Time" value={s.startsAt ? time12(s.startsAt) : "–"} />
            <Row label="Barber" value={barberLabel || "–"} />
          </>
        )}
        {step === 1 && <Row label="Service price" value={l.service ? inr(price) : "–"} />}
      </dl>
      <div className="my-4 border-t-2 border-dashed border-butter" />
      {step === 2 && (
        <p className="mb-3 flex items-baseline justify-between text-[15px]">
          <span className="text-muted">Service price</span>
          <span className="font-bold text-ink">{l.service ? inr(price) : "–"}</span>
        </p>
      )}
      {s.rescheduleRef ? (
        <p className="rounded-3xl bg-butter p-4 text-sm text-ink">Your booking fee stays with this booking. Nothing more to pay.</p>
      ) : (
        <FeeBox settings={l.settings} dueAtSalon={l.dueAtSalon} compact={step === 2} />
      )}
      <div className="mt-5">
        <ActionButton action={action} fallbackLabel="Continue" href={NEXT_HREF[step]} enabled={canContinue} />
        {!canContinue && step === 2 && <p className="mt-2 text-center text-sm text-muted">Pick a time to continue.</p>}
      </div>
    </section>
  );
}

/** Phones: the summary collapses into a sticky bar with the Continue button. */
export function MobileBar({ step }: { step: number }) {
  const { s, l, barberLabel } = useSummary();
  const { action, holdExpiresAt, cancel } = useCheckoutStore();
  const canContinue = step === 1 ? !!(s.branchId && s.serviceId) : !!s.startsAt;
  const line =
    step === 1
      ? l.service ? `${l.service.name} · ${inr(l.service.priceInr)}` : "Choose a service"
      : step === 2
        ? s.startsAt ? `${format(new Date(s.startsAt), "EEE, d MMM")} · ${time12(s.startsAt)} · ${barberLabel}` : "Pick a time"
        : "";
  const label = step === 2 ? (s.rescheduleRef ? "Confirm new time" : "Book a barber") : "Continue";

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
      {step === 3 ? (
        <>
          {holdExpiresAt && <p className="mb-2 text-center text-sm"><HoldTimer expiresAt={holdExpiresAt} onExpire={() => {}} /></p>}
          <div className="grid grid-cols-[1fr_1.6fr] gap-3">
            <Button variant="outline" size="lg" onClick={() => cancel?.()}>Cancel</Button>
            <ActionButton action={action} fallbackLabel="Confirm" href="/book/details" enabled={false} />
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 truncate text-center text-sm font-bold text-green-dark" aria-live="polite">{line}</p>
          {action ? (
            <ActionButton action={action} fallbackLabel={label} href="" enabled={false} />
          ) : canContinue ? (
            <Button href={NEXT_HREF[step]} size="lg" className="w-full">{label}</Button>
          ) : (
            <Button size="lg" className="w-full" disabled>{label}</Button>
          )}
        </>
      )}
    </div>
  );
}
