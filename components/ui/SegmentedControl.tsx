"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** "boxes" = separate selectable boxes (fee rules); "pill" = joined pill (Day/Week). */
  variant?: "boxes" | "pill";
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "boxes",
  className,
}: SegmentedControlProps<T>) {
  const pill = variant === "pill";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        pill ? "inline-flex rounded-full border-2 border-line bg-white p-1" : "grid grid-cols-3 gap-3",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 text-sm font-bold transition",
              pill
                ? cn("rounded-full px-6", active ? "bg-green text-white" : "text-green")
                : cn(
                    "rounded-3xl border-2 px-3 py-4 text-center",
                    active ? "border-green bg-butter text-green-dark" : "border-line bg-white text-green-dark",
                  ),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
