import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { time12 } from "@/lib/format";
import { allSlots, type Slot, type SlotGroupName, type SlotGroups } from "@/lib/slots";

const GROUPS: Array<{ key: SlotGroupName; label: string; dot: string }> = [
  { key: "morning", label: "Morning", dot: "bg-yellow" },
  { key: "afternoon", label: "Afternoon", dot: "bg-orange" },
  { key: "evening", label: "Evening", dot: "bg-blue" },
];

type Props = {
  /** null while loading. */
  groups: SlotGroups | null;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  emptyMessage: string;
  onTryNextDay?: () => void;
};

export function SlotGrid({ groups, selected, onSelect, emptyMessage, onTryNextDay }: Props) {
  if (groups === null) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading slots…</span>
        <div aria-hidden="true" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-full bg-cream-2" />
          ))}
        </div>
      </div>
    );
  }

  const all = allSlots(groups);
  const open = all.filter((s) => s.available).length;

  if (open === 0) {
    return (
      <div role="status" className="rounded-card bg-cream-2 p-6 text-center">
        <p className="font-display text-2xl text-green">{emptyMessage}</p>
        {onTryNextDay && (
          <Button variant="primary" className="mt-4" onClick={onTryNextDay}>
            Try the next day
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{open} slots available</p>
      {GROUPS.filter((g) => groups[g.key].length > 0).map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-green-dark">
            <span className={cn("h-2.5 w-2.5 rounded-full", g.dot)} aria-hidden="true" />
            {g.label}
          </h3>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {groups[g.key].map((s) => {
              const on = s.startsAt === selected;
              return (
                <li key={s.startsAt}>
                  <button
                    type="button"
                    disabled={!s.available}
                    aria-pressed={on}
                    aria-label={s.available ? time12(s.startsAt) : `${time12(s.startsAt)}, unavailable`}
                    onClick={() => onSelect(s)}
                    className={cn(
                      "min-h-12 w-full rounded-full border-2 px-2 text-sm font-bold transition sm:text-base",
                      on && "border-orange bg-orange text-ink",
                      !on && s.available && "border-line bg-white text-green-dark hover:border-green",
                      !s.available && "cursor-not-allowed border-transparent bg-cream-2 text-muted line-through",
                    )}
                  >
                    {time12(s.startsAt)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
