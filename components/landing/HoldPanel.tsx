"use client";

import { Flower } from "@/components/ui";
import { getSettings } from "@/lib/api";
import { inr } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import type { Settings } from "@/lib/types";

/** Purely visual preview of the OTP step. Not interactive. */
function OtpPreview() {
  const digits = ["4", "8", "1", ""];
  return (
    <div aria-hidden="true" className="rounded-card bg-cream p-6 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.45)]">
      <p className="font-display text-2xl text-green">Verify your number</p>
      <p className="mt-1 text-sm text-muted">We sent a code to +91 98••• ••210</p>
      <div className="mt-5 flex gap-3">
        {digits.map((d, i) => (
          <span
            key={i}
            className={`grid h-14 w-14 place-items-center rounded-input border-2 bg-white font-display text-2xl text-green-dark ${i === 2 ? "border-orange" : d ? "border-green" : "border-line"}`}
          >
            {d}
          </span>
        ))}
      </div>
      <span className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-green text-sm font-bold text-white">Verify &amp; hold slot</span>
      <p className="mt-3 text-center text-xs text-muted">Resend code in 0:24</p>
    </div>
  );
}

function FeePreview({ s }: { s: Settings }) {
  return (
    <div aria-hidden="true" className="rounded-card bg-cream p-6 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.45)]">
      <p className="font-display text-2xl text-green">Your booking</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Service price</dt><dd className="font-bold">{inr(499)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Booking fee</dt><dd className="font-bold">{inr(s.feeInr)}{s.adjustFeeInBill ? " (adjusted in bill)" : ""}</dd></div>
      </dl>
      <span className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-green text-sm font-bold text-white">Confirm &amp; pay {inr(s.feeInr)}</span>
    </div>
  );
}

export function HoldPanel() {
  const { data: s } = useApi("landing-settings", () => getSettings(), DEFAULT_SETTINGS as Settings);
  const showFee = s.holdMode !== "OTP_ONLY";
  const showOtp = s.holdMode !== "FEE_ONLY";

  return (
    <section id="hold" aria-labelledby="hold-title" className="mx-auto max-w-[1180px] px-4 pb-20 lg:pb-24">
      <div className="on-dark relative overflow-hidden rounded-[40px] bg-green px-6 py-12 text-white lg:px-14 lg:py-16">
        <Flower size={280} tint="bg-green-soft" className="absolute -bottom-24 -left-20" aria-hidden="true" />
        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-yellow">Zero no-shows</p>
            <h2 id="hold-title" className="mt-3 font-display text-4xl leading-tight lg:text-5xl">Hold your slot your way</h2>
            <p className="mt-4 max-w-md text-lg text-white/85">
              Every slot is reserved for you. Confirm it with a small booking fee, or just verify your phone number.
            </p>
            <ul className="mt-8 space-y-4">
              {showFee && (
                <li className="flex items-center justify-between gap-4 rounded-[28px] bg-yellow px-6 py-4 text-green-dark">
                  <div>
                    <p className="font-display text-xl">Pay a booking fee</p>
                    <p className="text-sm">{inr(s.feeInr)}{s.adjustFeeInBill ? ", adjusted in your final bill" : " to hold your slot"}</p>
                  </div>
                  <span className="font-display text-3xl">{inr(s.feeInr)}</span>
                </li>
              )}
              {showOtp && (
                <li className="flex items-center justify-between gap-4 rounded-[28px] bg-cream px-6 py-4 text-green-dark">
                  <div>
                    <p className="font-display text-xl">Verify your number</p>
                    <p className="text-sm">Free, slot held for {s.unpaidHoldMinutes} minutes</p>
                  </div>
                  <span className="font-display text-3xl">OTP</span>
                </li>
              )}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-sm">{showOtp ? <OtpPreview /> : <FeePreview s={s} />}</div>
        </div>
      </div>
    </section>
  );
}
