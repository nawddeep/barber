"use client";

import { Button, CheckIcon, Modal } from "@/components/ui";
import { inr } from "@/lib/format";

export type PayPhase = "idle" | "processing" | "success" | "failed";

type Props = {
  phase: PayPhase;
  error?: string;
  amountInr: number;
  /** e.g. "UPI · asha@okbank" */
  payLine: string;
  /** "Hot Towel Shave · Sat, 3 Oct · 2:30 PM" */
  description: string;
  onPay: () => void;
  onClose: () => void;
};

/** MOCK: looks like a payment gateway checkout, but nothing is charged. */
export function PaymentSheet({ phase, error, amountInr, payLine, description, onPay, onClose }: Props) {
  return (
    <Modal open onClose={onClose} title="Secure checkout">
      <div aria-live="polite">
        <p className="mb-4 inline-block rounded-full bg-butter px-3 py-1 text-xs font-bold text-status-pending-ink">Demo payment · no money moves</p>
        <div className="rounded-3xl bg-white p-5">
          <p className="text-sm text-muted">Barbr booking fee</p>
          <p className="font-display text-5xl text-green">{inr(amountInr)}</p>
          <p className="mt-2 text-sm text-muted-strong">{description}</p>
          <p className="mt-3 border-t border-line pt-3 text-sm font-bold text-ink">{payLine}</p>
        </div>

        {phase === "failed" && (
          <p role="alert" className="mt-4 rounded-2xl bg-status-cancelled p-4 text-sm font-bold text-status-cancelled-ink">
            {error ?? "Payment failed."} Your slot is still held, so you can try again.
          </p>
        )}

        <div className="mt-5">
          {phase === "processing" && (
            <div role="status" className="flex min-h-14 items-center justify-center gap-3 rounded-full bg-cream-2 font-bold text-green-dark">
              <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-green border-t-transparent" aria-hidden="true" />
              Processing payment…
            </div>
          )}
          {phase === "success" && (
            <div role="status" className="flex min-h-14 items-center justify-center gap-3 rounded-full bg-status-confirmed font-bold text-status-confirmed-ink">
              <CheckIcon size={20} /> Payment received. Confirming your booking…
            </div>
          )}
          {(phase === "idle" || phase === "failed") && (
            <Button size="lg" className="w-full" onClick={onPay}>
              {phase === "failed" ? `Try again · Pay ${inr(amountInr)}` : `Pay ${inr(amountInr)}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
