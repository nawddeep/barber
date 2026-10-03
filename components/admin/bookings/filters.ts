import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import type { BookingStatus } from "@/lib/types";

export type RangeKey = "today" | "week" | "month" | "custom";
export type TabKey = "ALL" | "CONFIRMED" | "PENDING_FEE" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface Filters {
  q: string;
  branch: string;
  range: RangeKey;
  from: string;
  to: string;
  tab: TabKey;
  sort: "asc" | "desc";
  page: number;
  /** The booking open in the detail panel. */
  ref: string;
}

export const PAGE_SIZE = 25;
export const DEFAULTS: Filters = { q: "", branch: "", range: "today", from: "", to: "", tab: "ALL", sort: "asc", page: 1, ref: "" };

const RANGES: RangeKey[] = ["today", "week", "month", "custom"];
const TABS: TabKey[] = ["ALL", "CONFIRMED", "PENDING_FEE", "COMPLETED", "CANCELLED", "NO_SHOW"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads filters from the URL. Anything unknown or malformed falls back to the default. */
export function parseFilters(sp: URLSearchParams): Filters {
  const range = sp.get("range") as RangeKey;
  const tab = sp.get("status") as TabKey;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  return {
    q: sp.get("q")?.slice(0, 80) ?? "",
    branch: sp.get("branch") ?? "",
    range: RANGES.includes(range) ? range : DEFAULTS.range,
    from: DATE.test(sp.get("from") ?? "") ? sp.get("from")! : "",
    to: DATE.test(sp.get("to") ?? "") ? sp.get("to")! : "",
    tab: TABS.includes(tab) ? tab : DEFAULTS.tab,
    sort: sp.get("sort") === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    ref: sp.get("ref") ?? "",
  };
}

/** Builds the query string for a view. Defaults are left out so URLs stay short. */
export function serializeFilters(f: Filters, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  if (f.branch) q.set("branch", f.branch);
  if (f.range !== DEFAULTS.range) q.set("range", f.range);
  if (f.range === "custom") {
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
  }
  if (f.tab !== DEFAULTS.tab) q.set("status", f.tab);
  if (f.sort !== DEFAULTS.sort) q.set("sort", f.sort);
  if (f.page > 1) q.set("page", String(f.page));
  if (f.ref) q.set("ref", f.ref);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The first and last day (yyyy-MM-dd) a range covers. Weeks run Monday to Sunday. */
export function rangeDates(f: Pick<Filters, "range" | "from" | "to">, today: Date): { from?: string; to?: string } {
  const d = (x: Date) => format(x, "yyyy-MM-dd");
  if (f.range === "today") return { from: d(today), to: d(today) };
  if (f.range === "week") return { from: d(startOfWeek(today, { weekStartsOn: 1 })), to: d(endOfWeek(today, { weekStartsOn: 1 })) };
  if (f.range === "month") return { from: d(startOfMonth(today)), to: d(endOfMonth(today)) };
  return { from: f.from || undefined, to: f.to || undefined };
}

/** The "Confirmed" tab also shows bookings that are in the chair right now. */
export function tabStatuses(tab: TabKey): BookingStatus[] | undefined {
  if (tab === "ALL") return undefined;
  if (tab === "CONFIRMED") return ["CONFIRMED", "IN_SERVICE"];
  return [tab];
}

export const RANGE_LABEL: Record<RangeKey, string> = { today: "today", week: "this week", month: "this month", custom: "in this range" };
