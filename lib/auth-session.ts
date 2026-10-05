"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AdminSession } from "./api/session";
import { supabase } from "@/src/supabaseClient";

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
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current admin session. `ready` is false until Supabase Auth session has been checked. */
export function useSession(): { session: AdminSession | null; ready: boolean } {
  const localValue = useSyncExternalStore(subscribe, raw, () => undefined);
  const [supabaseReady, setSupabaseReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSupabaseSession() {
      try {
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sbSession) {
          const user = sbSession.user;
          const role =
            (user.user_metadata?.role as "OWNER" | "STAFF") ||
            (user.email?.includes("staff") ? "STAFF" : "OWNER");
          const name =
            user.user_metadata?.name ||
            (role === "OWNER" ? "Salon owner" : "Front desk");
          setSession({
            email: user.email ?? "",
            name,
            role,
          });
        } else {
          clearSession();
        }
      } catch {
        // Fallback to local
      } finally {
        if (mounted) setSupabaseReady(true);
      }
    }

    checkSupabaseSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (!sbSession) {
        clearSession();
      } else {
        const user = sbSession.user;
        const role =
          (user.user_metadata?.role as "OWNER" | "STAFF") ||
          (user.email?.includes("staff") ? "STAFF" : "OWNER");
        const name =
          user.user_metadata?.name ||
          (role === "OWNER" ? "Salon owner" : "Front desk");
        setSession({
          email: user.email ?? "",
          name,
          role,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => {
    if (localValue === undefined && !supabaseReady) return { session: null, ready: false };
    try {
      const parsed = localValue ? (JSON.parse(localValue) as AdminSession) : null;
      return { session: parsed, ready: supabaseReady };
    } catch {
      return { session: null, ready: supabaseReady };
    }
  }, [localValue, supabaseReady]);
}

/** Pages only OWNER may open. */
export const OWNER_ONLY = ["/admin/branches"];
export const canOpen = (role: AdminSession["role"], pathname: string) =>
  role === "OWNER" || !OWNER_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
