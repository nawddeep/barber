"use client";

import { format } from "date-fns";
import { Avatar } from "@/components/ui";
import type { BookingRow, CalendarData } from "@/lib/api";
import { HOUR_PX, blockBox, hourMarks, minutesOfDay, nowOffset, shortName, weekDays, yToMinutes } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatMinutes, time12 } from "@/lib/format";
import type { DayHours } from "@/lib/types";
import { BLOCK_STYLE, HATCH } from "./statusStyles";

type Props = {
  data: CalendarData;
  /** Any date in the week shown. */
  date: Date;
  barberId: string;
  nowMs: number;
  selectedRef: string;
  onSelect: (ref: string) => void;
  onDay: (day: Date) => void;
  onEmpty: (day: Date, startMin: number) => void;
};

/** Seven days for one barber. Compact blocks, same 72px an hour. */
export function WeekGrid({ data, date, barberId, nowMs, selectedRef, onSelect, onDay, onEmpty }: Props) {
  const days = weekDays(date);
  const barber = data.barbers.find((b) => b.id === barberId);
  const hours = days.map((d) => data.branch.weekHours[d.getDay()]).filter((h): h is DayHours => !!h);
  if (!barber || hours.length === 0) return <p className="rounded-card bg-white p-8 text-center text-muted-strong">Nothing to show for this barber.</p>;
  const open = Math.min(...hours.map((h) => h.open));
  const close = Math.max(...hours.map((h) => h.close));
  const height = ((close - open) / 60) * HOUR_PX;
  const nowDate = new Date(nowMs);
  const template = { gridTemplateColumns: `64px repeat(7, minmax(120px, 1fr))` };
  const byDay = (d: Date) => data.bookings.filter((b) => b.barberId === barberId && format(new Date(b.startsAt), "yyyy-MM-dd") === format(d, "yyyy-MM-dd"));

  return (
    <div className="overflow-x-auto rounded-card bg-white p-4 sm:p-6" data-testid="week-grid">
      <div className="min-w-max">
        <div className="mb-3 flex items-center gap-3 px-1">
          <Avatar name={barber.name} size={40} decorative />
          <span className="font-bold text-ink">{barber.name}</span>
        </div>
        <div className="sticky top-0 z-20 grid bg-white pb-3" style={template}>
          <div />
          {days.map((d) => {
            const today = format(d, "yyyy-MM-dd") === format(nowDate, "yyyy-MM-dd");
            return (
              <button key={d.toISOString()} type="button" onClick={() => onDay(d)} aria-label={`Open ${format(d, "EEEE d MMMM")}`} className={cn("mx-1 min-h-11 rounded-2xl px-2 py-1 text-center", today ? "bg-green text-white" : "bg-cream-2 text-green-dark")}>
                <span className="block text-xs font-bold uppercase tracking-wider">{format(d, "EEE")}</span>
                <span className="block font-display text-xl leading-none">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="relative grid" style={{ ...template, height }}>
          <div className="relative sticky left-0 z-30 bg-white" aria-hidden="true">
            {hourMarks(open, close).map((m) => (
              <span key={m} className="absolute -translate-y-1/2 text-sm text-muted-strong" style={{ top: ((m - open) / 60) * HOUR_PX }}>{formatMinutes(m)}</span>
            ))}
          </div>
          {days.map((d) => {
            const h = data.branch.weekHours[d.getDay()];
            const isToday = format(d, "yyyy-MM-dd") === format(nowDate, "yyyy-MM-dd");
            const nowTop = isToday ? nowOffset(minutesOfDay(nowDate), open, close) : null;
            return (
              <div
                key={d.toISOString()}
                role="group"
                aria-label={format(d, "EEEE d MMMM")}
                data-day={format(d, "yyyy-MM-dd")}
                className={cn("relative z-[1]", h ? "cursor-cell" : "bg-cream-2/50")}
                onClick={(e) => {
                  if (!h || (e.target as HTMLElement).closest("[data-block],[data-break]")) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onEmpty(d, Math.min(yToMinutes(e.clientY - rect.top - HOUR_PX / 4, open), h.close - 30));
                }}
              >
                {h && data.breaks.filter((k) => k.barberId === barberId).map((k) => {
                  const box = blockBox(k.startMin, k.endMin, open);
                  return <div key={k.id} data-break role="img" aria-label={`Break ${formatMinutes(k.startMin)} to ${formatMinutes(k.endMin)}`} className={cn("absolute inset-x-1 rounded-xl", HATCH)} style={{ top: box.top + 1, height: box.height - 2 }} />;
                })}
                {byDay(d).map((b: BookingRow) => {
                  const start = minutesOfDay(new Date(b.startsAt));
                  const box = blockBox(start, start + (+new Date(b.endsAt) - +new Date(b.startsAt)) / 60000, open);
                  const selected = b.ref === selectedRef;
                  return (
                    <button
                      key={b.ref}
                      type="button"
                      data-block
                      data-ref={b.ref}
                      aria-pressed={selected}
                      aria-label={`${b.customer.name}, ${b.serviceName}, ${format(d, "EEEE")} ${time12(b.startsAt)}`}
                      onClick={() => onSelect(b.ref)}
                      className={cn("absolute inset-x-1 overflow-hidden rounded-xl px-2 py-1 text-left text-xs leading-tight text-ink", BLOCK_STYLE[b.status], selected && "ring-[3px] ring-inset ring-green")}
                      style={{ top: box.top + 1, height: box.height - 2 }}
                    >
                      <span className="block truncate font-bold">{shortName(b.customer.name)}</span>
                      {box.height >= 50 && <span className="block truncate">{time12(b.startsAt)}</span>}
                    </button>
                  );
                })}
                {nowTop !== null && <div className="pointer-events-none absolute inset-x-0 z-10 h-[3px] bg-orange" style={{ top: nowTop }} />}
              </div>
            );
          })}
          <div className="pointer-events-none absolute inset-y-0 left-[64px] right-0" aria-hidden="true">
            {hourMarks(open, close).map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-line" style={{ top: ((m - open) / 60) * HOUR_PX }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
