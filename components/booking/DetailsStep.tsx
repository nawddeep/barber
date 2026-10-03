"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import {
  ArrowLeftIcon, Avatar, Button, CalendarIcon, Flower, Input, Label, OtpInput, PinIcon, ScissorsIcon, Select, useToast,
} from "@/components/ui";
import {
  ApiError, checkHoldPolicy, confirmBooking, createHold, getBooking, releaseHold, sendOtp, simulatePayment, verifyOtp,
} from "@/lib/api";
import { now } from "@/lib/clock";
import { BANKS, PAY_TABS, detailsSchema, phoneSchema, type DetailsInput, type PayTab } from "@/lib/booking-schema";
import { cn } from "@/lib/cn";
import { inr, time12 } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { useNow } from "@/lib/hooks/useNow";
import { allowedHoldMethods } from "@/lib/rules";
import type { Booking, HoldMethod, PaymentMethod } from "@/lib/types";
import { useCheckoutStore } from "@/lib/wizard/checkout";
import { useWizardStore } from "@/lib/wizard/store";
import { useLookups } from "@/lib/wizard/useLookups";
import { HoldTimer } from "./HoldTimer";
import { PaymentSheet, type PayPhase } from "./PaymentSheet";

const TAB_LABEL: Record<PayTab, string> = { UPI: "UPI", CARD: "Card", NETBANKING: "Netbanking" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

const feeBody = (adjust: boolean, refund: boolean) =>
  `Instant confirmation.${adjust ? " Adjusted in your final bill" : ""}${refund ? (adjust ? " and refundable on timely cancellation." : " Refundable on timely cancellation.") : adjust ? "." : ""}`;

const DEFAULTS: DetailsInput = {
  name: "", phone: "", terms: false, method: "FEE", payTab: "UPI", upiId: "", cardNumber: "", cardExpiry: "", cardCvv: "", bank: "",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-orange-ink">{message}</p>
  ) : null;
}

export function DetailsStep() {
  const router = useRouter();
  const toast = useToast();
  const nowMs = useNow(1000);
  const wiz = useWizardStore();
  const l = useLookups(wiz.branchId, wiz.serviceId);
  const setCheckout = useCheckoutStore((s) => s.set);

  // The unpaid hold we created (or restored after a refresh).
  const [hold, setHold] = useState<Booking | null>(null);
  const [restored, setRestored] = useState(() => !useWizardStore.getState().holdRef);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment sheet.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [phase, setPhase] = useState<PayPhase>("idle");
  const [payError, setPayError] = useState<string>();

  // OTP.
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);

  const methodRef = useRef<HoldMethod>("FEE");
  const resolver: Resolver<DetailsInput> = (values, ctx, opts) =>
    zodResolver(detailsSchema)({ ...values, method: methodRef.current }, ctx, opts);
  const form = useForm<DetailsInput>({ resolver, defaultValues: DEFAULTS, mode: "onTouched" });
  const { register, handleSubmit, control, setValue, trigger, getValues, formState: { errors } } = form;

  const phone = useWatch({ control, name: "phone" });
  const payTab = useWatch({ control, name: "payTab" });
  const chosen = useWatch({ control, name: "method" });
  const upiId = useWatch({ control, name: "upiId" });
  const phoneOk = phoneSchema.safeParse(phone).success;

  const policy = useApi(`hold-policy:${phoneOk ? phone : ""}`, () => (phoneOk ? checkHoldPolicy({ phone }) : Promise.resolve(null)));
  const policyNow = policy.loaded ? policy.data : null;
  const allowed: HoldMethod[] = hold ? [hold.holdMethod as HoldMethod] : policyNow?.allowedMethods ?? allowedHoldMethods(l.settings, 0);
  const method: HoldMethod = allowed.includes(chosen) ? chosen : allowed[0];
  useEffect(() => {
    methodRef.current = method;
  });
  const feeForced = !hold && !!policyNow?.feeForcedByNoShows;
  const locked = !!hold;
  const otpAllowed = allowedHoldMethods(l.settings, 0).includes("OTP");

  const service = l.service;
  const barber = l.barbers.find((b) => b.id === (hold?.barberId ?? wiz.assignedBarberId ?? wiz.barberId));
  const feeInr = method === "FEE" ? l.settings.feeInr : 0;
  const when = wiz.startsAt ? `${format(new Date(wiz.startsAt), "EEE, d MMM")} · ${time12(wiz.startsAt)}` : "";
  const otpVerified = verifiedPhone === phone && phoneOk;
  const lockSecs = Math.max(0, Math.ceil((lockedUntil - nowMs) / 1000));
  const resendSecs = Math.max(0, Math.ceil((resendAt - nowMs) / 1000));

  // ---- leaving or recovering ----
  const expired = () => {
    wiz.setHoldRef(null);
    wiz.setNotice("Your hold ran out and the slot was released. Pick a time again, your other choices are saved.");
    router.replace("/book/slot");
  };

  // Pick up a hold after a refresh, unless the choices changed since.
  useEffect(() => {
    const ref = useWizardStore.getState().holdRef;
    if (!ref) return;
    let alive = true;
    getBooking(ref).then(
      async (d) => {
        const s = useWizardStore.getState();
        if (d.booking.status === "CONFIRMED") {
          s.reset();
          router.replace(`/book/confirmed/${ref}`);
          return;
        }
        const same = d.booking.status === "PENDING_FEE" && d.booking.branchId === s.branchId && d.booking.serviceId === s.serviceId && d.booking.startsAt === s.startsAt;
        if (same) {
          if (!alive) return;
          setHold(d.booking);
          form.reset({ ...DEFAULTS, name: d.booking.customer.name, phone: d.booking.customer.phone, method: d.booking.holdMethod as HoldMethod, terms: false });
        } else {
          await releaseHold({ ref }).catch(() => {});
          s.setHoldRef(null);
        }
        if (alive) setRestored(true);
      },
      (e) => {
        useWizardStore.getState().setHoldRef(null);
        if (e instanceof ApiError && e.code === "HOLD_EXPIRED") {
          useWizardStore.getState().setNotice("Your hold ran out and the slot was released. Pick a time again, your other choices are saved.");
          router.replace("/book/slot");
        } else if (alive) setRestored(true);
      },
    );
    return () => {
      alive = false;
    };
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (ref: string) => {
    useWizardStore.getState().reset();
    router.push(`/book/confirmed/${ref}`);
  };

  const abandon = async () => {
    if (hold) await releaseHold({ ref: hold.ref }).catch(() => {});
    useWizardStore.getState().reset();
    router.push("/");
  };

  const releaseAndEdit = async () => {
    if (!hold) return;
    setBusy(true);
    await releaseHold({ ref: hold.ref }).catch(() => {});
    wiz.setHoldRef(null);
    setHold(null);
    setSheetOpen(false);
    setPhase("idle");
    setBusy(false);
  };

  // ---- OTP ----
  const onSendOtp = async () => {
    if (!(await trigger("phone"))) return;
    setOtpError(null);
    try {
      await sendOtp({ phone });
      setSentTo(phone);
      setResendAt(+now() + 30_000);
      setCode("");
      toast.show({ message: `Code sent to +91 ${phone}. Demo code: 4815` });
    } catch (e) {
      setOtpError(errMessage(e));
    }
  };

  const onCode = async (value: string) => {
    setCode(value);
    setOtpError(null);
    if (value.length < 4 || !phoneOk) return;
    try {
      await verifyOtp({ phone, code: value });
      setVerifiedPhone(phone);
    } catch (e) {
      setCode("");
      if (e instanceof ApiError && e.code === "OTP_LOCKED") {
        const secs = Number(e.details?.retryInSec ?? 30);
        setLockedUntil(+now() + secs * 1000);
        setOtpError(`Too many wrong codes. Try again in ${secs} seconds.`);
      } else if (e instanceof ApiError && e.code === "OTP_INVALID") {
        const left = Number(e.details?.attemptsLeft ?? 0);
        setOtpError(`That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`);
      } else setOtpError(errMessage(e));
    }
  };

  // ---- paying ----
  const payMethod: PaymentMethod = payTab;
  const payLine =
    payTab === "UPI" ? `UPI · ${upiId || "your UPI ID"}` : payTab === "CARD" ? "Card · •••• " + (getValues("cardNumber").replace(/\s/g, "").slice(-4) || "0000") : `Netbanking · ${getValues("bank") || "your bank"}`;

  const runPayment = async (target: Booking) => {
    setPhase("processing");
    setPayError(undefined);
    try {
      await simulatePayment({ ref: target.ref, method: payMethod });
      await confirmBooking({ ref: target.ref });
      setPhase("success");
      await sleep(900);
      finish(target.ref);
    } catch (e) {
      if (e instanceof ApiError && e.code === "HOLD_EXPIRED") return expired();
      setPayError(errMessage(e));
      setPhase("failed");
    }
  };

  // ---- submit ----
  const submit = async (values: DetailsInput) => {
    setFormError(null);
    if (hold) {
      setSheetOpen(true);
      return;
    }
    if (method === "OTP" && !otpVerified) {
      setOtpError("Verify your number with the code first.");
      return;
    }
    if (!wiz.branchId || !wiz.serviceId || !wiz.startsAt) return;
    setBusy(true);
    try {
      const base = { branchId: wiz.branchId, serviceId: wiz.serviceId, startsAt: wiz.startsAt, customer: { name: values.name, phone: values.phone }, method };
      let booking: Booking;
      try {
        booking = await createHold({ ...base, barberId: wiz.assignedBarberId ?? wiz.barberId });
      } catch (e) {
        // The assigned barber was just taken; "any barber" can still be someone else.
        if (e instanceof ApiError && e.code === "SLOT_UNAVAILABLE" && wiz.barberId === "any") booking = await createHold({ ...base, barberId: "any" });
        else throw e;
      }
      wiz.setHoldRef(booking.ref);
      setHold(booking);
      if (method === "FEE") {
        setPhase("idle");
        setSheetOpen(true);
      } else {
        await confirmBooking({ ref: booking.ref });
        finish(booking.ref);
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "SLOT_UNAVAILABLE") {
        wiz.setNotice("Someone just took that slot. Please pick another time.");
        router.replace("/book/slot");
      } else if (e instanceof ApiError && e.code === "BRANCH_PAUSED") {
        wiz.setNotice(e.message);
        router.replace("/book/branch");
      } else {
        if (e instanceof ApiError && (e.code === "FEE_REQUIRED" || e.code === "METHOD_NOT_ALLOWED")) policy.reload();
        setFormError(errMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  // Share the button and countdown with the summary card and the phone bottom bar.
  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = () => void handleSubmit(submit)();
  });
  const label = method === "FEE" ? `Confirm & pay ${inr(l.settings.feeInr)}` : "Verify & hold slot";
  const holdExpiresAt = method === "FEE" ? hold?.holdExpiresAt ?? null : null;
  useEffect(() => {
    setCheckout({ action: { label, onClick: () => submitRef.current(), busy }, method, holdExpiresAt, cancel: () => void abandon() });
    return () => setCheckout({ action: null, holdExpiresAt: null, cancel: null });
    // abandon is recreated every render but only reads current state when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, busy, method, holdExpiresAt, setCheckout]);

  if (!restored || !service || !l.settingsLoaded) {
    return <div className="h-96 animate-pulse rounded-card bg-cream-2" role="status" aria-label="Loading your booking" />;
  }

  const due = l.dueAtSalon;
  const holdCards: Array<{ id: HoldMethod; title: string; price: string; body: string }> = [
    {
      id: "FEE",
      title: "Pay booking fee",
      price: inr(l.settings.feeInr),
      body: feeBody(l.settings.adjustFeeInBill, l.settings.refundOnEarlyCancel),
    },
    {
      id: "OTP",
      title: "Verify my number",
      price: "Free",
      body: `We hold the slot for ${l.settings.unpaidHoldMinutes} minutes after OTP. Repeat no-shows may need the fee next time.`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Phone header (the wizard header is hidden on phones for this step) */}
      <div className="lg:hidden">
        <Link href="/book/slot" aria-label="Back to date and time" className="grid h-12 w-12 place-items-center rounded-full bg-white text-orange shadow-sm">
          <ArrowLeftIcon size={22} />
        </Link>
        <h1 className="mt-5 font-display text-4xl text-green">Order summary</h1>
        <ul className="mt-4 divide-y divide-cream-2 rounded-card bg-white px-5 py-2">
          {[
            { icon: <Flower size={44} tint="bg-periwinkle"><PinIcon size={18} className="text-green-dark" /></Flower>, k: "Branch", v: l.branch?.name ?? "" },
            { icon: barber ? <Avatar name={barber.name} size={44} decorative /> : null, k: "Barber", v: barber?.name ?? "Any barber" },
            { icon: <Flower size={44} tint="bg-yellow"><ScissorsIcon size={18} className="text-green-dark" /></Flower>, k: "Service type", v: `${service.name} · ${service.durationMin} min` },
            { icon: <Flower size={44} tint="bg-[#F5B58B]"><CalendarIcon size={18} className="text-green-dark" /></Flower>, k: "Date and time", v: when },
          ].map((r) => (
            <li key={r.k} className="flex items-center gap-4 py-3">
              {r.icon}
              <div>
                <p className="font-bold text-ink">{r.k}</p>
                <p className="text-muted-strong">{r.v}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden lg:block">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">Step 3 of 4</p>
        <h1 className="mt-2 font-display text-5xl text-green">Almost there</h1>
      </div>

      <form noValidate onSubmit={(e) => { e.preventDefault(); submitRef.current(); }} className="space-y-6" aria-label="Your details">
        <section aria-labelledby="details-title" className="rounded-card bg-white p-6">
          <h2 id="details-title" className="font-display text-2xl text-green">Your details</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" placeholder="Your name" disabled={locked} invalid={!!errors.name} aria-describedby="name-err" {...register("name")} />
              <FieldError id="name-err" message={errors.name?.message} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="phone">Mobile number</Label>
              <div className="flex gap-3">
                <Input
                  id="phone" prefix="+91" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210"
                  disabled={locked} invalid={!!errors.phone} aria-describedby="phone-err" wrapperClassName="min-w-0 flex-1"
                  {...register("phone", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, ""); } })}
                />
                {otpAllowed && (
                  <Button variant="secondary" className="min-h-12 shrink-0" onClick={onSendOtp} disabled={locked || lockSecs > 0}>
                    {sentTo === phone ? "Resend" : "Send OTP"}
                  </Button>
                )}
              </div>
              <FieldError id="phone-err" message={errors.phone?.message} />
            </div>
          </div>

          {otpAllowed && !locked && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Enter the 4-digit code</p>
              <div className="flex flex-wrap items-center gap-4">
                <OtpInput value={code} onChange={onCode} disabled={lockSecs > 0 || otpVerified} invalid={!!otpError} />
                <div aria-live="polite" className="text-sm">
                  {otpVerified ? (
                    <span className="font-bold text-status-confirmed-ink">✓ Number verified</span>
                  ) : lockSecs > 0 ? (
                    <span className="font-bold text-orange-ink">Locked for {lockSecs}s</span>
                  ) : sentTo === phone && resendSecs > 0 ? (
                    <span className="text-muted">Resend in 0:{String(resendSecs).padStart(2, "0")}</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">Demo code: 4815</p>
              {otpError && <p role="alert" className="mt-1 text-sm font-medium text-orange-ink">{otpError}</p>}
            </div>
          )}
        </section>

        <section aria-labelledby="hold-title" className="rounded-card bg-white p-6">
          <h2 id="hold-title" className="font-display text-2xl text-green">How would you like to hold your slot?</h2>
          {feeForced && (
            <p role="status" className="mt-3 rounded-2xl bg-butter p-3 text-sm font-medium text-ink">
              Because of earlier missed bookings, we need the booking fee to hold this slot. It&apos;s adjusted in your final bill.
            </p>
          )}
          {hold && method === "FEE" && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-butter p-3">
              <HoldTimer expiresAt={hold.holdExpiresAt!} onExpire={expired} />
              <Button variant="outline" className="min-h-11" onClick={releaseAndEdit} disabled={busy}>Release hold and edit</Button>
            </div>
          )}
          <div role="radiogroup" aria-label="Hold your slot with" className={cn("mt-4 grid gap-4", allowed.length > 1 && "md:grid-cols-2")}>
            {holdCards.filter((c) => allowed.includes(c.id) || (hold && c.id === (hold.holdMethod as HoldMethod))).map((c) => {
              const on = method === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={locked || allowed.length === 1}
                  onClick={() => setValue("method", c.id)}
                  className={cn(
                    "rounded-3xl border-[3px] p-5 text-left transition disabled:cursor-default",
                    on ? "border-green bg-butter" : "border-line bg-cream hover:border-green/50",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-xl text-green">{c.title}</span>
                    <span className="font-display text-xl text-green-dark">{c.price}</span>
                  </span>
                  <span className="mt-2 block text-sm text-ink">{c.body}</span>
                </button>
              );
            })}
          </div>

          {method === "FEE" && (
            <div className="mt-5 border-t-2 border-dashed border-line pt-5">
              <div role="tablist" aria-label="Payment method" className="flex flex-wrap gap-2">
                {PAY_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={payTab === t}
                    disabled={locked}
                    onClick={() => setValue("payTab", t)}
                    className={cn("min-h-11 rounded-full px-5 text-sm font-bold", payTab === t ? "bg-green text-white" : "bg-cream-2 text-green-dark")}
                  >
                    {TAB_LABEL[t]}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="mt-4 grid gap-4 sm:grid-cols-2">
                {payTab === "UPI" && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="upi">UPI ID</Label>
                    <Input id="upi" placeholder="name@bank" autoComplete="off" disabled={locked} invalid={!!errors.upiId} aria-describedby="upi-err" {...register("upiId")} />
                    <FieldError id="upi-err" message={errors.upiId?.message} />
                  </div>
                )}
                {payTab === "CARD" && (
                  <>
                    <div className="sm:col-span-2">
                      <Label htmlFor="card">Card number</Label>
                      <Input id="card" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" maxLength={19} disabled={locked} invalid={!!errors.cardNumber} aria-describedby="card-err" {...register("cardNumber")} />
                      <FieldError id="card-err" message={errors.cardNumber?.message} />
                    </div>
                    <div>
                      <Label htmlFor="exp">Expiry</Label>
                      <Input id="exp" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} disabled={locked} invalid={!!errors.cardExpiry} aria-describedby="exp-err" {...register("cardExpiry")} />
                      <FieldError id="exp-err" message={errors.cardExpiry?.message} />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} type="password" disabled={locked} invalid={!!errors.cardCvv} aria-describedby="cvv-err" {...register("cardCvv")} />
                      <FieldError id="cvv-err" message={errors.cardCvv?.message} />
                    </div>
                  </>
                )}
                {payTab === "NETBANKING" && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="bank">Bank</Label>
                    <Select id="bank" disabled={locked} invalid={!!errors.bank} aria-describedby="bank-err" {...register("bank")}>
                      <option value="">Choose your bank</option>
                      {BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </Select>
                    <FieldError id="bank-err" message={errors.bank?.message} />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#2A5C4A]" aria-describedby="terms-err" {...register("terms")} />
            <span>I agree to the cancellation policy: free cancellation up to {l.settings.refundWindowHours} hours before the slot.</span>
          </label>
          <FieldError id="terms-err" message={errors.terms?.message} />
        </div>

        {formError && <p role="alert" className="rounded-2xl bg-status-cancelled p-4 text-sm font-bold text-status-cancelled-ink">{formError}</p>}

        {/* Phone: payment breakdown (desktop has it in the summary card) */}
        <section aria-label="Payment details" className="lg:hidden">
          <h2 className="mb-3 font-display text-2xl text-green">Payment details</h2>
          <div className="rounded-card bg-white p-5">
            <p className="flex justify-between"><span>{service.name}</span><b>{inr(service.priceInr)}</b></p>
            {method === "FEE" && <p className="mt-1 flex justify-between"><span>Booking fee{l.settings.adjustFeeInBill ? " (adjusted in bill)" : ""}</span><b>{inr(l.settings.feeInr)}</b></p>}
            <div className="my-3 border-t-2 border-dashed border-butter" />
            <p className="flex items-baseline justify-between"><span className="font-display text-2xl text-green">Pay now</span><span className="font-display text-4xl text-orange-ink">{inr(feeInr)}</span></p>
            <p className="mt-2 text-sm text-muted-strong">{inr(due)} due at the salon · free cancellation up to {l.settings.refundWindowHours} hours before</p>
            {holdExpiresAt && <p className="mt-3"><HoldTimer expiresAt={holdExpiresAt} onExpire={expired} /></p>}
          </div>
        </section>
      </form>

      {sheetOpen && hold && (
        <PaymentSheet
          phase={phase}
          error={payError}
          amountInr={hold.feeInr}
          payLine={payLine}
          description={`${service.name} · ${when}`}
          onPay={() => void runPayment(hold)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
