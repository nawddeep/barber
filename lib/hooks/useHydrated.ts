"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False on the server and during hydration, true afterwards. Use before reading browser-only state. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
