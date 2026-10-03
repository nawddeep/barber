import { addMinutes } from "date-fns";
import type { Barber, Booking, Branch, Service } from "./types";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds long lines at 75 characters, as the iCalendar spec asks. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/** A real .ics file for "Add to calendar". Times are in UTC, so every calendar app shows the right local time. */
export function buildIcs(input: { booking: Booking; branch: Branch; service: Service; barber: Barber; now?: Date }) {
  const { booking, branch, service, barber } = input;
  const start = new Date(booking.startsAt);
  const end = addMinutes(start, service.durationMin);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barbr//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.ref}@barbr.demo`,
    `DTSTAMP:${stamp(input.now ?? new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${service.name} at Barbr ${branch.name}`)}`,
    `LOCATION:${esc(`Barbr ${branch.name}, ${branch.address}`)}`,
    `DESCRIPTION:${esc(`Booking ${booking.ref}. Barber: ${barber.name}. Arrive 5 minutes early.`)}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your Barbr booking is in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Saves text as a file in the browser. */
export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const directionsUrl = (branch: Branch) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Barbr ${branch.name}, ${branch.address}`)}`;
