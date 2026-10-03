import { addDays, addMinutes, differenceInCalendarDays, getDay, parseISO, startOfDay } from "date-fns";
import type { Barber, BarberBreak, Booking, Branch, BranchService, Service, Settings } from "./types";

export const SLOT_MIN = 30;

export type SlotGroupName = "morning" | "afternoon" | "evening";

export interface Slot {
  startsAt: string;
  endsAt: string;
  group: SlotGroupName;
  available: boolean;
  /** Barber who would be assigned (null when the slot is taken). */
  barberId: string | null;
  /** Every barber free for this slot (useful for "any barber"). */
  freeBarberIds: string[];
}

export type SlotGroups = Record<SlotGroupName, Slot[]>;

/** Everything the pure slot logic needs. No store access, no clock access. */
export interface SlotData {
  branches: Branch[];
  services: Service[];
  branchServices: BranchService[];
  barbers: Barber[];
  breaks: BarberBreak[];
  bookings: Booking[];
  settings: Settings;
}

export interface SlotQuery {
  branchId: string;
  serviceId: string;
  /** yyyy-MM-dd, local date. */
  date: string;
  /** A barber id, or "any". */
  barberId: string;
}

/** A service occupies whole 30-minute slots. */
export function occupiedMinutes(durationMin: number) {
  return Math.ceil(durationMin / SLOT_MIN) * SLOT_MIN;
}

/** Does this booking currently hold its barber's time? */
export function isBlocking(b: Booking, now: Date) {
  if (b.status === "CONFIRMED" || b.status === "IN_SERVICE" || b.status === "COMPLETED") return true;
  if (b.status === "PENDING_FEE") return !!b.holdExpiresAt && new Date(b.holdExpiresAt) > now;
  return false;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function findConflict(
  barberId: string,
  start: Date,
  end: Date,
  data: Pick<SlotData, "breaks" | "bookings">,
  now: Date,
): "break" | "booking" | null {
  const day = startOfDay(start);
  for (const br of data.breaks) {
    if (br.barberId !== barberId) continue;
    if (overlaps(+start, +end, +addMinutes(day, br.startMin), +addMinutes(day, br.endMin))) return "break";
  }
  for (const b of data.bookings) {
    if (b.barberId !== barberId || !isBlocking(b, now)) continue;
    if (overlaps(+start, +end, +new Date(b.startsAt), +new Date(b.endsAt))) return "booking";
  }
  return null;
}

export function priceFor(branchId: string, serviceId: string, data: Pick<SlotData, "services" | "branchServices">) {
  const service = data.services.find((s) => s.id === serviceId);
  if (!service) return null;
  const link = data.branchServices.find((bs) => bs.branchId === branchId && bs.serviceId === serviceId);
  return link?.priceOverrideInr ?? service.priceInr;
}

function groupOf(start: Date): SlotGroupName {
  const h = start.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const empty = (): SlotGroups => ({ morning: [], afternoon: [], evening: [] });

/**
 * 30-minute start times for one day, grouped Morning (<12), Afternoon (12 to 5) and Evening (after 5).
 * Past times are left out. Slots that are taken stay in the list with available: false.
 */
export function getAvailableSlots(query: SlotQuery, data: SlotData, now: Date): SlotGroups {
  const groups = empty();
  const day = startOfDay(parseISO(query.date));
  if (Number.isNaN(+day)) return groups;

  const offset = differenceInCalendarDays(day, startOfDay(now));
  if (offset < 0 || offset > data.settings.advanceBookingDays) return groups;

  const branch = data.branches.find((b) => b.id === query.branchId);
  if (!branch || branch.paused) return groups;
  const hours = branch.weekHours[getDay(day)];
  if (!hours) return groups;

  const service = data.services.find((s) => s.id === query.serviceId);
  const offered = data.branchServices.some((bs) => bs.branchId === branch.id && bs.serviceId === query.serviceId);
  if (!service || !offered) return groups;

  let barbers = data.barbers.filter((b) => b.branchId === branch.id);
  if (query.barberId !== "any") barbers = barbers.filter((b) => b.id === query.barberId);
  if (barbers.length === 0) return groups;

  const occupied = occupiedMinutes(service.durationMin);

  // How many blocking bookings each barber already has today, to spread "any barber" assignments.
  const load = new Map<string, number>();
  for (const b of data.bookings) {
    if (isBlocking(b, now) && +startOfDay(new Date(b.startsAt)) === +day) {
      load.set(b.barberId, (load.get(b.barberId) ?? 0) + 1);
    }
  }

  for (let m = hours.open; m + occupied <= hours.close; m += SLOT_MIN) {
    const start = addMinutes(day, m);
    if (start <= now) continue;
    const end = addMinutes(start, occupied);
    const free = barbers.filter((b) => !findConflict(b.id, start, end, data, now));
    const assigned = [...free].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))[0];
    groups[groupOf(start)].push({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      group: groupOf(start),
      available: free.length > 0,
      barberId: assigned?.id ?? null,
      freeBarberIds: free.map((b) => b.id),
    });
  }
  return groups;
}

export function allSlots(groups: SlotGroups): Slot[] {
  return [...groups.morning, ...groups.afternoon, ...groups.evening];
}

export function countAvailable(groups: SlotGroups) {
  return allSlots(groups).filter((s) => s.available).length;
}

/** Earliest available slot in the next `days` days, or null. */
export function findNextFreeSlot(
  query: Omit<SlotQuery, "date">,
  data: SlotData,
  now: Date,
  days = data.settings.advanceBookingDays,
): Slot | null {
  for (let i = 0; i <= days; i++) {
    const date = addDays(startOfDay(now), i);
    const y = date.getFullYear();
    const iso = `${y}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const first = allSlots(getAvailableSlots({ ...query, date: iso }, data, now)).find((s) => s.available);
    if (first) return first;
  }
  return null;
}
