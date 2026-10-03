"use client";

import { getDay } from "date-fns";
import { getNextFreeSlot, getSlotCounts } from "@/lib/api";
import { now } from "@/lib/clock";
import { FEATURED_SERVICE_ID } from "@/lib/featured";
import { localDate } from "@/lib/format";
import type { Slot } from "@/lib/slots";
import type { Branch } from "@/lib/types";
import { useApi } from "./useApi";

const BUSY_BELOW = 6; // fewer free slots than this today = "Busy today"

export type BranchStatusKind = "paused" | "closed" | "busy" | "open";

/** Open / busy / closed / paused, plus the next free slot, for a branch. Everything comes from the mock API. */
export function useBranchStatus(branch: Branch): { kind: BranchStatusKind | undefined; next: Slot | null; loaded: boolean } {
  const { data, loaded } = useApi(`branch-status:${branch.id}:${branch.paused}`, async () => {
    if (branch.paused) return { kind: "paused" as BranchStatusKind, next: null as Slot | null };
    const q = { branchId: branch.id, serviceId: FEATURED_SERVICE_ID, barberId: "any" };
    const [counts, next] = await Promise.all([
      getSlotCounts({ ...q, from: localDate(now()), days: 1 }),
      getNextFreeSlot(q),
    ]);
    const t = now();
    const hours = branch.weekHours[getDay(t)];
    const minutes = t.getHours() * 60 + t.getMinutes();
    const isOpen = !!hours && minutes >= hours.open && minutes < hours.close;
    const kind: BranchStatusKind = !isOpen ? "closed" : (counts[0]?.count ?? 0) < BUSY_BELOW ? "busy" : "open";
    return { kind, next };
  });
  if (branch.paused) return { kind: "paused", next: null, loaded: true };
  return { kind: loaded ? data?.kind : undefined, next: data?.next ?? null, loaded };
}
