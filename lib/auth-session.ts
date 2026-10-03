"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AdminSession } from "./api/session";

// MOCK: a real app would use an HTTP-only session cookie. This one lives in localStorage.
const KEY = "barbr-admin-session";
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const raw = () => storage()?.getItem(KEY) ?? null;

export function getSession(): AdminSession | null {
  try {
    const r = raw();
    return r ? (JSON.parse(r) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: AdminSession) {
  storage()?.setItem(KEY, JSON.stringify(session));
  listeners.forEach((l) => l());
}

export function clearSession() {
  storage()?.removeItem(KEY);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb(); // other tabs
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current admin session. `ready` is false until the browser has read localStorage. */
export function useSession(): { session: AdminSession | null; ready: boolean } {
  const value = useSyncExternalStore(subscribe, raw, () => undefined);
  return useMemo(() => {
    if (value === undefined) return { session: null, ready: false };
    try {
      return { session: value ? (JSON.parse(value) as AdminSession) : null, ready: true };
    } catch {
      return { session: null, ready: true };
    }
  }, [value]);
}

/** Pages only OWNER may open. */
export const OWNER_ONLY = ["/admin/branches"];
export const canOpen = (role: AdminSession["role"], pathname: string) =>
  role === "OWNER" || !OWNER_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
