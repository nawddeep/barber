import { cn } from "@/lib/cn";
import { CheckIcon } from "./Icons";

export const BOOKING_STEPS = ["Branch & service", "Date & time", "Your details", "Done"] as const;

export function Stepper({
  current,
  steps = BOOKING_STEPS,
  className,
}: {
  /** 1-based index of the active step. */
  current: number;
  steps?: readonly string[];
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-3", className)} aria-label="Booking progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-3 text-sm font-bold text-green-dark"
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full text-xs",
                done && "bg-yellow",
                active && "bg-green text-white",
                !done && !active && "bg-cream-2 text-muted",
              )}
            >
              {done ? <CheckIcon size={14} aria-label="Completed" /> : n}
            </span>
            <span className={cn("hidden lg:inline", !done && !active && "text-muted")}>{label}</span>
            {n < steps.length ? <span className="hidden h-px w-8 bg-line lg:block" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
