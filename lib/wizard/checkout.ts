"use client";

import { create } from "zustand";
import type { HoldMethod } from "@/lib/types";

export interface StepAction {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}

interface CheckoutState {
  /** Set by a step that needs its own button instead of a plain "Continue" link (step 3, rescheduling). */
  action: StepAction | null;
  method: HoldMethod;
  /** ISO time the current fee hold runs out, if any. */
  holdExpiresAt: string | null;
  /** "Cancel" on phones: drop the hold and leave the flow. */
  cancel: (() => void) | null;
  set: (patch: Partial<Omit<CheckoutState, "set">>) => void;
}

/** Not persisted. Lets the page and the summary card share the live checkout state. */
export const useCheckoutStore = create<CheckoutState>((set) => ({
  action: null,
  method: "FEE",
  holdExpiresAt: null,
  cancel: null,
  set: (patch) => set(patch),
}));
