"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Calls an async API function whenever `key` changes. `initial` is shown on the first paint
 * (and while reloading) so server-rendered pages do not jump when data arrives.
 */
export function useApi<T>(key: string, fn: () => Promise<T>, initial?: T) {
  const [state, setState] = useState<{ key: string; data?: T; error?: Error }>({ key: "" });
  const [runs, setRuns] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let alive = true;
    fnRef.current().then(
      (data) => alive && setState({ key, data }),
      (error) => alive && setState({ key, error: error as Error }),
    );
    return () => {
      alive = false;
    };
  }, [key, runs]);

  const current = state.key === key;
  return {
    data: (state.data ?? initial) as T,
    loaded: current && !state.error,
    loading: !current,
    error: current ? state.error : undefined,
    /** Fetch again with the same key. */
    reload: () => setRuns((n) => n + 1),
  };
}
