"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/lib/hooks/useNow";
import { cn } from "@/lib/cn";

export const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** "Slot held for 9:41". Calls onExpire once when it reaches zero. */
export function HoldTimer({ expiresAt, onExpire, className }: { expiresAt: string; onExpire: () => void; className?: string }) {
  const t = useNow(1000);
  const remaining = +new Date(expiresAt) - t;
  const expireRef = useRef(onExpire);
  const fired = useRef(false);
  useEffect(() => {
    expireRef.current = onExpire;
  });
  useEffect(() => {
    if (t > 0 && remaining <= 0 && !fired.current) {
      fired.current = true;
      expireRef.current();
    }
  }, [t, remaining]);

  const low = remaining < 60_000;
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", low ? "text-orange-ink" : "text-green-dark", className)}>
      <span>Slot held for</span>
      <span role="timer" aria-live="off" className="font-display text-lg tabular-nums">{formatCountdown(remaining)}</span>
      {low && <span className="sr-only" role="status">Less than a minute left on your hold</span>}
    </span>
  );
}
