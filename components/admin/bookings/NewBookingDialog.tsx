"use client";

import { useState } from "react";
import { Button, Input, Label, Modal, Select } from "@/components/ui";
import { ApiError, createAdminBooking, getNextFreeSlot, getSettings, listBarbers, listBranches, listServices } from "@/lib/api";
import { isIndianMobile } from "@/lib/phone";
import { now } from "@/lib/clock";
import { inr, localDate } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BRANCHES, SEED_SERVICES } from "@/lib/mock/seed";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import type { Booking, Settings } from "@/lib/types";
import { SlotPicker } from "./SlotPicker";

type Props = {
  onClose: () => void;
  onCreated: (booking: Booking) => void;
  /** The calendar opens this with the clicked barber and time already chosen. */
  initial?: { branchId?: string; barberId?: string; startsAt?: string };
};

/** Walk-in or phone booking. Confirmed straight away. */
export function NewBookingDialog({ onClose, onCreated, initial }: Props) {
  const branches = useApi("nb-branches", () => listBranches(), SEED_BRANCHES.filter((b) => !b.paused)).data;
  const settings = useApi("nb-settings", () => getSettings(), DEFAULT_SETTINGS as Settings).data;

  const [branchPick, setBranchPick] = useState(initial?.branchId ?? "");
  const branchId = branches.some((b) => b.id === branchPick) ? branchPick : branches[0]?.id ?? "";
  const services = useApi(`nb-services:${branchId}`, () => listServices(branchId), SEED_SERVICES).data;
  const barbers = useApi(`nb-barbers:${branchId}`, () => listBarbers(branchId), []).data;

  const [servicePick, setServicePick] = useState("");
  const serviceId = services.some((s) => s.id === servicePick) ? servicePick : services[0]?.id ?? "";
  const [barberId, setBarberId] = useState(initial?.barberId ?? "any");
  // Open on the earliest day with a free slot, unless the calendar already chose one.
  const [datePick, setDatePick] = useState(initial?.startsAt ? localDate(new Date(initial.startsAt)) : "");
  const next = useApi(`nb-next:${branchId}:${serviceId}`, () => getNextFreeSlot({ branchId, serviceId }));
  const date = datePick || (next.data ? localDate(new Date(next.data.startsAt)) : localDate(now()));
  const setDate = setDatePick;
  const [startsAt, setStartsAt] = useState<string | null>(initial?.startsAt ?? null);
  const [assigned, setAssigned] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fee, setFee] = useState<"COLLECTED" | "NONE">("COLLECTED");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = name.trim().length < 2 ? "Enter the customer's name" : null;
  const phoneError = isIndianMobile(phone) ? null : "Enter a valid 10-digit mobile number";
  const slotError = startsAt ? null : "Pick a time";
  const service = services.find((s) => s.id === serviceId);

  const submit = async () => {
    setTried(true);
    setError(null);
    if (nameError || phoneError || slotError) return;
    setBusy(true);
    try {
      onCreated(await createAdminBooking({ branchId, serviceId, barberId: assigned ?? barberId, startsAt: startsAt!, customer: { name, phone }, fee }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the booking.");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New booking" className="max-w-2xl">
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-5" aria-label="New booking">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-branch">Branch</Label>
            <Select id="nb-branch" value={branchId} onChange={(e) => { setBranchPick(e.target.value); setBarberId("any"); setStartsAt(null); }}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="nb-service">Service</Label>
            <Select id="nb-service" value={serviceId} onChange={(e) => { setServicePick(e.target.value); setStartsAt(null); }}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {inr(s.priceInr)}</option>)}
            </Select>
          </div>
        </div>

        <SlotPicker
          idPrefix="nb"
          branchId={branchId}
          serviceId={serviceId}
          barberId={barberId}
          date={date}
          barbers={barbers}
          startsAt={startsAt}
          advanceDays={settings.advanceBookingDays}
          onDate={(d) => { setDate(d); setStartsAt(null); }}
          onBarber={(id) => { setBarberId(id); setStartsAt(null); }}
          onPick={(s, b) => { setStartsAt(s); setAssigned(b); }}
        />
        {tried && slotError && <p role="alert" className="text-sm font-medium text-orange-ink">{slotError}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-name">Customer name</Label>
            <Input id="nb-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" invalid={tried && !!nameError} aria-describedby="nb-name-err" />
            {tried && nameError && <p id="nb-name-err" role="alert" className="mt-1 text-sm font-medium text-orange-ink">{nameError}</p>}
          </div>
          <div>
            <Label htmlFor="nb-phone">Mobile number</Label>
            <Input id="nb-phone" prefix="+91" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} invalid={tried && !!phoneError} aria-describedby="nb-phone-err" />
            {tried && phoneError && <p id="nb-phone-err" role="alert" className="mt-1 text-sm font-medium text-orange-ink">{phoneError}</p>}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Booking fee</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["COLLECTED", `Fee collected in person (${inr(settings.feeInr)})`],
              ["NONE", "No fee"],
            ] as const).map(([v, label]) => (
              <label key={v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 font-medium ${fee === v ? "border-green bg-butter" : "border-line bg-white"}`}>
                <input type="radio" name="nb-fee" value={v} checked={fee === v} onChange={() => setFee(v)} className="h-5 w-5 accent-[#2A5C4A]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {service && startsAt && (
          <p className="rounded-2xl bg-cream-2 p-3 text-sm text-ink">
            {service.name}, {inr(service.priceInr)}. {fee === "COLLECTED" ? `${inr(Math.max(service.priceInr - settings.feeInr, 0))} due at the salon.` : `${inr(service.priceInr)} due at the salon.`}
          </p>
        )}
        {error && <p role="alert" className="rounded-2xl bg-status-cancelled p-3 text-sm font-bold text-status-cancelled-ink">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create booking"}</Button>
        </div>
      </form>
    </Modal>
  );
}
