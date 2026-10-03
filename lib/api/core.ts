import { now as clockNow } from "../clock";
import { loadDb, saveDb, type Db } from "../mock/db";
import { getDevConfig } from "../mock/dev";
import type { SlotData } from "../slots";

export type ApiErrorCode =
  | "SIMULATED_ERROR"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "BRANCH_PAUSED"
  | "SLOT_UNAVAILABLE"
  | "HOLD_EXPIRED"
  | "METHOD_NOT_ALLOWED"
  | "FEE_REQUIRED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REQUIRED"
  | "OTP_INVALID"
  | "OTP_LOCKED"
  | "OTP_REQUIRED"
  | "INVALID_STATE"
  | "UNAUTHORIZED";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** MOCK: fake network latency of 300 to 600 ms. */
async function pause() {
  if (!getDevConfig().delay) return;
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
}

interface RunOptions {
  /** True for calls that "dev error mode: payment" should break. */
  payment?: boolean;
  /** Read-only calls skip the write-back. */
  readOnly?: boolean;
  /** Keep changes made before a thrown error (e.g. wrong-OTP counters). */
  saveOnError?: boolean;
}

/**
 * Every API function goes through here: fake delay, optional forced failure, then run against the
 * mock database and save it. Throwing inside `fn` discards its changes unless `saveOnError` is set.
 * MOCK: a real backend replaces this whole wrapper with HTTP calls.
 */
export async function run<T>(op: string, opts: RunOptions, fn: (db: Db, now: Date) => T): Promise<T> {
  await pause();
  const mode = getDevConfig().errorMode;
  if (mode === "all" || (mode === "payment" && opts.payment)) {
    throw new ApiError(opts.payment ? "PAYMENT_FAILED" : "SIMULATED_ERROR", `Simulated failure in ${op}`);
  }
  const now = clockNow();
  const db = loadDb(now);
  let result: T;
  try {
    result = fn(db, now);
  } catch (e) {
    if (opts.saveOnError) saveDb(db);
    throw e;
  }
  if (!opts.readOnly) saveDb(db);
  return structuredClone(result);
}

export const toSlotData = (db: Db): SlotData => ({
  branches: db.branches,
  services: db.services,
  branchServices: db.branchServices,
  barbers: db.barbers.filter((b) => !b.retired),
  breaks: db.breaks,
  bookings: db.bookings,
  settings: db.settings,
});

export const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
