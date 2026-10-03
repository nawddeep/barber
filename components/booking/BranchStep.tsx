"use client";

import { useEffect } from "react";
import { Flower, Label, PinIcon, Select } from "@/components/ui";
import { listBranches, listServices } from "@/lib/api";
import { FEATURED_SERVICE_ID } from "@/lib/featured";
import { branchHours, relativeSlot } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { useBranchStatus } from "@/lib/hooks/useBranchStatus";
import { SEED_BRANCHES, SEED_SERVICES } from "@/lib/mock/seed";
import type { Branch } from "@/lib/types";
import { useWizardStore } from "@/lib/wizard/store";
import { NoticeBanner } from "./NoticeBanner";
import { ServiceGrid } from "./ServiceGrid";

const STATUS_TEXT = { open: "Open now", busy: "Busy today", closed: "Closed now", paused: "Paused" } as const;

function BranchInfo({ branch }: { branch: Branch }) {
  const status = useBranchStatus(branch);
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-green p-5 text-white" aria-live="polite">
      <Flower size={56} tint="bg-yellow">
        <PinIcon size={22} className="text-green-dark" />
      </Flower>
      <div>
        <p className="font-display text-2xl leading-tight">{branch.name}</p>
        <p className="text-sm text-white/85">
          {branchHours(branch)}{status.kind ? ` · ${STATUS_TEXT[status.kind]}` : ""}
        </p>
        <p className="min-h-5 text-sm font-bold text-yellow">
          {status.loaded ? (status.next ? `Next free slot: ${relativeSlot(status.next.startsAt)}` : "No free slots right now") : "\u00a0"}
        </p>
      </div>
    </div>
  );
}

export function BranchStep() {
  const branchId = useWizardStore((s) => s.branchId);
  const serviceId = useWizardStore((s) => s.serviceId);
  const setBranch = useWizardStore((s) => s.setBranch);
  const setService = useWizardStore((s) => s.setService);

  const branchesQ = useApi("s1-branches", () => listBranches(), SEED_BRANCHES.filter((b) => !b.paused));
  const branches = branchesQ.data;
  const servicesQ = useApi(`s1-services:${branchId ?? ""}`, () => listServices(branchId ?? undefined), SEED_SERVICES);

  // Default to the first branch, and fall back if the saved one is gone or paused.
  useEffect(() => {
    if (!branchesQ.loaded || !branches[0] || branches.some((b) => b.id === branchId)) return;
    if (branchId) useWizardStore.getState().setNotice("The branch you chose is not taking bookings right now, so we picked another one.");
    setBranch(branches[0].id);
  }, [branchesQ.loaded, branches, branchId, setBranch]);

  // Default to the featured service, and drop a service this branch does not offer.
  useEffect(() => {
    const list = servicesQ.data;
    if (!servicesQ.loaded || !branchId || list.length === 0 || list.some((s) => s.id === serviceId)) return;
    setService((list.find((s) => s.id === FEATURED_SERVICE_ID) ?? list[0]).id);
  }, [servicesQ.loaded, servicesQ.data, branchId, serviceId, setService]);

  const branch = branches.find((b) => b.id === branchId) ?? branches[0];

  if (!branch) {
    return <p className="rounded-card bg-white p-6 text-center font-display text-2xl text-green">No branches are taking bookings right now.</p>;
  }

  return (
    <div className="space-y-8">
      <NoticeBanner />
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">Step 1 of 4</p>
        <h1 className="mt-2 font-display text-5xl text-green">Where and what?</h1>
      </div>

      <section aria-label="Branch" className="grid gap-5 rounded-card bg-white p-5 md:grid-cols-[1fr_1fr] md:items-center">
        <div>
          <Label htmlFor="branch" className="text-[11px]">Choose a branch</Label>
          <Select id="branch" value={branch.id} onChange={(e) => setBranch(e.target.value)} className="border-green">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <p className="mt-3 text-sm text-muted">Barbers and slots change by branch, so pick this first.</p>
        </div>
        <BranchInfo branch={branch} />
      </section>

      <section aria-labelledby="svc-title">
        <h2 id="svc-title" className="mb-4 font-display text-3xl text-green">Choose a service</h2>
        <ServiceGrid services={servicesQ.data} selectedId={serviceId} onSelect={setService} />
      </section>
    </div>
  );
}
