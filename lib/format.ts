import { format, isToday, isTomorrow } from "date-fns";
import type { Branch } from "./types";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** 600 -> "10 AM", 1290 -> "9:30 PM" */
export function formatMinutes(min: number) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "10 AM – 9 PM" for the branch's opening hours (first open weekday). */
export function branchHours(branch: Branch) {
  const h = branch.weekHours.find(Boolean);
  return h ? `${formatMinutes(h.open)} – ${formatMinutes(h.close)}` : "Closed";
}

/** "Mon to Sun", or "Mon to Sat" and so on, from which weekdays are open. */
export function openDays(branch: Branch) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const open = [1, 2, 3, 4, 5, 6, 0].filter((d) => branch.weekHours[d]);
  if (open.length === 7) return "Mon to Sun";
  return open.map((d) => names[d]).join(", ");
}

export const time12 = (iso: string) => format(new Date(iso), "h:mm a");

/** "Today, 2:30 PM" / "Tomorrow, 10:00 AM" / "Sat, 3 Oct, 2:30 PM" */
export function relativeSlot(iso: string) {
  const d = new Date(iso);
  const day = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, d MMM");
  return `${day}, ${format(d, "h:mm a")}`;
}

export const localDate = (d: Date) => format(d, "yyyy-MM-dd");

/** Query string that carries a quick-book choice into the booking flow. */
export function bookingQuery(params: { branch?: string; service?: string; date?: string }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** "+91 98••• ••210" */
export const maskPhone = (phone: string) => `+91 ${phone.slice(0, 2)}••• ••${phone.slice(-3)}`;

/** "+91 98•• ••112": enough to recognise a customer without showing the whole number. */
export const maskPhoneShort = (phone: string) => `+91 ${phone.slice(0, 2)}•• ••${phone.slice(-3)}`;

/** "+91 98765 43210" */
export const formatPhone = (phone: string) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
