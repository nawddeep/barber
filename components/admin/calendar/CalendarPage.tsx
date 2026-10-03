"use client";

import { addMinutes, format, getDay, parseISO, startOfDay } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, Button, Select, useToast } from "@/components/ui";
import { ApiError, getCalendarData, listBranches, rescheduleBooking, type BookingRow } from "@/lib/api";
import { MOVE_PROBLEM_TEXT, checkMove, shortName, weekDays } from "@/lib/calendar";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatMinutes, localDate } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useNow } from "@/lib/hooks/useNow";
import { SEED_BRANCHES } from "@/lib/mock/seed";
import { BookingPanel } from "../bookings/BookingPanel";
import { MobileSheet } from "../bookings/MobileSheet";
import { NewBookingDialog } from "../bookings/NewBookingDialog";
import { DayGrid } from "./DayGrid";
import { WeekGrid } from "./WeekGrid";
import { parseCalParams, serializeCalParams, shiftDate, type CalParams, type View } from "./params";
import { BLOCK_STYLE, HATCH } from "./statusStyles";

const LEGEND = [
  { label: "Confirmed", cls: BLOCK_STYLE.CONFIRMED },
  { label: "Fee pending", cls: BLOCK_STYLE.PENDING_FEE },
  { label: "In service", cls: BLOCK_STYLE.IN_SERVICE },
  { label: "Completed", cls: BLOCK_STYLE.COMPLETED },
  { label: "Break", cls: HATCH },
];

export function CalendarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1400px)");
  const nowMs = useNow(30_000);
  const p = useMemo(() => parseCalParams(new URLSearchParams(sp.toString())), [sp]);
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState<{ branchId: string; barberId: string; startsAt: string } | null>(null);

  const today = localDate(now());
  const branches = useApi("cal-branches", () => listBranches({ includePaused: true }), SEED_BRANCHES).data;
  const branchId = branches.some((b) => b.id === p.branch) ? p.branch : branches[0]?.id ?? "";
  const date = p.date || today;
  const dayDate = parseISO(date);
  const days = weekDays(dayDate);
  const from = p.view === "week" ? localDate(days[0]) : date;
  const to = p.view === "week" ? localDate(days[6]) : date;

  // Newest params, updated at once, so quick successive changes build on each other (see the bookings page).
  const latest = useRef(p);
  useEffect(() => {
    latest.current = p;
  }, [p]);
  const go = (next: CalParams) => {
    latest.current = next;
    router.replace(`${pathname}${serializeCalParams(next, today)}`, { scroll: false });
  };
  const update = (patch: Partial<CalParams>) => go({ ...latest.current, ...patch });
  // Steps from the newest date, so two quick clicks on an arrow move two days, not one.
  const step = (dir: 1 | -1) => update({ date: shiftDate(latest.current.date || today, latest.current.view, dir) });
  const reload = () => setVersion((v) => v + 1);

  const q = useApi(`cal:${branchId}:${from}:${to}:${version}`, () => getCalendarData({ branchId, from, to }));
  const data = q.loaded ? q.data : undefined;
  const barberId = data?.barbers.some((b) => b.id === p.barber) ? p.barber : data?.barbers[0]?.id ?? "";
  const hours = data?.branch.weekHours[getDay(dayDate)] ?? null;

  /** Checks the rules, moves the booking and offers Undo. Shared by drag, Alt+arrows and the page. */
  const requestMove = async (b: BookingRow, toBarber: string, startMin: number) => {
    if (!data || !hours) return;
    const verdict = checkMove({ booking: b, barberId: toBarber, day: dayDate, startMin, openMin: hours.open, closeMin: hours.close, bookings: data.bookings, breaks: data.breaks, now: new Date(nowMs || +now()) });
    if (!verdict.ok) {
      toast.show({ message: MOVE_PROBLEM_TEXT[verdict.reason] });
      return;
    }
    const was = { startsAt: b.startsAt, barberId: b.barberId };
    const startsAt = addMinutes(startOfDay(dayDate), startMin).toISOString();
    try {
      await rescheduleBooking({ ref: b.ref, startsAt, barberId: toBarber });
      reload();
      const who = data.barbers.find((x) => x.id === toBarber)?.name.split(" ")[0] ?? "";
      toast.show({
        message: `Moved ${shortName(b.customer.name)} to ${formatMinutes(startMin)} · ${who}`,
        actionLabel: "Undo",
        duration: 5000,
        onAction: async () => {
          try {
            await rescheduleBooking({ ref: b.ref, startsAt: was.startsAt, barberId: was.barberId });
            toast.show({ message: "Move undone" });
            reload();
          } catch (e) {
            toast.show({ message: e instanceof ApiError ? e.message : "Could not undo the move." });
          }
        },
      });
    } catch (e) {
      toast.show({ message: e instanceof ApiError ? e.message : "Could not move the booking." });
    }
  };

  const openNew = (bId: string, day: Date, startMin: number) => {
    const start = addMinutes(startOfDay(day), startMin);
    if (start <= new Date(nowMs || +now())) {
      toast.show({ message: "That time has already passed." });
      return;
    }
    setCreating({ branchId, barberId: bId, startsAt: start.toISOString() });
  };

  const label = p.view === "week" ? `${format(days[0], "d MMM")} – ${format(days[6], "d MMM")}` : format(dayDate, "EEEE, d MMM");
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
  const panel = p.ref ? <BookingPanel bookingRef={p.ref} version={version} onChanged={reload} /> : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-green">Calendar</h1>
          <p className="mt-1 text-muted-strong" aria-live="polite">{branchName} · {label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="View" className="inline-flex rounded-full border-2 border-line bg-white p-1">
            {(["day", "week"] as View[]).map((v) => (
              <button key={v} type="button" aria-pressed={p.view === v} onClick={() => update({ view: v })} className={cn("min-h-11 rounded-full px-6 text-sm font-bold capitalize", p.view === v ? "bg-green text-white" : "text-green")}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={p.view === "week" ? "Previous week" : "Previous day"} onClick={() => step(-1)} className="grid h-12 w-12 place-items-center rounded-full border-2 border-line bg-white text-green">
              <ArrowLeftIcon size={18} />
            </button>
            <button type="button" onClick={() => update({ date: "" })} className="min-h-11 rounded-full px-3 font-bold text-green-dark">Today</button>
            <button type="button" aria-label={p.view === "week" ? "Next week" : "Next day"} onClick={() => step(1)} className="grid h-12 w-12 place-items-center rounded-full border-2 border-line bg-white text-green">
              <ArrowRightIcon size={18} />
            </button>
          </div>
          <label htmlFor="cal-branch" className="sr-only">Branch</label>
          <Select id="cal-branch" value={branchId} onChange={(e) => update({ branch: e.target.value, barber: "", ref: "" })} wrapperClassName="w-44" className="bg-white font-bold">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.paused ? " (paused)" : ""}</option>)}
          </Select>
          {p.view === "week" && data && (
            <>
              <label htmlFor="cal-barber" className="sr-only">Barber</label>
              <Select id="cal-barber" value={barberId} onChange={(e) => update({ barber: e.target.value })} wrapperClassName="w-48" className="bg-white font-bold">
                {data.barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </>
          )}
        </div>
      </header>

      <ul aria-label="Colour key" className="flex flex-wrap gap-2">
        {LEGEND.map((l) => (
          <li key={l.label} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-ink">
            <span aria-hidden="true" className={cn("h-3.5 w-3.5 rounded-full border border-line", l.cls)} /> {l.label}
          </li>
        ))}
      </ul>

      <div className={cn("grid gap-6", desktop && p.ref ? "min-[1400px]:grid-cols-[minmax(0,1fr)_380px] min-[1400px]:items-start" : "")}>
        <section aria-label="Schedule" className="min-w-0">
          {q.error ? (
            <div role="alert" className="rounded-3xl bg-status-cancelled p-6 text-center text-status-cancelled-ink">
              <p className="font-bold">Could not load the calendar.</p>
              <Button className="mt-3" onClick={q.reload}>Try again</Button>
            </div>
          ) : !data ? (
            <div role="status" aria-label="Loading calendar" className="h-[600px] animate-pulse rounded-card bg-cream-2" />
          ) : p.view === "week" ? (
            <WeekGrid
              data={data}
              date={dayDate}
              barberId={barberId}
              nowMs={nowMs}
              selectedRef={p.ref}
              onSelect={(ref) => update({ ref })}
              onDay={(d) => update({ view: "day", date: localDate(d) })}
              onEmpty={(d, m) => openNew(barberId, d, m)}
            />
          ) : !hours ? (
            <p className="rounded-card bg-white p-10 text-center font-display text-3xl text-green">{branchName} is closed on {format(dayDate, "EEEE")}s.</p>
          ) : data.barbers.length === 0 ? (
            <p className="rounded-card bg-white p-10 text-center font-display text-3xl text-green">No barbers at {branchName} yet.</p>
          ) : (
            <DayGrid
              data={data}
              day={dayDate}
              open={hours.open}
              close={hours.close}
              nowMs={nowMs}
              selectedRef={p.ref}
              onSelect={(ref) => update({ ref })}
              onEmpty={(bId, m) => openNew(bId, dayDate, m)}
              onMove={(b, bId, m) => void requestMove(b, bId, m)}
            />
          )}
        </section>

        {desktop && p.ref && (
          <aside aria-label="Booking details" className="min-[1400px]:sticky min-[1400px]:top-6">
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => update({ ref: "" })} className="min-h-11 rounded-full px-4 text-sm font-bold text-green underline underline-offset-4">Close details</button>
            </div>
            {panel}
          </aside>
        )}
      </div>

      {!desktop && p.ref && (
        <MobileSheet onClose={() => update({ ref: "" })}>{panel}</MobileSheet>
      )}

      {creating && (
        <NewBookingDialog
          initial={creating}
          onClose={() => setCreating(null)}
          onCreated={(b) => {
            setCreating(null);
            toast.show({ message: `Booking ${b.ref} created` });
            reload();
            update({ ref: b.ref });
          }}
        />
      )}
    </div>
  );
}
