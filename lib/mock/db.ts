// MOCK: this whole file stands in for a database. A real backend replaces it.
import { format } from "date-fns";
import { now as clockNow } from "../clock";
import { DEFAULT_SETTINGS } from "../default-settings";
import type { Barber, BarberBreak, Booking, Branch, BranchService, Payment, Service, Settings } from "../types";
import { buildSeed } from "./seed";

export interface OtpState {
  wrong: number;
  lockedUntil: number | null;
  verifiedUntil: number | null;
}

export interface Db {
  /** yyyy-MM-dd the seed was generated for. A new day triggers a fresh seed. */
  seededOn: string;
  settings: Settings;
  branches: Branch[];
  services: Service[];
  branchServices: BranchService[];
  barbers: Barber[];
  breaks: BarberBreak[];
  bookings: Booking[];
  payments: Payment[];
  /** Refs of unpaid holds that timed out, so we can say "hold expired" instead of "not found". */
  expiredRefs: string[];
  otp: Record<string, OtpState>;
  counters: { nextRef: number; nextPayment: number };
}

const KEY = "barbr-demo-v1";
let memory: string | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readRaw() {
  const s = storage();
  return s ? s.getItem(KEY) : memory;
}

function writeRaw(raw: string) {
  const s = storage();
  if (s) s.setItem(KEY, raw);
  else memory = raw;
}

/** Drop unpaid holds whose time ran out. Returns true if anything changed. */
export function expireHolds(db: Db, now: Date) {
  const keep: Booking[] = [];
  let changed = false;
  for (const b of db.bookings) {
    if (b.status === "PENDING_FEE" && b.holdExpiresAt && new Date(b.holdExpiresAt) <= now) {
      db.expiredRefs.push(b.ref);
      changed = true;
    } else keep.push(b);
  }
  db.bookings = keep;
  return changed;
}

export function loadDb(now: Date = clockNow()): Db {
  const raw = readRaw();
  const today = format(now, "yyyy-MM-dd");
  let db: Db | null = null;
  if (raw) {
    try {
      db = JSON.parse(raw) as Db;
    } catch {
      db = null;
    }
  }
  if (!db || db.seededOn !== today) {
    db = buildSeed(now, DEFAULT_SETTINGS);
    writeRaw(JSON.stringify(db));
  }
  if (expireHolds(db, now)) writeRaw(JSON.stringify(db));
  return db;
}

export function saveDb(db: Db) {
  writeRaw(JSON.stringify(db));
}

/** "Reset demo data" button in the admin footer. */
export function resetDemoData(now: Date = clockNow()) {
  saveDb(buildSeed(now, DEFAULT_SETTINGS));
}
