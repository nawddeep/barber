"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  className?: string;
};

export function OtpInput({
  value,
  onChange,
  length = 4,
  disabled,
  invalid,
  label = "Enter the 4-digit code",
  className,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const set = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = digits.slice();
      next[index] = "";
      onChange(next.join("").slice(0, length));
      return;
    }
    const next = digits.slice();
    clean.split("").forEach((ch, k) => {
      if (index + k < length) next[index + k] = ch;
    });
    onChange(next.join(""));
    refs.current[Math.min(index + clean.length, length - 1)]?.focus();
  };

  return (
    <div role="group" aria-label={label} className={cn("flex gap-3", className)}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-14 rounded-input border-2 bg-white text-center font-display text-2xl text-green-dark",
            "focus:border-orange",
            d ? "border-green" : "border-line bg-cream",
            invalid && "border-orange-ink",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
