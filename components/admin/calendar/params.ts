import { addDays, format, parseISO } from "date-fns";

export type View = "day" | "week";

export interface CalParams {
  branch: string;
  view: View;
  /** yyyy-MM-dd. Empty means today. */
  date: string;
  /** The barber shown in week view. Empty means the first. */
  barber: string;
  /** The booking open in the detail panel. */
  ref: string;
}

export const CAL_DEFAULTS: CalParams = { branch: "", view: "day", date: "", barber: "", ref: "" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCalParams(sp: URLSearchParams): CalParams {
  const date = sp.get("date") ?? "";
  return {
    branch: sp.get("branch") ?? "",
    view: sp.get("view") === "week" ? "week" : "day",
    date: DATE.test(date) && !Number.isNaN(+parseISO(date)) ? date : "",
    barber: sp.get("barber") ?? "",
    ref: sp.get("ref") ?? "",
  };
}

export function serializeCalParams(p: CalParams, today: string) {
  const q = new URLSearchParams();
  if (p.branch) q.set("branch", p.branch);
  if (p.view !== "day") q.set("view", p.view);
  if (p.date && p.date !== today) q.set("date", p.date);
  if (p.view === "week" && p.barber) q.set("barber", p.barber);
  if (p.ref) q.set("ref", p.ref);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Previous or next day (or week) from a yyyy-MM-dd date. */
export const shiftDate = (date: string, view: View, dir: 1 | -1) => format(addDays(parseISO(date), (view === "week" ? 7 : 1) * dir), "yyyy-MM-dd");
