import { addDays, addMinutes, format, parseISO, startOfDay, startOfWeek } from "date-fns";
import { isBlocking } from "./slots";
import type { Barber, BarberBreak, Booking, BookingStatus, Branch, HoldMethod, Payment, Service } from "./types";

export interface StatsData {
  branches: Branch[];
  services: Service[];
  barbers: Barber[];
  breaks: BarberBreak[];
  bookings: Booking[];
  payments: Payment[];
}

export interface UpNextRow {
  ref: string;
  startsAt: string;
  customerName: string;
  serviceName: string;
  barberName: string;
  branchName: string;
  status: BookingStatus;
  holdMethod: HoldMethod | "NONE";
}

export interface Stats {
  date: string;
  /** All bookings starting that day, whatever their status (matches the Bookings page "All" count). */
  todayBookings: number;
  sameWeekdayLastWeek: number;
  feesCollectedInr: number;
  feePaidCount: number;
  otpCount: number;
  slotsFilledPct: number;
  noShows: number;
  noShowsPaidFee: number;
  /** Monday to Sunday of the week containing `date`. */
  week: Array<{ date: string; label: string; count: number; kind: "past" | "today" | "future" }>;
  byBranch: Array<{ branchId: string; name: string; count: number }>;
  upNext: UpNextRow[];
  attention: {
    awaitingFee: number;
    refundRequests: number;
    gaps: Array<{ barberId: string; barberName: string; branchName: string; startsAt: string }>;
  };
}

const day = (b: Booking) => format(new Date(b.startsAt), "yyyy-MM-dd");

/** Everything on the dashboard, computed from bookings. Nothing here is hard-coded. */
export function computeStats(data: StatsData, dateStr: string, branchId: string | null, now: Date): Stats {
  const date = startOfDay(parseISO(dateStr));
  const inScope = (b: Booking) => !branchId || b.branchId === branchId;
  const scoped = data.bookings.filter(inScope);
  const onDay = (d: Date) => scoped.filter((b) => day(b) === format(d, "yyyy-MM-dd"));

  const todays = onDay(date);
  const paymentOf = (ref: string) => data.payments.find((p) => p.bookingRef === ref);

  const paid = todays.filter((b) => b.holdMethod === "FEE" && paymentOf(b.ref)?.status === "PAID");
  const feesCollectedInr = todays.reduce((sum, b) => {
    const p = paymentOf(b.ref);
    return p && (p.status === "PAID" || p.status === "REFUND_DUE") ? sum + p.amountInr : sum;
  }, 0);

  // Retired barbers keep their names on old bookings but no longer count towards capacity or gaps.
  const working = data.barbers.filter((b) => !b.retired);

  // Capacity: working minutes of every barber at non-paused branches, minus breaks.
  const branches = data.branches.filter((b) => !b.paused && (!branchId || b.id === branchId));
  let capacity = 0;
  for (const br of branches) {
    const hours = br.weekHours[date.getDay()];
    if (!hours) continue;
    for (const barber of working.filter((x) => x.branchId === br.id)) {
      const breakMin = data.breaks
        .filter((k) => k.barberId === barber.id)
        .reduce((s, k) => s + (k.endMin - k.startMin), 0);
      capacity += hours.close - hours.open - breakMin;
    }
  }
  const booked = todays
    .filter((b) => isBlocking(b, now) && branches.some((br) => br.id === b.branchId))
    .reduce((s, b) => s + (+new Date(b.endsAt) - +new Date(b.startsAt)) / 60000, 0);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const k = format(d, "yyyy-MM-dd");
    return {
      date: k,
      label: format(d, "EEE"),
      count: onDay(d).filter((b) => b.status !== "CANCELLED").length,
      kind: (k === dateStr ? "today" : k < dateStr ? "past" : "future") as "past" | "today" | "future",
    };
  });

  const upNext = todays
    .filter((b) => (b.status === "CONFIRMED" || b.status === "PENDING_FEE") && new Date(b.startsAt) >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 5)
    .map((b): UpNextRow => ({
      ref: b.ref,
      startsAt: b.startsAt,
      customerName: b.customer.name,
      serviceName: data.services.find((x) => x.id === b.serviceId)?.name ?? "",
      barberName: data.barbers.find((x) => x.id === b.barberId)?.name ?? "",
      branchName: data.branches.find((x) => x.id === b.branchId)?.name ?? "",
      status: b.status,
      holdMethod: b.holdMethod,
    }));

  // A gap = a barber with at least 2 free hours left today, starting at the next free half hour.
  const gaps: Stats["attention"]["gaps"] = [];
  for (const br of branches) {
    const hours = br.weekHours[date.getDay()];
    if (!hours) continue;
    for (const barber of working.filter((x) => x.branchId === br.id)) {
      const busy = [
        ...todays.filter((b) => b.barberId === barber.id && isBlocking(b, now)).map((b) => [+new Date(b.startsAt), +new Date(b.endsAt)]),
        ...data.breaks.filter((k) => k.barberId === barber.id).map((k) => [+addMinutes(date, k.startMin), +addMinutes(date, k.endMin)]),
      ];
      const from = Math.max(+addMinutes(date, hours.open), Math.ceil(+now / 1_800_000) * 1_800_000);
      const closeAt = +addMinutes(date, hours.close);
      for (let t = from; t + 7_200_000 <= closeAt; t += 1_800_000) {
        if (!busy.some(([s, e]) => t < e && s < t + 7_200_000)) {
          gaps.push({ barberId: barber.id, barberName: barber.name, branchName: br.name, startsAt: new Date(t).toISOString() });
          break;
        }
      }
    }
  }
  gaps.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return {
    date: dateStr,
    todayBookings: todays.length,
    sameWeekdayLastWeek: onDay(addDays(date, -7)).length,
    feesCollectedInr,
    feePaidCount: paid.length,
    otpCount: todays.filter((b) => b.holdMethod === "OTP").length,
    slotsFilledPct: capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
    noShows: todays.filter((b) => b.status === "NO_SHOW").length,
    noShowsPaidFee: todays.filter((b) => b.status === "NO_SHOW" && paymentOf(b.ref)?.status === "PAID").length,
    week,
    byBranch: data.branches
      .filter((b) => !branchId || b.id === branchId)
      .map((b) => ({ branchId: b.id, name: b.name, count: todays.filter((x) => x.branchId === b.id).length })),
    upNext,
    attention: {
      awaitingFee: scoped.filter((b) => b.status === "PENDING_FEE" && isBlocking(b, now)).length,
      refundRequests: scoped.filter((b) => paymentOf(b.ref)?.status === "REFUND_DUE").length,
      gaps: gaps.slice(0, 3),
    },
  };
}
