"use client";

import { cn } from "@/lib/cn";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Use on a green card so the knob stays visible. */
  tone?: "default" | "onGreen";
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, tone = "default", disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-11 w-16 shrink-0 items-center disabled:opacity-50"
    >
      <span
        className={cn(
          "h-8 w-14 rounded-full transition",
          checked ? (tone === "onGreen" ? "bg-yellow" : "bg-green") : "bg-line",
        )}
      />
      <span
        className={cn(
          "absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full transition-all",
          checked ? "left-[34px]" : "left-[5px]",
          checked && tone === "onGreen" ? "bg-green-dark" : "bg-white",
        )}
      />
    </button>
  );
}
