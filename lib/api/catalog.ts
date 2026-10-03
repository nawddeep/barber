import { addDays, startOfDay } from "date-fns";
import {
  countAvailable, findNextFreeSlot, getAvailableSlots, priceFor, type Slot, type SlotData, type SlotGroups, type SlotQuery,
} from "../slots";
import type { Barber, Branch, Service } from "../types";
import { localIso, run, toSlotData } from "./core";

const withoutBooking = (data: SlotData, ref?: string): SlotData =>
  ref ? { ...data, bookings: data.bookings.filter((b) => b.ref !== ref) } : data;

export type ServiceWithPrice = Service & { priceInr: number };

/** Public dropdown hides paused branches; admin passes includePaused. */
export function listBranches(opts: { includePaused?: boolean } = {}): Promise<Branch[]> {
  return run("listBranches", { readOnly: true }, (db) =>
    db.branches.filter((b) => opts.includePaused || !b.paused),
  );
}

/** With a branchId: only services that branch offers, at the branch price. */
export function listServices(branchId?: string): Promise<ServiceWithPrice[]> {
  return run("listServices", { readOnly: true }, (db) => {
    if (!branchId) return db.services;
    const data = toSlotData(db);
    return db.services
      .filter((s) => db.branchServices.some((bs) => bs.branchId === branchId && bs.serviceId === s.id))
      .map((s) => ({ ...s, priceInr: priceFor(branchId, s.id, data) ?? s.priceInr }));
  });
}

export function listBarbers(branchId: string): Promise<Barber[]> {
  return run("listBarbers", { readOnly: true }, (db) => db.barbers.filter((b) => b.branchId === branchId && !b.retired));
}

/** `ignoreRef`: treat that booking as not on the calendar (used while rescheduling it). */
export function getSlots(query: SlotQuery & { ignoreRef?: string }): Promise<SlotGroups> {
  return run("getSlots", { readOnly: true }, (db, now) =>
    getAvailableSlots(query, withoutBooking(toSlotData(db), query.ignoreRef), now),
  );
}

/** Open-slot count for each of `days` days starting at `from` (yyyy-MM-dd). Feeds the day strip. */
export function getSlotCounts(
  query: Omit<SlotQuery, "date"> & { from: string; days: number; ignoreRef?: string },
): Promise<Array<{ date: string; count: number }>> {
  return run("getSlotCounts", { readOnly: true }, (db, now) => {
    const data = withoutBooking(toSlotData(db), query.ignoreRef);
    const start = startOfDay(new Date(`${query.from}T00:00:00`));
    return Array.from({ length: query.days }, (_, i) => {
      const date = localIso(addDays(start, i));
      return { date, count: countAvailable(getAvailableSlots({ ...query, date }, data, now)) };
    });
  });
}

export function getNextFreeSlot(query: { branchId: string; serviceId: string; barberId?: string }): Promise<Slot | null> {
  return run("getNextFreeSlot", { readOnly: true }, (db, now) =>
    findNextFreeSlot({ ...query, barberId: query.barberId ?? "any" }, toSlotData(db), now),
  );
}
