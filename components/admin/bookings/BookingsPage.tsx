"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, SearchIcon, Select, useToast } from "@/components/ui";
import { ApiError, listBookings, listBranches } from "@/lib/api";
import { now } from "@/lib/clock";
import { bookingsToCsv } from "@/lib/csv";
import { cn } from "@/lib/cn";
import { downloadFile } from "@/lib/ics";
import { useApi } from "@/lib/hooks/useApi";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { SEED_BRANCHES } from "@/lib/mock/seed";
import { format } from "date-fns";
import { BookingPanel } from "./BookingPanel";
import { MobileSheet } from "./MobileSheet";
import { BookingsTable } from "./BookingsTable";
import { NewBookingDialog } from "./NewBookingDialog";
import { DEFAULTS, PAGE_SIZE, RANGE_LABEL, parseFilters, rangeDates, serializeFilters, tabStatuses, type Filters, type RangeKey, type TabKey } from "./filters";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PENDING_FEE", label: "Fee pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_SHOW", label: "No-show" },
];

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const list = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, ...Array.from({ length: 5 }, (_, i) => Math.min(Math.max(page - 2, 2) + i, pages - 1)).filter((v, i, a) => a.indexOf(v) === i), pages];
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cream-2 pt-4">
      <p className="text-sm text-muted-strong">Showing {from}–{to} of {total}</p>
      <ul className="flex flex-wrap gap-2">
        {list.map((p) => (
          <li key={p}>
            <button
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn("grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-bold", p === page ? "bg-green text-white" : "bg-cream-2 text-green-dark")}
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function BookingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1400px)");
  const f = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);
  const newOpen = sp.get("new") === "1";
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [text, setText] = useState(f.q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const branches = useApi("bk-branches", () => listBranches({ includePaused: true }), SEED_BRANCHES).data;
  const { from, to } = rangeDates(f, now());
  const statuses = tabStatuses(f.tab);
  const query = { branchId: f.branch || undefined, from, to, search: f.q, status: statuses, sort: f.sort };
  const q = useApi(`bk:${JSON.stringify([query, f.page, version])}`, () => listBookings({ ...query, page: f.page, pageSize: PAGE_SIZE }));

  // The newest filters, updated the moment a change is made. router.replace lands a moment later, so two quick
  // changes (or a debounced search followed by a branch change) must build on each other, not on stale state.
  const latest = useRef(f);
  useEffect(() => {
    latest.current = f;
  }, [f]);
  const go = (next: Filters, extra: Record<string, string> = {}) => {
    latest.current = next;
    router.replace(`${pathname}${serializeFilters(next, extra)}`, { scroll: false });
  };
  const update = (patch: Partial<Filters>) => go({ ...latest.current, page: 1, ...patch });
  const reload = () => setVersion((v) => v + 1);

  const data = q.loaded ? q.data : undefined;
  const rows = data?.items ?? [];
  const counts = data?.counts;
  const countFor = (k: TabKey) => (!counts ? null : k === "ALL" ? counts.ALL : k === "CONFIRMED" ? counts.CONFIRMED + counts.IN_SERVICE : counts[k]);
  const scope = f.branch ? `at ${branches.find((b) => b.id === f.branch)?.name ?? ""}` : `across ${branches.length} branches`;
  const activeRef = f.ref || (desktop ? rows[0]?.ref ?? "" : "");

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await listBookings(query);
      downloadFile(`barbr-bookings-${format(now(), "yyyy-MM-dd")}.csv`, `﻿${bookingsToCsv(all.items)}`, "text/csv;charset=utf-8");
      toast.show({ message: `Exported ${all.items.length} ${all.items.length === 1 ? "booking" : "bookings"}` });
    } catch (e) {
      toast.show({ message: e instanceof ApiError ? e.message : "Could not export. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  const panel = activeRef ? <BookingPanel bookingRef={activeRef} version={version} onChanged={reload} /> : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-green">Bookings</h1>
          <p className="mt-1 text-muted-strong" aria-live="polite">
            {counts ? `${counts.ALL} ${counts.ALL === 1 ? "booking" : "bookings"} ${RANGE_LABEL[f.range]} ${scope}` : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="lg" onClick={exportCsv} disabled={exporting}>{exporting ? "Exporting…" : "Export CSV"}</Button>
          <Button size="lg" onClick={() => go(latest.current, { new: "1" })}>+ New booking</Button>
        </div>
      </header>

      <section aria-label="Filters" className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="search" className="sr-only">Search name, phone or booking ref</label>
            <SearchIcon size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="search"
              type="search"
              value={text}
              placeholder="Search name, phone or booking ref"
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => update({ q: v.trim() }), 250);
              }}
              className="min-h-[52px] w-full rounded-full border-2 border-line bg-white pl-13 pr-5 text-base focus:border-green"
              style={{ paddingLeft: 52 }}
            />
          </div>
          <label htmlFor="branch" className="sr-only">Branch</label>
          <Select id="branch" value={f.branch} onChange={(e) => update({ branch: e.target.value })} wrapperClassName="min-w-[140px] flex-1 sm:w-44 sm:flex-none" className="rounded-full bg-white font-bold">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <label htmlFor="range" className="sr-only">Date range</label>
          <Select id="range" value={f.range} onChange={(e) => update({ range: e.target.value as RangeKey })} wrapperClassName="min-w-[140px] flex-1 sm:w-44 sm:flex-none" className="rounded-full bg-white font-bold">
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </Select>
        </div>

        {f.range === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            {([["from", "From"], ["to", "To"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm font-bold text-green-dark">
                {label}
                <input
                  type="date"
                  value={f[k]}
                  onChange={(e) => update({ [k]: e.target.value })}
                  className="min-h-12 rounded-input border-2 border-line bg-white px-3 font-medium text-ink"
                />
              </label>
            ))}
          </div>
        )}

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = countFor(t.key);
            const on = f.tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => update({ tab: t.key })}
                className={cn("min-h-11 rounded-full border-2 px-5 text-base font-bold transition", on ? "border-green bg-green text-white" : "border-line bg-white text-green-dark hover:border-green")}
              >
                {t.label}{n === null ? "" : ` ${n}`}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 min-[1400px]:grid-cols-[minmax(0,1fr)_380px] min-[1400px]:items-start">
        <section aria-label="Bookings list" className="rounded-card bg-white p-4 sm:p-6 max-lg:bg-transparent max-lg:p-0">
          {q.error ? (
            <div role="alert" className="rounded-3xl bg-status-cancelled p-6 text-center text-status-cancelled-ink">
              <p className="font-bold">Could not load bookings.</p>
              <Button className="mt-3" onClick={q.reload}>Try again</Button>
            </div>
          ) : !data ? (
            <div role="status" aria-label="Loading bookings" className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-cream-2" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-3xl bg-cream-2 p-8 text-center">
              <p className="font-display text-2xl text-green">No bookings match these filters</p>
              <p className="mt-1 text-muted-strong">Try a wider date range or clear the search.</p>
              <Button className="mt-4" variant="outline" onClick={() => { setText(""); go({ ...DEFAULTS, range: "month" }); }}>Show this month</Button>
            </div>
          ) : (
            <>
              <div className={cn(q.loading && "opacity-60 transition-opacity")} aria-busy={q.loading}>
                <BookingsTable
                  rows={rows}
                  selectedRef={activeRef}
                  onSelect={(ref) => update({ ref, page: latest.current.page })}
                  sort={f.sort}
                  onSort={() => update({ sort: f.sort === "asc" ? "desc" : "asc" })}
                  showDate={f.range !== "today"}
                />
              </div>
              <Pagination page={f.page} total={data.total} onPage={(p) => update({ page: p })} />
            </>
          )}
        </section>

        {desktop && (
          <aside aria-label="Booking details" className="min-[1400px]:sticky min-[1400px]:top-6">
            {panel ?? <p className="rounded-card bg-white p-6 text-center text-muted-strong">Select a booking to see its details.</p>}
          </aside>
        )}
      </div>

      {!desktop && f.ref && (
        <MobileSheet onClose={() => update({ ref: "", page: latest.current.page })}>
          <BookingPanel bookingRef={f.ref} version={version} onChanged={reload} />
        </MobileSheet>
      )}

      {newOpen && (
        <NewBookingDialog
          onClose={() => go(latest.current)}
          onCreated={(b) => {
            toast.show({ message: `Booking ${b.ref} created` });
            reload();
            go({ ...latest.current, ref: b.ref });
          }}
        />
      )}
    </div>
  );
}
