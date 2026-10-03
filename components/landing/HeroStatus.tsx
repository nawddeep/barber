"use client";

import { getNextFreeSlot, listBranches } from "@/lib/api";
import { FEATURED_SERVICE_ID } from "@/lib/featured";
import { branchHours, relativeSlot } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BRANCHES } from "@/lib/mock/seed";
import { Chip } from "@/components/ui";

/** "4 branches · open 10 AM – 9 PM" */
export function BranchesPill() {
  const { data: branches } = useApi("hero-branches", () => listBranches({ includePaused: true }), SEED_BRANCHES);
  const active = branches.filter((b) => !b.paused);
  const hours = active[0] ? branchHours(active[0]) : "";
  return (
    <Chip tone="onGreen" className="min-h-9 px-4 text-sm font-medium">
      <span className="h-2 w-2 rounded-full bg-yellow" aria-hidden="true" />
      {branches.length} branches · open {hours}
    </Chip>
  );
}

/** Earliest free Hot Towel Shave slot across all open branches. */
export function NextFreeSlotChip({ className }: { className?: string }) {
  const { data } = useApi("hero-next-slot", async () => {
    const branches = await listBranches();
    const slots = await Promise.all(
      branches.map((b) => getNextFreeSlot({ branchId: b.id, serviceId: FEATURED_SERVICE_ID })),
    );
    return slots.filter((s) => s !== null).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  });
  return (
    <div className={className} aria-live="polite">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Next free slot</p>
      <p className="min-h-7 font-display text-xl text-ink">{data === undefined ? "…" : data ? relativeSlot(data.startsAt) : "Fully booked"}</p>
    </div>
  );
}
