"use client";

import { useState } from "react";
import { Button, Label, Select } from "@/components/ui";
import { getNextFreeSlot, listBranches, listServices } from "@/lib/api";
import { FEATURED_SERVICE_ID } from "@/lib/featured";
import { bookingQuery, localDate } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BRANCHES, SEED_SERVICES } from "@/lib/mock/seed";

const OPEN_BRANCHES = SEED_BRANCHES.filter((b) => !b.paused);

/** Overlaps the bottom of the hero. Carries its choices into /book/slot via the query string. */
export function QuickBook() {
  const { data: branches } = useApi("qb-branches", () => listBranches(), OPEN_BRANCHES);
  const [branchPick, setBranchPick] = useState("");
  const branchId = branches.some((b) => b.id === branchPick) ? branchPick : branches[0]?.id ?? "";

  const { data: services } = useApi(`qb-services:${branchId}`, () => listServices(branchId), SEED_SERVICES);
  const [servicePick, setServicePick] = useState("");
  const serviceId = services.some((s) => s.id === servicePick)
    ? servicePick
    : services.find((s) => s.id === FEATURED_SERVICE_ID)?.id ?? services[0]?.id ?? "";

  const { data: next } = useApi(`qb-next:${branchId}:${serviceId}`, () => getNextFreeSlot({ branchId, serviceId }));
  const [datePick, setDatePick] = useState("");
  const date = datePick || (next ? localDate(new Date(next.startsAt)) : "");

  return (
    <form
      aria-label="Quick booking"
      className="grid gap-4 rounded-card bg-white p-5 shadow-[0_18px_40px_-20px_rgba(30,69,54,0.35)] md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <Label htmlFor="qb-branch" className="text-[11px]">Branch</Label>
        <Select id="qb-branch" value={branchId} onChange={(e) => setBranchPick(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="qb-service" className="text-[11px]">Service</Label>
        <Select id="qb-service" value={serviceId} onChange={(e) => setServicePick(e.target.value)}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="qb-date" className="text-[11px]">Date</Label>
        <input
          id="qb-date"
          type="date"
          value={date}
          onChange={(e) => setDatePick(e.target.value)}
          suppressHydrationWarning
          className="min-h-[52px] w-full rounded-input border-2 border-line bg-cream px-4 text-base font-medium text-ink focus:border-green focus:bg-white"
        />
      </div>
      <Button
        href={`/book/slot${bookingQuery({ branch: branchId, service: serviceId, date })}`}
        variant="accent"
        size="lg"
        className="min-h-12"
      >
        Find slots
      </Button>
    </form>
  );
}
