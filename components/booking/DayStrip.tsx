import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface DayItem {
  /** yyyy-MM-dd */
  date: string;
  weekday: string;
  day: number;
  /** "Today", "9 slots", "Full" ... */
  caption: string;
  disabled: boolean;
}

type Props = {
  days: DayItem[];
  selected: string;
  onSelect: (date: string) => void;
  monthLabel: string;
  hint: string;
  onPrev?: () => void;
  onNext?: () => void;
};

export function DayStrip({ days, selected, onSelect, monthLabel, hint, onPrev, onNext }: Props) {
  return (
    <div className="lg:rounded-card lg:bg-white lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-green">
          <span className="lg:hidden">Pick date and time</span>
          <span className="hidden lg:inline">{monthLabel}</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted sm:inline">{hint}</span>
          <button type="button" aria-label="Previous 7 days" disabled={!onPrev} onClick={onPrev} className="grid h-11 w-11 place-items-center rounded-full bg-cream-2 text-green disabled:opacity-40">
            <ArrowLeftIcon size={18} />
          </button>
          <button type="button" aria-label="Next 7 days" disabled={!onNext} onClick={onNext} className="grid h-11 w-11 place-items-center rounded-full bg-cream-2 text-green disabled:opacity-40">
            <ArrowRightIcon size={18} />
          </button>
        </div>
      </div>
      <ul aria-label="Choose a day" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-7 lg:overflow-visible">
        {days.map((d) => {
          const on = d.date === selected;
          return (
            <li key={d.date} className="flex-1">
              <button
                type="button"
                aria-pressed={on}
                disabled={d.disabled}
                onClick={() => onSelect(d.date)}
                aria-label={`${d.weekday} ${d.day}, ${d.caption}`}
                className={cn(
                  "flex min-h-[72px] w-full min-w-[68px] flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 transition",
                  on ? "border-green bg-green text-white" : "border-line bg-white text-green-dark",
                  d.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span className={cn("text-[11px] font-bold uppercase tracking-wider", on ? "text-yellow" : "text-muted")}>{d.weekday}</span>
                <span className="font-display text-2xl leading-none">{d.day}</span>
                <span className={cn("hidden text-[11px] lg:block", on ? "text-white/85" : "text-muted")}>{d.caption}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
