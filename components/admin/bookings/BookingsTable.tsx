"use client";

import { format } from "date-fns";
import { StatusChip } from "@/components/ui";
import type { BookingRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { maskPhoneShort, time12 } from "@/lib/format";

type Props = {
  rows: BookingRow[];
  selectedRef: string;
  onSelect: (ref: string) => void;
  sort: "asc" | "desc";
  onSort: () => void;
  /** Show the date under the time (hidden when every row is today). */
  showDate: boolean;
};

const when = (r: BookingRow, showDate: boolean) => (
  <>
    <span className="block font-bold text-ink">{time12(r.startsAt)}</span>
    {showDate && <span className="block text-xs text-muted-strong">{format(new Date(r.startsAt), "EEE, d MMM")}</span>}
  </>
);

export function BookingsTable({ rows, selectedRef, onSelect, sort, onSort, showDate }: Props) {
  return (
    <>
      {/* Desktop: a real table. Each customer name is a button, so rows work with a keyboard. */}
      <table className="hidden w-full border-separate border-spacing-y-1 text-left lg:table">
        <caption className="sr-only">Bookings</caption>
        <thead>
          <tr className="text-xs font-bold uppercase tracking-wider text-muted-strong">
            <th scope="col" className="px-3 pb-2">Customer</th>
            <th scope="col" className="px-3 pb-2">Service · Barber</th>
            <th scope="col" className="px-3 pb-2">Branch</th>
            <th scope="col" className="px-3 pb-2" aria-sort={sort === "asc" ? "ascending" : "descending"}>
              <button type="button" onClick={onSort} className="inline-flex min-h-11 items-center gap-1 font-bold uppercase tracking-wider" aria-label={`When, sorted ${sort === "asc" ? "earliest first" : "latest first"}. Change order`}>
                When <span aria-hidden="true">{sort === "asc" ? "↑" : "↓"}</span>
              </button>
            </th>
            <th scope="col" className="px-3 pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const on = r.ref === selectedRef;
            const cell = cn("px-3 py-3 align-middle", on ? "bg-butter" : "group-hover:bg-cream-2/60");
            return (
              <tr key={r.ref} onClick={() => onSelect(r.ref)} className="group cursor-pointer" data-selected={on || undefined}>
                <td className={cn(cell, "rounded-l-2xl")}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(r.ref); }} aria-pressed={on} className="min-h-11 text-left">
                    <span className="block font-bold text-ink">{r.customer.name}</span>
                    <span className="block text-sm text-muted-strong">{maskPhoneShort(r.customer.phone)}</span>
                  </button>
                </td>
                <td className={cell}>
                  <span className="block text-ink">{r.serviceName}</span>
                  <span className="block text-sm text-muted-strong">{r.barberName}</span>
                </td>
                <td className={cn(cell, "text-ink")}>{r.branchName}</td>
                <td className={cell}>{when(r, showDate)}</td>
                <td className={cn(cell, "rounded-r-2xl")}><StatusChip status={r.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Phones and tablets: cards. */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((r) => (
          <li key={r.ref}>
            <button
              type="button"
              onClick={() => onSelect(r.ref)}
              aria-pressed={r.ref === selectedRef}
              className={cn("w-full rounded-3xl p-4 text-left", r.ref === selectedRef ? "bg-butter" : "bg-white")}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-bold text-ink">{r.customer.name}</span>
                  <span className="block text-sm text-muted-strong">{maskPhoneShort(r.customer.phone)}</span>
                </span>
                <StatusChip status={r.status} />
              </span>
              <span className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <span>
                  <span className="block text-ink">{r.serviceName}</span>
                  <span className="block text-muted-strong">{r.barberName}</span>
                </span>
                <span className="text-right">
                  <span className="block text-ink">{r.branchName}</span>
                  <span className="block">{when(r, showDate)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
