"use client";

import { addDays, format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Label, Select } from "@/components/ui";
import * as api from "@/lib/api";
import type { SlotGroups } from "@/lib/slots";
import type { Barber, Booking, Branch } from "@/lib/types";
import type { Stats } from "@/lib/stats";

// Developer-only page for poking the mock API. Not part of the customer or admin flow.
const today = () => format(new Date(), "yyyy-MM-dd");
const time = (iso: string) => format(new Date(iso), "h:mm a");

export default function ApiPlayground() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<api.ServiceWithPrice[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [branchId, setBranchId] = useState("main-street");
  const [serviceId, setServiceId] = useState("hot-towel-shave");
  const [barberId, setBarberId] = useState("any");
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<SlotGroups | null>(null);
  const [counts, setCounts] = useState<Array<{ date: string; count: number }>>([]);
  const [next, setNext] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [last, setLast] = useState<Booking | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [dev, setDev] = useState(api.getDevConfig());
  const [tick, setTick] = useState(0);

  const say = (m: string) => setLog((l) => [`${format(new Date(), "HH:mm:ss")}  ${m}`, ...l].slice(0, 30));
  const guard = async <T,>(label: string, fn: () => Promise<T>) => {
    try {
      const r = await fn();
      say(`OK    ${label}`);
      return r;
    } catch (e) {
      say(`ERROR ${label}: ${e instanceof api.ApiError ? `${e.code} (${e.message})` : String(e)}`);
      return undefined;
    }
  };

  useEffect(() => {
    api.listBranches({ includePaused: true }).then(setBranches);
  }, [tick]);
  useEffect(() => {
    api.listServices(branchId).then(setServices);
    api.listBarbers(branchId).then(setBarbers);
  }, [branchId, tick]);
  useEffect(() => {
    const q = { branchId, serviceId, barberId, date };
    api.getSlots(q).then(setSlots);
    api.getSlotCounts({ branchId, serviceId, barberId, from: today(), days: 8 }).then(setCounts);
    api.getNextFreeSlot({ branchId, serviceId, barberId }).then((s) => setNext(s ? `${format(new Date(s.startsAt), "EEE d MMM")}, ${time(s.startsAt)}` : "none"));
    api.getStats({ date: today() }, branchId).then(setStats);
  }, [branchId, serviceId, barberId, date, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const all = slots ? [...slots.morning, ...slots.afternoon, ...slots.evening] : [];

  async function runFlow(method: "FEE" | "OTP") {
    const startsAt = selected || all.find((s) => s.available)?.startsAt;
    if (!startsAt) return say("No free slot to book");
    const phone = method === "FEE" ? "9811122233" : "9811122244";
    const hold = await guard(`createHold (${method})`, () =>
      api.createHold({ branchId, serviceId, barberId, startsAt, customer: { name: "Demo Customer", phone }, method }),
    );
    if (!hold) return refresh();
    if (method === "FEE") await guard("simulatePayment", () => api.simulatePayment({ ref: hold.ref, method: "UPI" }));
    else await guard("verifyOtp 4815", () => api.verifyOtp({ phone, code: "4815" }));
    const done = await guard("confirmBooking", () => api.confirmBooking({ ref: hold.ref }));
    setLast(done ?? hold);
    setSelected("");
    refresh();
  }

  return (
    <main id="main" className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-green">Mock API playground</h1>
          <p className="text-sm text-muted">Dev only. Everything here talks to /lib/api, never to a server.</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await guard("resetDemo", () => api.resetDemo());
            setLast(null);
            refresh();
          }}
        >
          Reset demo data
        </Button>
      </header>

      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="d-branch">Branch</Label>
          <Select id="d-branch" value={branchId} onChange={(e) => { setBranchId(e.target.value); setBarberId("any"); }}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.paused ? " (paused)" : ""}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="d-service">Service</Label>
          <Select id="d-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} · ₹{s.priceInr} · {s.durationMin} min</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="d-barber">Barber</Label>
          <Select id="d-barber" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="any">Any barber</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="d-date">Date</Label>
          <input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-12 w-full rounded-input border-2 border-line bg-cream px-4" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          <h2 className="font-display text-2xl text-green">Slots on {date}</h2>
          <p className="text-sm text-muted">Next free slot: <b>{next || "…"}</b> · tap a slot to choose it (taken slots are struck through)</p>
          {slots && (["morning", "afternoon", "evening"] as const).map((g) => (
            <div key={g}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{g}</p>
              <div className="flex flex-wrap gap-2">
                {slots[g].length === 0 && <span className="text-sm text-muted">none</span>}
                {slots[g].map((s) => (
                  <button
                    key={s.startsAt}
                    type="button"
                    disabled={!s.available}
                    aria-pressed={selected === s.startsAt}
                    onClick={() => setSelected(s.startsAt)}
                    title={s.barberId ? `Assigned: ${barbers.find((b) => b.id === s.barberId)?.name}` : "Taken"}
                    className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold ${
                      selected === s.startsAt ? "border-orange bg-orange text-ink" : s.available ? "border-line bg-white" : "border-transparent bg-cream-2 text-muted line-through"
                    }`}
                  >
                    {time(s.startsAt)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => runFlow("FEE")}>Book with fee</Button>
            <Button variant="secondary" onClick={() => runFlow("OTP")}>Book with OTP</Button>
            {last && (
              <Button
                variant="outline"
                onClick={async () => {
                  const r = await guard(`cancelBooking ${last.ref}`, () => api.cancelBooking({ ref: last.ref }));
                  if (r) say(`refunded ₹${r.refundedInr}`);
                  setLast(null);
                  refresh();
                }}
              >
                Cancel {last.ref}
              </Button>
            )}
          </div>
          {last && <p className="text-sm">Last booking: <b>{last.ref}</b> · {last.status} · {time(last.startsAt)} · barber {last.barberId}</p>}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-2">
            <h2 className="font-display text-2xl text-green">Dev switches</h2>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={dev.delay} onChange={(e) => { api.setDevConfig({ delay: e.target.checked }); setDev(api.getDevConfig()); }} />
              Fake network delay (300 to 600 ms)
            </label>
            <Label htmlFor="d-err">Simulate errors</Label>
            <Select id="d-err" value={dev.errorMode} onChange={(e) => { api.setDevConfig({ errorMode: e.target.value as api.DevConfig["errorMode"] }); setDev(api.getDevConfig()); }}>
              <option value="off">Off</option>
              <option value="payment">Payment fails</option>
              <option value="all">Every call fails</option>
            </Select>
          </Card>
          <Card className="space-y-1 text-sm">
            <h2 className="font-display text-2xl text-green">Slots per day</h2>
            {counts.map((c) => <div key={c.date} className="flex justify-between"><span>{format(new Date(`${c.date}T00:00`), "EEE d MMM")}</span><b>{c.count}</b></div>)}
          </Card>
        </div>
      </div>

      {stats && (
        <Card className="space-y-2 text-sm">
          <h2 className="font-display text-2xl text-green">Today at {branches.find((b) => b.id === branchId)?.name}</h2>
          <p>
            <b>{stats.todayBookings}</b> bookings (last week: {stats.sameWeekdayLastWeek}) · fees <b>₹{stats.feesCollectedInr}</b> ({stats.feePaidCount} paid, {stats.otpCount} OTP) · slots filled <b>{stats.slotsFilledPct}%</b> · no-shows <b>{stats.noShows}</b>
          </p>
          <p>Week: {stats.week.map((d) => `${d.label} ${d.count}`).join(" · ")}</p>
          <p>Attention: {stats.attention.awaitingFee} awaiting fee · {stats.attention.refundRequests} refund requests · {stats.attention.gaps.length} barber gaps</p>
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="font-display text-2xl text-green">Log</h2>
        <pre className="max-h-64 overflow-auto text-xs leading-relaxed" aria-live="polite">{log.join("\n") || "Run a flow to see results."}</pre>
        <p className="text-xs text-muted">Demo values: OTP 4815. Phone 9000000001 has 2 no-shows, so OTP is refused for it.</p>
      </Card>
    </main>
  );
}
