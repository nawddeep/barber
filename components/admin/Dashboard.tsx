"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { Button, Chip, ErrorRetry, Select } from "@/components/ui";
import { getSettings, getStats, listBranches } from "@/lib/api";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { inr, time12 } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BRANCHES } from "@/lib/mock/seed";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import type { Stats, UpNextRow } from "@/lib/stats";
import type { Settings } from "@/lib/types";

const greeting = (h: number) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

function compare(today: number, lastWeek: number, weekday: string) {
  const d = today - lastWeek;
  if (d === 0) return `Same as last ${weekday}`;
  return `${Math.abs(d)} ${d > 0 ? "more" : "fewer"} than last ${weekday}`;
}

function Kpis({ s }: { s: Stats }) {
  const weekday = format(parseISO(s.date), "EEEE");
  return (
    <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-card bg-yellow p-6 text-green-dark">
        <h2 className="font-bold">Today&apos;s bookings</h2>
        <p className="mt-2 font-display text-6xl leading-none" data-testid="kpi-bookings">{s.todayBookings}</p>
        <p className="mt-2 text-sm">{compare(s.todayBookings, s.sameWeekdayLastWeek, weekday)}</p>
      </div>
      <div className="on-dark rounded-card bg-green p-6 text-white">
        <h2 className="font-bold">Booking fees collected</h2>
        <p className="mt-2 font-display text-6xl leading-none" data-testid="kpi-fees">{inr(s.feesCollectedInr)}</p>
        <p className="mt-2 text-sm text-white/90">
          {s.feePaidCount} of {s.todayBookings} paid · {s.otpCount} verified by OTP
        </p>
      </div>
      <div className="rounded-card bg-white p-6">
        <h2 className="font-bold text-ink">Slots filled</h2>
        <p className="mt-2 font-display text-6xl leading-none text-green" data-testid="kpi-filled">{s.slotsFilledPct}%</p>
        <div
          role="progressbar"
          aria-label="Slots filled today"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={s.slotsFilledPct}
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-cream-2"
        >
          <div className="h-full rounded-full bg-orange" style={{ width: `${s.slotsFilledPct}%` }} />
        </div>
      </div>
      <div className="rounded-card bg-status-cancelled p-6 text-status-cancelled-ink">
        <h2 className="font-bold">No-shows today</h2>
        <p className="mt-2 font-display text-6xl leading-none" data-testid="kpi-noshows">{s.noShows}</p>
        <p className="mt-2 text-sm">{s.noShowsPaidFee} had paid the fee</p>
      </div>
    </section>
  );
}

function WeekChart({ s, scope }: { s: Stats; scope: string }) {
  const max = Math.max(1, ...s.week.map((d) => d.count));
  return (
    <section aria-labelledby="week-title" className="rounded-card bg-white p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-title" className="font-display text-2xl text-green">Bookings this week</h2>
        <span className="text-sm text-muted-strong">{scope}</span>
      </div>
      <div className="mt-6 flex h-[220px] items-end gap-3 sm:gap-4" aria-hidden="true">
        {s.week.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end text-center">
            <span className="mb-1 text-sm font-bold text-ink">{d.count}</span>
            <div
              className={cn("w-full rounded-t-2xl rounded-b-md", d.kind === "today" ? "bg-green" : d.kind === "future" ? "bg-yellow" : "bg-status-confirmed")}
              style={{ height: `${Math.max(6, (d.count / max) * 82)}%` }}
            />
            <span className="mt-2 text-sm text-muted-strong">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-strong">Dark bar is today, yellow bars are forecast from slots already booked.</p>
      <table className="sr-only">
        <caption>Bookings this week, {scope}</caption>
        <thead><tr><th>Day</th><th>Bookings</th><th>When</th></tr></thead>
        <tbody>
          {s.week.map((d) => (
            <tr key={d.date}><td>{d.label}</td><td>{d.count}</td><td>{d.kind === "today" ? "today" : d.kind === "future" ? "forecast" : "past"}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ByBranch({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.byBranch.map((b) => b.count));
  return (
    <section aria-labelledby="branch-title" className="rounded-card bg-white p-6">
      <h2 id="branch-title" className="font-display text-2xl text-green">By branch today</h2>
      <ul className="mt-5 space-y-4">
        {s.byBranch.map((b) => (
          <li key={b.branchId}>
            <div className="flex justify-between text-sm font-bold text-ink">
              <span>{b.name}</span>
              <span>{b.count}</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${b.name} bookings today`}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={b.count}
              className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-2"
            >
              <div className="h-full rounded-full bg-green" style={{ width: `${(b.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dashboard chips from the design: Fee paid, OTP verified, Fee pending. */
function HoldChip({ row }: { row: UpNextRow }) {
  if (row.status === "PENDING_FEE") return <Chip tone="orange">Fee pending</Chip>;
  if (row.holdMethod === "NONE") return <Chip tone="neutral">Walk-in</Chip>;
  return row.holdMethod === "OTP" ? <Chip tone="yellow">OTP verified</Chip> : <Chip tone="green">Fee paid</Chip>;
}

function UpNext({ rows }: { rows: UpNextRow[] }) {
  return (
    <section aria-labelledby="next-title" className="rounded-card bg-white p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="next-title" className="font-display text-2xl text-green">Up next</h2>
        <Link href="/admin/bookings" className="inline-flex min-h-11 items-center border-b-2 border-green text-sm font-bold text-green">View all bookings</Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-cream-2 p-5 text-center text-muted-strong">Nothing else booked for the rest of today.</p>
      ) : (
        <ul className="mt-3 divide-y divide-cream-2">
          {rows.map((r) => (
            <li key={r.ref} className="grid items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[72px_1.4fr_1fr_1fr_auto]">
              <span className="font-bold text-ink">{time12(r.startsAt)}</span>
              <span>
                <span className="block font-bold text-ink">{r.customerName}</span>
                <span className="block text-sm text-muted-strong">{r.serviceName}</span>
              </span>
              <span className="text-ink">{r.barberName}</span>
              <span className="text-ink">{r.branchName}</span>
              <span className="sm:justify-self-end"><HoldChip row={r} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Attention({ s, settings }: { s: Stats; settings: Settings }) {
  const a = s.attention;
  const items: Array<{ title: string; body: string }> = [];
  if (a.awaitingFee > 0) {
    items.push({
      title: `${a.awaitingFee} ${a.awaitingFee === 1 ? "booking" : "bookings"} awaiting fee`,
      body: `Slots release automatically after ${settings.unpaidHoldMinutes} min`,
    });
  }
  if (a.refundRequests > 0) {
    items.push({
      title: `${a.refundRequests} refund ${a.refundRequests === 1 ? "request" : "requests"}`,
      body: `Cancelled more than ${settings.refundWindowHours} hours ahead`,
    });
  }
  for (const g of a.gaps) {
    items.push({ title: `${g.barberName} has a gap at ${time12(g.startsAt)}`, body: `${g.branchName}. Open it up for walk-ins?` });
  }
  return (
    <section aria-labelledby="attn-title" className="on-dark rounded-card bg-green p-6 text-white">
      <h2 id="attn-title" className="font-display text-2xl text-yellow">Needs your attention</h2>
      {items.length === 0 ? (
        <p className="mt-5 rounded-3xl bg-white/10 p-4">All clear. Nothing needs you right now.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((i) => (
            <li key={i.title} className="rounded-3xl bg-white/10 p-4">
              <p className="font-bold">{i.title}</p>
              <p className="text-sm text-white/85">{i.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Dashboard() {
  const [branch, setBranch] = useState("all");
  const branches = useApi("dash-branches", () => listBranches({ includePaused: true }), SEED_BRANCHES).data;
  const settings = useApi("dash-settings", () => getSettings(), DEFAULT_SETTINGS as Settings).data;
  const q = useApi(`dash-stats:${branch}`, () => getStats({}, branch === "all" ? null : branch));
  const scope = branch === "all" ? "All branches" : branches.find((b) => b.id === branch)?.name ?? "";
  const today = now();
  const s = q.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-green">{greeting(today.getHours())}</h1>
          <p className="mt-1 text-muted-strong">{format(today, "EEEE, d MMM")} · here&apos;s how today is going</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="branch-filter" className="sr-only">Branch</label>
          <Select id="branch-filter" value={branch} onChange={(e) => setBranch(e.target.value)} wrapperClassName="w-48" className="bg-white font-bold">
            <option value="all">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Button href="/admin/bookings?new=1" size="lg">+ New booking</Button>
        </div>
      </header>

      {q.error ? (
        <ErrorRetry title="Could not load the dashboard" onRetry={q.reload} />
      ) : !s || q.loading ? (
        <div role="status" aria-label="Loading dashboard" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-card bg-cream-2" />)}</div>
          <div className="h-72 animate-pulse rounded-card bg-cream-2" />
        </div>
      ) : (
        <>
          <Kpis s={s} />
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <WeekChart s={s} scope={scope} />
            <ByBranch s={s} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <UpNext rows={s.upNext} />
            <Attention s={s} settings={settings} />
          </div>
        </>
      )}
    </div>
  );
}
