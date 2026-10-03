// MOCK: developer switches for the fake backend. Stored in localStorage so they survive reloads.
export interface DevConfig {
  /** Fake 300 to 600 ms network delay. */
  delay: boolean;
  /** "payment" fails only simulatePayment; "all" fails every API call. */
  errorMode: "off" | "payment" | "all";
}

const KEY = "barbr-dev";
const DEFAULTS: DevConfig = { delay: true, errorMode: "off" };

function hasStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getDevConfig(): DevConfig {
  if (!hasStorage()) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function setDevConfig(patch: Partial<DevConfig>) {
  if (!hasStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify({ ...getDevConfig(), ...patch }));
}
