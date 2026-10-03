"use client";

import { useState } from "react";
import { Button, Input, Label, Modal } from "@/components/ui";
import { ApiError, getBranchDetail, listServices, saveBranchConfig, type BranchDetail } from "@/lib/api";
import { branchConfigSchema, issueMap, minToTime, timeToMin, type BranchConfigInput } from "@/lib/branch-schema";
import { cn } from "@/lib/cn";
import { inr } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import type { Branch, Service } from "@/lib/types";

const DAYS = [
  { index: 1, label: "Monday" }, { index: 2, label: "Tuesday" }, { index: 3, label: "Wednesday" }, { index: 4, label: "Thursday" },
  { index: 5, label: "Friday" }, { index: 6, label: "Saturday" }, { index: 0, label: "Sunday" },
];

interface DayDraft { open: boolean; from: string; to: string }
interface BreakDraft { key: number; from: string; to: string }
interface MemberDraft { key: number; id?: string; name: string; specialty: string; breaks: BreakDraft[] }
interface Draft {
  id?: string;
  name: string;
  address: string;
  phone: string;
  days: DayDraft[];
  services: Record<string, { on: boolean; price: string }>;
  team: MemberDraft[];
}

let keySeed = 1;
const nextKey = () => keySeed++;

function toDraft(allServices: Service[], detail: BranchDetail | null): Draft {
  if (!detail) {
    return {
      name: "", address: "", phone: "",
      days: Array.from({ length: 7 }, () => ({ open: true, from: "10:00", to: "21:00" })),
      services: Object.fromEntries(allServices.map((s) => [s.id, { on: true, price: "" }])),
      team: [],
    };
  }
  const { branch, offered, team } = detail;
  return {
    id: branch.id, name: branch.name, address: branch.address, phone: branch.phone,
    days: branch.weekHours.map((h) => ({ open: !!h, from: minToTime(h?.open ?? 600), to: minToTime(h?.close ?? 1260) })),
    services: Object.fromEntries(
      allServices.map((s) => {
        const o = offered.find((x) => x.serviceId === s.id);
        return [s.id, { on: !!o, price: o?.priceOverrideInr ? String(o.priceOverrideInr) : "" }];
      }),
    ),
    team: team.map((t) => ({
      key: nextKey(), id: t.barber.id, name: t.barber.name, specialty: t.barber.specialty,
      breaks: t.breaks.map((k) => ({ key: nextKey(), from: minToTime(k.startMin), to: minToTime(k.endMin) })),
    })),
  };
}

function toInput(d: Draft): BranchConfigInput {
  return {
    id: d.id,
    name: d.name,
    address: d.address,
    phone: d.phone,
    weekHours: d.days.map((x) => (x.open ? { open: timeToMin(x.from), close: timeToMin(x.to) } : null)),
    services: Object.entries(d.services)
      .filter(([, v]) => v.on)
      .map(([serviceId, v]) => ({ serviceId, priceOverrideInr: v.price.trim() === "" ? undefined : Number(v.price) })),
    team: d.team.map((m) => ({
      id: m.id,
      name: m.name,
      specialty: m.specialty,
      breaks: m.breaks.map((b) => ({ startMin: timeToMin(b.from), endMin: timeToMin(b.to) })),
    })),
  };
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-orange-ink">{error}</p>}
    </div>
  );
}

const timeBox = "min-h-12 rounded-input border-2 border-line bg-cream px-3 font-medium text-ink focus:border-green focus:bg-white disabled:opacity-40";

function DrawerForm({ services, initial, onClose, onSaved }: { services: Service[]; initial: Draft; onClose: () => void; onSaved: (b: Branch, created: boolean) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const setDay = (i: number, p: Partial<DayDraft>) => patch({ days: d.days.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const setMember = (key: number, p: Partial<MemberDraft>) => patch({ team: d.team.map((m) => (m.key === key ? { ...m, ...p } : m)) });

  const save = async () => {
    setApiError(null);
    const parsed = branchConfigSchema.safeParse(toInput(d));
    if (!parsed.success) {
      setErrors(issueMap(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const branch = await saveBranchConfig(parsed.data);
      onSaved(branch, !d.id);
    } catch (e) {
      setApiError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
      setBusy(false);
    }
  };

  const count = Object.keys(errors).length;

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={d.id ? "Manage branch" : "Add branch"} className="space-y-8">
      {count > 0 && (
        <p role="alert" className="rounded-2xl bg-status-cancelled p-3 text-sm font-bold text-status-cancelled-ink">
          Please fix {count} {count === 1 ? "thing" : "things"} below, then save again.
        </p>
      )}

      <section aria-labelledby="bd-details" className="space-y-4">
        <h3 id="bd-details" className="font-display text-xl text-green">Details</h3>
        <Field id="bd-name" label="Branch name" error={errors.name}>
          <Input id="bd-name" value={d.name} onChange={(e) => patch({ name: e.target.value })} invalid={!!errors.name} aria-describedby="bd-name-err" />
        </Field>
        <Field id="bd-address" label="Address" error={errors.address}>
          <Input id="bd-address" value={d.address} onChange={(e) => patch({ address: e.target.value })} invalid={!!errors.address} aria-describedby="bd-address-err" />
        </Field>
        <Field id="bd-phone" label="Phone" error={errors.phone}>
          <Input id="bd-phone" type="tel" value={d.phone} onChange={(e) => patch({ phone: e.target.value })} invalid={!!errors.phone} aria-describedby="bd-phone-err" />
        </Field>
      </section>

      <section aria-labelledby="bd-hours" className="space-y-3">
        <h3 id="bd-hours" className="font-display text-xl text-green">Opening hours</h3>
        {errors.weekHours && <p role="alert" className="text-sm font-medium text-orange-ink">{errors.weekHours}</p>}
        <ul className="space-y-2">
          {DAYS.map(({ index, label }) => {
            const day = d.days[index];
            const err = errors[`weekHours.${index}`];
            return (
              <li key={index}>
                <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[130px_auto_1fr]">
                  <label className="flex min-h-11 items-center gap-2 font-bold text-ink">
                    <input type="checkbox" checked={day.open} onChange={(e) => setDay(index, { open: e.target.checked })} className="h-5 w-5 accent-[#2A5C4A]" aria-label={`${label} open`} />
                    {label}
                  </label>
                  <span className="text-sm text-muted-strong sm:order-3">{day.open ? "" : "Closed"}</span>
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:order-2">
                    <input type="time" step={1800} value={day.from} disabled={!day.open} onChange={(e) => setDay(index, { from: e.target.value })} aria-label={`${label} opens at`} className={timeBox} />
                    <span aria-hidden="true">–</span>
                    <input type="time" step={1800} value={day.to} disabled={!day.open} onChange={(e) => setDay(index, { to: e.target.value })} aria-label={`${label} closes at`} className={timeBox} />
                  </div>
                </div>
                {err && <p role="alert" className="mt-1 text-sm font-medium text-orange-ink">{label}: {err}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="bd-services" className="space-y-3">
        <h3 id="bd-services" className="font-display text-xl text-green">Services and prices</h3>
        <p className="text-sm text-muted-strong">Leave the price empty to use the standard price.</p>
        {errors.services && <p role="alert" className="text-sm font-medium text-orange-ink">{errors.services}</p>}
        <ul className="space-y-2">
          {services.map((s) => {
            const v = d.services[s.id];
            const err = errors[`services.${Object.entries(d.services).filter(([, x]) => x.on).findIndex(([id]) => id === s.id)}.priceOverrideInr`];
            return (
              <li key={s.id} className="rounded-2xl bg-cream p-3">
                <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                  <label className="flex min-h-11 items-center gap-3 font-medium text-ink">
                    <input type="checkbox" checked={v.on} onChange={(e) => patch({ services: { ...d.services, [s.id]: { ...v, on: e.target.checked } } })} className="h-5 w-5 accent-[#2A5C4A]" aria-label={`Offer ${s.name}`} />
                    <span>{s.name}<span className="block text-sm text-muted-strong">Standard {inr(s.priceInr)}</span></span>
                  </label>
                  <Input
                    type="number" inputMode="numeric" step={1} prefix="₹" placeholder={String(s.priceInr)} value={v.price} disabled={!v.on}
                    onChange={(e) => patch({ services: { ...d.services, [s.id]: { ...v, price: e.target.value } } })}
                    aria-label={`${s.name} price at this branch`} invalid={!!err}
                  />
                </div>
                {err && <p role="alert" className="mt-1 text-sm font-medium text-orange-ink">{s.name}: {err}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="bd-team" className="space-y-4">
        <h3 id="bd-team" className="font-display text-xl text-green">Barbers and breaks</h3>
        {d.team.length === 0 && <p className="rounded-2xl bg-cream p-3 text-sm text-muted-strong">No barbers yet. Customers cannot book until you add one.</p>}
        <ul className="space-y-4">
          {d.team.map((m, mi) => (
            <li key={m.key} className="space-y-3 rounded-3xl bg-cream p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`bd-m${m.key}-name`} label="Name" error={errors[`team.${mi}.name`]}>
                  <Input id={`bd-m${m.key}-name`} value={m.name} onChange={(e) => setMember(m.key, { name: e.target.value })} invalid={!!errors[`team.${mi}.name`]} aria-describedby={`bd-m${m.key}-name-err`} />
                </Field>
                <Field id={`bd-m${m.key}-spec`} label="Specialty" error={errors[`team.${mi}.specialty`]}>
                  <Input id={`bd-m${m.key}-spec`} value={m.specialty} onChange={(e) => setMember(m.key, { specialty: e.target.value })} aria-describedby={`bd-m${m.key}-spec-err`} />
                </Field>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-strong">Breaks</p>
                <ul className="space-y-2">
                  {m.breaks.map((b, bi) => (
                    <li key={b.key}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="time" step={900} value={b.from} onChange={(e) => setMember(m.key, { breaks: m.breaks.map((x) => (x.key === b.key ? { ...x, from: e.target.value } : x)) })} aria-label={`${m.name || "Barber"} break ${bi + 1} starts`} className={timeBox} />
                        <span aria-hidden="true">–</span>
                        <input type="time" step={900} value={b.to} onChange={(e) => setMember(m.key, { breaks: m.breaks.map((x) => (x.key === b.key ? { ...x, to: e.target.value } : x)) })} aria-label={`${m.name || "Barber"} break ${bi + 1} ends`} className={timeBox} />
                        <button type="button" onClick={() => setMember(m.key, { breaks: m.breaks.filter((x) => x.key !== b.key) })} className="min-h-11 rounded-full px-3 text-sm font-bold text-orange-ink">Remove break</button>
                      </div>
                      {errors[`team.${mi}.breaks.${bi}`] && <p role="alert" className="mt-1 text-sm font-medium text-orange-ink">{errors[`team.${mi}.breaks.${bi}`]}</p>}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setMember(m.key, { breaks: [...m.breaks, { key: nextKey(), from: "13:00", to: "14:00" }] })} className="min-h-11 rounded-full bg-white px-4 text-sm font-bold text-green">+ Add break</button>
                  <button type="button" onClick={() => patch({ team: d.team.filter((x) => x.key !== m.key) })} className="min-h-11 rounded-full px-4 text-sm font-bold text-status-cancelled-ink">Remove {m.name ? m.name.split(" ")[0] : "barber"}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => patch({ team: [...d.team, { key: nextKey(), name: "", specialty: "", breaks: [{ key: nextKey(), from: "13:00", to: "14:00" }] }] })} className="min-h-11 rounded-full border-2 border-dashed border-green px-5 font-bold text-green">+ Add barber</button>
        <p className="text-sm text-muted-strong">Removed barbers leave the calendar and the booking flow. Their old bookings keep their name. A barber with upcoming bookings cannot be removed.</p>
      </section>

      <div className={cn("sticky -bottom-6 -mx-6 -mb-6 space-y-3 border-t border-line bg-cream px-6 pb-6 pt-4")}>
        {apiError && <p role="alert" className="rounded-2xl bg-status-cancelled p-3 text-sm font-bold text-status-cancelled-ink">{apiError}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : d.id ? "Save branch" : "Add branch"}</Button>
        </div>
      </div>
    </form>
  );
}

/** "Manage branch" (branchId set) and "Add branch" (branchId null). */
export function BranchDrawer({ branchId, onClose, onSaved }: { branchId: string | null; onClose: () => void; onSaved: (b: Branch, created: boolean) => void }) {
  const services = useApi("bd-services", () => listServices(), []);
  const detail = useApi(`bd-detail:${branchId}`, () => (branchId ? getBranchDetail(branchId) : Promise.resolve(null)));
  const ready = services.loaded && detail.loaded;
  return (
    <Modal open onClose={onClose} title={branchId ? "Manage branch" : "Add branch"} variant="sheet" wide>
      {ready ? (
        <DrawerForm services={services.data} initial={toDraft(services.data, detail.data)} onClose={onClose} onSaved={onSaved} />
      ) : (
        <div role="status" aria-label="Loading branch" className="space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-cream-2" />)}
        </div>
      )}
    </Modal>
  );
}
