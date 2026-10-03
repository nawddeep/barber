"use client";

import { useEffect, useState } from "react";
import { now } from "@/lib/clock";

/** Current time in ms, refreshed every `intervalMs`. Starts at 0 on the server so output stays stable. */
export function useNow(intervalMs = 1000) {
  const [t, setT] = useState(() => (typeof window === "undefined" ? 0 : +now()));
  useEffect(() => {
    const id = setInterval(() => setT(+now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}
