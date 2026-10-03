"use client";

import { format } from "date-fns";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import type { BookingRow, CalendarData } from "@/lib/api";
import { HOUR_PX, blockBox, checkMove, dropTarget, hourMarks, minutesOfDay, nowOffset, shortName, yToMinutes, type MoveProblem } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatMinutes, time12 } from "@/lib/format";
import { BLOCK_STYLE, HATCH } from "./statusStyles";

type Drag = { ref: string; barberId: string; startMin: number; ok: boolean; reason?: MoveProblem };

type Props = {
  data: CalendarData;
  /** The day shown. */
  day: Date;
  open: number;
  close: number;
  nowMs: number;
  selectedRef: string;
  onSelect: (ref: string) => void;
  /** Click on an empty part of a barber's column. */
  onEmpty: (barberId: string, startMin: number) => void;
  /** Drag drop or Alt+arrow. The page checks the rules again and talks to the API. */
  onMove: (booking: BookingRow, barberId: string, startMin: number) => void;
};

const MOVE_HINT = "Press Enter to open. Hold Alt and press the arrow keys to move this booking by 30 minutes or to another barber.";

/** One column per barber. Blocks are positioned by time at 72px an hour. */
export function DayGrid({ data, day, open, close, nowMs, selectedRef, onSelect, onEmpty, onMove }: Props) {
  const { barbers, breaks, bookings } = data;
  const height = ((close - open) / 60) * HOUR_PX;
  const cols = useRef<Record<string, HTMLDivElement | null>>({});
  const justDragged = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const nowDate = new Date(nowMs);
  const isToday = format(nowDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  const nowTop = isToday ? nowOffset(minutesOfDay(nowDate), open, close) : null;
  const template = { gridTemplateColumns: `64px repeat(${barbers.length}, minmax(170px, 1fr))` };

  const startDrag = (e: React.PointerEvent, b: BookingRow) => {
    // Touch scrolls the page; phones and keyboards use Reschedule or Alt+arrows instead.
    if (e.button !== 0 || e.pointerType === "touch") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grab = { x: e.clientX, y: e.clientY, offset: e.clientY - rect.top };
    const duration = (+new Date(b.endsAt) - +new Date(b.startsAt)) / 60000;
    let moving = false;
    let last: Drag | null = null;

    const compute = (ev: PointerEvent): Drag => {
      const entries = barbers.map((br) => [br.id, cols.current[br.id]?.getBoundingClientRect()] as const).filter((x): x is [string, DOMRect] => !!x[1]);
      const hit = entries.find(([, r]) => ev.clientX >= r.left && ev.clientX < r.right) ??
        entries.reduce((best, cur) => (Math.abs(ev.clientX - (cur[1].left + cur[1].width / 2)) < Math.abs(ev.clientX - (best[1].left + best[1].width / 2)) ? cur : best));
      const startMin = dropTarget({ pointerY: ev.clientY, grabOffsetPx: grab.offset, columnTop: hit[1].top, openMin: open, closeMin: close, durationMin: duration });
      const check = checkMove({ booking: b, barberId: hit[0], day, startMin, openMin: open, closeMin: close, bookings, breaks, now: new Date() });
      return { ref: b.ref, barberId: hit[0], startMin, ok: check.ok, reason: check.ok ? undefined : check.reason };
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      setDrag(null);
    };
    // Releasing the mouse after a drag (dropped or cancelled with Escape) also fires a click on whatever is under
    // the pointer, which would open "New booking". Swallow that one click.
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    const onMoveEv = (ev: PointerEvent) => {
      if (!moving && Math.hypot(ev.clientX - grab.x, ev.clientY - grab.y) < 6) return;
      if (!moving) {
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.addEventListener("pointerup", () => setTimeout(() => window.removeEventListener("click", swallow, true), 0), { once: true });
      }
      moving = true;
      last = compute(ev);
      setDrag(last);
    };
    const onUp = () => {
      const result = last;
      cleanup();
      if (!moving) return;
      justDragged.current = true; // swallow the click that follows a drag
      setTimeout(() => (justDragged.current = false), 0);
      if (result && (result.barberId !== b.barberId || result.startMin !== minutesOfDay(new Date(b.startsAt)))) onMove(b, result.barberId, result.startMin);
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && ((last = null), (moving = false), cleanup());
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
  };

  const keyMove = (e: React.KeyboardEvent, b: BookingRow) => {
    if (!e.altKey || !e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const idx = barbers.findIndex((x) => x.id === b.barberId);
    const startMin = minutesOfDay(new Date(b.startsAt));
    if (e.key === "ArrowUp") onMove(b, b.barberId, startMin - 30);
    if (e.key === "ArrowDown") onMove(b, b.barberId, startMin + 30);
    if (e.key === "ArrowLeft" && idx > 0) onMove(b, barbers[idx - 1].id, startMin);
    if (e.key === "ArrowRight" && idx < barbers.length - 1) onMove(b, barbers[idx + 1].id, startMin);
  };

  const clickEmpty = (e: React.MouseEvent<HTMLDivElement>, barberId: string) => {
    if ((e.target as HTMLElement).closest("[data-block],[data-break]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onEmpty(barberId, Math.min(yToMinutes(e.clientY - rect.top - HOUR_PX / 4, open), close - 30));
  };

  return (
    <div className="overflow-x-auto rounded-card bg-white p-4 sm:p-6" data-testid="day-grid">
      <div className="min-w-max">
        <div className="sticky top-0 z-20 grid bg-white pb-3" style={template}>
          <div />
          {barbers.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-2">
              <Avatar name={b.name} size={44} decorative />
              <span className="font-bold text-ink">{b.name}</span>
            </div>
          ))}
        </div>

        <div className="relative grid" style={{ ...template, height }}>
          <div className="relative sticky left-0 z-30 bg-white" aria-hidden="true">
            {hourMarks(open, close).map((m) => (
              <span key={m} className="absolute -translate-y-1/2 text-sm text-muted-strong" style={{ top: ((m - open) / 60) * HOUR_PX }}>
                {formatMinutes(m)}
              </span>
            ))}
          </div>

          {barbers.map((br) => (
            <div
              key={br.id}
              ref={(el) => {
                cols.current[br.id] = el;
              }}
              data-column={br.id}
              role="group"
              aria-label={`${br.name}'s day`}
              onClick={(e) => clickEmpty(e, br.id)}
              className="relative z-[1] cursor-cell"
            >
              {breaks.filter((k) => k.barberId === br.id).map((k) => {
                const box = blockBox(k.startMin, k.endMin, open);
                return (
                  <div
                    key={k.id}
                    data-break
                    role="img"
                    aria-label={`${br.name} is on break ${formatMinutes(k.startMin)} to ${formatMinutes(k.endMin)}`}
                    className={cn("absolute inset-x-1.5 rounded-2xl", HATCH)}
                    style={{ top: box.top + 1, height: box.height - 2 }}
                  />
                );
              })}

              {bookings.filter((b) => b.barberId === br.id).map((b) => {
                const start = minutesOfDay(new Date(b.startsAt));
                const end = start + (+new Date(b.endsAt) - +new Date(b.startsAt)) / 60000;
                const box = blockBox(start, end, open);
                const tall = box.height >= 60;
                const selected = b.ref === selectedRef;
                return (
                  <button
                    key={b.ref}
                    type="button"
                    data-block
                    data-ref={b.ref}
                    data-top={box.top}
                    data-height={box.height}
                    aria-pressed={selected}
                    aria-describedby="move-hint"
                    aria-label={`${b.customer.name}, ${b.serviceName}, ${time12(b.startsAt)} to ${time12(b.endsAt)}, ${b.status.toLowerCase().replace("_", " ")}`}
                    onPointerDown={(e) => startDrag(e, b)}
                    onClick={() => !justDragged.current && onSelect(b.ref)}
                    onKeyDown={(e) => keyMove(e, b)}
                    className={cn(
                      "absolute inset-x-1.5 overflow-hidden rounded-2xl px-3 py-1.5 text-left text-[13px] leading-tight text-ink transition-opacity",
                      BLOCK_STYLE[b.status],
                      selected && "ring-[3px] ring-inset ring-green",
                      drag?.ref === b.ref && "opacity-40",
                    )}
                    style={{ top: box.top + 1, height: box.height - 2, touchAction: "pan-y" }}
                  >
                    {tall ? (
                      <>
                        <span className="block font-bold">{shortName(b.customer.name)}</span>
                        <span className="block">{b.serviceName}</span>
                      </>
                    ) : (
                      <span className="block truncate"><b>{shortName(b.customer.name)}</b> · {b.serviceName.split(" ")[0]}</span>
                    )}
                  </button>
                );
              })}

              {drag && drag.barberId === br.id && (() => {
                const src = bookings.find((x) => x.ref === drag.ref)!;
                const dur = (+new Date(src.endsAt) - +new Date(src.startsAt)) / 60000;
                const box = blockBox(drag.startMin, drag.startMin + dur, open);
                return (
                  <div
                    data-testid="drag-ghost"
                    data-ok={drag.ok}
                    className={cn("pointer-events-none absolute inset-x-1.5 z-10 rounded-2xl border-[3px] border-dashed px-3 py-1.5 text-[13px] font-bold", drag.ok ? "border-green bg-green/15 text-green-dark" : "border-orange-ink bg-status-cancelled/80 text-status-cancelled-ink")}
                    style={{ top: box.top + 1, height: box.height - 2 }}
                  >
                    {formatMinutes(drag.startMin)}{drag.ok ? "" : " · not possible"}
                  </div>
                );
              })()}
            </div>
          ))}

          <div className="pointer-events-none absolute inset-y-0 left-[64px] right-0" aria-hidden="true">
            {hourMarks(open, close).map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-line" style={{ top: ((m - open) / 60) * HOUR_PX }} />
            ))}
          </div>

          {nowTop !== null && (
            <div className="pointer-events-none absolute left-[56px] right-0 z-10 flex items-center" style={{ top: nowTop }} data-testid="now-line" data-top={nowTop}>
              <span className="h-3 w-3 -translate-y-px rounded-full bg-orange" />
              <span className="h-[3px] flex-1 bg-orange" />
              <span className="absolute -top-3.5 right-0 rounded-full bg-orange px-2.5 py-0.5 text-xs font-bold text-ink" data-testid="now-label">{time12(new Date(nowMs).toISOString())}</span>
            </div>
          )}
        </div>
      </div>
      <p id="move-hint" className="sr-only">{MOVE_HINT}</p>
    </div>
  );
}
