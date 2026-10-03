"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { ApiError, getSettings, listBarbers, rescheduleBooking } from "@/lib/api";
import { localDate } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import type { Booking, Settings } from "@/lib/types";
import { SlotPicker } from "./SlotPicker";

type Props = {
  booking: Pick<Booking, "ref" | "branchId" | "serviceId" | "barberId" | "startsAt">;
  onClose: () => void;
  /** Called with the moved booking and where it used to be (for Undo). */
  onMoved: (moved: Booking, was: { startsAt: string; barberId: string }) => void;
  /** Start on this slot (the calendar's Move button and drag use it). */
  initialStartsAt?: string;
};

export function RescheduleDialog({ booking, onClose, onMoved, initialStartsAt }: Props) {
  const barbers = useApi(`rs-barbers:${booking.branchId}`, () => listBarbers(booking.branchId), []).data;
  const settings = useApi("rs-settings", () => getSettings(), DEFAULT_SETTINGS as Settings).data;
  const [date, setDate] = useState(localDate(new Date(initialStartsAt ?? booking.startsAt)));
  const [barberId, setBarberId] = useState(booking.barberId);
  const [startsAt, setStartsAt] = useState<string | null>(initialStartsAt ?? null);
  const [assigned, setAssigned] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!startsAt) return;
    setBusy(true);
    setError(null);
    try {
      const moved = await rescheduleBooking({ ref: booking.ref, startsAt, barberId: assigned ?? barberId });
      onMoved(moved, { startsAt: booking.startsAt, barberId: booking.barberId });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not move the booking.");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Reschedule ${booking.ref}`} className="max-w-2xl">
      <SlotPicker
        idPrefix="rs"
        branchId={booking.branchId}
        serviceId={booking.serviceId}
        barberId={barberId}
        date={date}
        barbers={barbers}
        startsAt={startsAt}
        ignoreRef={booking.ref}
        advanceDays={settings.advanceBookingDays}
        onDate={(d) => { setDate(d); setStartsAt(null); }}
        onBarber={(id) => { setBarberId(id); setStartsAt(null); }}
        onPick={(s, b) => { setStartsAt(s); setAssigned(b); }}
      />
      {error && <p role="alert" className="mt-4 rounded-2xl bg-status-cancelled p-3 text-sm font-bold text-status-cancelled-ink">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Keep current time</Button>
        <Button onClick={submit} disabled={!startsAt || busy}>{busy ? "Moving…" : "Move booking"}</Button>
      </div>
    </Modal>
  );
}
