"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface WizardState {
  branchId: string | null;
  serviceId: string | null;
  /** yyyy-MM-dd of the day being browsed on step 2. */
  date: string | null;
  /** ISO start time of the chosen slot. */
  startsAt: string | null;
  /** A barber id, or "any". */
  barberId: string;
  /** Barber who would be assigned for the chosen slot (matters for "any"). */
  assignedBarberId: string | null;
  /** Ref of the unpaid hold created on step 3, so a refresh can pick it up again. */
  holdRef: string | null;
  /** Set when rescheduling an existing booking from the confirmation page. */
  rescheduleRef: string | null;
  /** One-off message for the next step ("Your hold expired ..."). Not persisted. */
  notice: string | null;

  setBranch: (id: string) => void;
  setService: (id: string) => void;
  setDate: (date: string) => void;
  setBarber: (id: string) => void;
  setSlot: (startsAt: string, assignedBarberId: string | null) => void;
  clearSlot: () => void;
  setHoldRef: (ref: string | null) => void;
  startReschedule: (input: { ref: string; branchId: string; serviceId: string; barberId: string }) => void;
  setNotice: (notice: string | null) => void;
  reset: () => void;
}

const empty = {
  branchId: null,
  serviceId: null,
  date: null,
  startsAt: null,
  barberId: "any",
  assignedBarberId: null,
  holdRef: null,
  rescheduleRef: null,
  notice: null,
} satisfies Partial<WizardState>;

/** Booking progress. Survives a refresh (sessionStorage) but not a new tab. */
export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...empty,
      // Changing the branch clears the barber and time, since both belong to the branch.
      setBranch: (id) => {
        if (get().branchId === id) return;
        set({ branchId: id, barberId: "any", startsAt: null, assignedBarberId: null });
      },
      // A different service has a different length, so the chosen time may no longer fit.
      setService: (id) => {
        if (get().serviceId === id) return;
        set({ serviceId: id, startsAt: null, assignedBarberId: null });
      },
      setDate: (date) => {
        if (get().date === date) return;
        set({ date, startsAt: null, assignedBarberId: null });
      },
      setBarber: (id) => set({ barberId: id }),
      setSlot: (startsAt, assignedBarberId) => set({ startsAt, assignedBarberId }),
      clearSlot: () => set({ startsAt: null, assignedBarberId: null }),
      setHoldRef: (holdRef) => set({ holdRef }),
      startReschedule: ({ ref, branchId, serviceId, barberId }) =>
        set({ ...empty, branchId, serviceId, barberId, rescheduleRef: ref }),
      setNotice: (notice) => set({ notice }),
      reset: () => set({ ...empty }),
    }),
    {
      name: "barbr-wizard-v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        branchId: s.branchId,
        serviceId: s.serviceId,
        date: s.date,
        startsAt: s.startsAt,
        barberId: s.barberId,
        assignedBarberId: s.assignedBarberId,
        holdRef: s.holdRef,
        rescheduleRef: s.rescheduleRef,
      }),
    },
  ),
);
