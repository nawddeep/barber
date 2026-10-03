"use client";

import { addDays, startOfDay } from "date-fns";
import { Label, Select } from "@/components/ui";
import { SlotGrid } from "@/components/booking/SlotGrid";
import { getSlots } from "@/lib/api";
import { now } from "@/lib/clock";
import { localDate } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import type { SlotGroups } from "@/lib/slots";
import type { Barber } from "@/lib/types";

type Props = {
  branchId: string;
  serviceId: string;
  barberId: string;
  date: string;
  barbers: Barber[];
  startsAt: string | null;
  onDate: (d: string) => void;
  onBarber: (id: string) => void;
  onPick: (startsAt: string, barberId: string | null) => void;
  /** Treat this booking as not on the calendar (when rescheduling it). */
  ignoreRef?: string;
  advanceDays: number;
  idPrefix: string;
};

/** Date, barber and slot grid, shared by "New booking" and "Reschedule". Uses the same slot logic as the public flow. */
export function SlotPicker({ branchId, serviceId, barberId, date, barbers, startsAt, onDate, onBarber, onPick, ignoreRef, advanceDays, idPrefix }: Props) {
  const slots = useApi<SlotGroups>(`sp:${branchId}:${serviceId}:${barberId}:${date}:${ignoreRef ?? ""}`, () =>
    getSlots({ branchId, serviceId, barberId, date, ignoreRef }),
  );
  const today = startOfDay(now());
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            min={localDate(today)}
            max={localDate(addDays(today, advanceDays))}
            onChange={(e) => e.target.value && onDate(e.target.value)}
            className="min-h-[52px] w-full rounded-input border-2 border-line bg-cream px-4 font-medium text-ink focus:border-green focus:bg-white"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-barber`}>Barber</Label>
          <Select id={`${idPrefix}-barber`} value={barberId} onChange={(e) => onBarber(e.target.value)}>
            <option value="any">Any barber</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Time</p>
        <SlotGrid
          groups={slots.loading ? null : (slots.data ?? null)}
          selected={startsAt}
          onSelect={(s) => onPick(s.startsAt, s.barberId)}
          emptyMessage="No slots on this day. Try another date or barber."
        />
      </div>
    </div>
  );
}
