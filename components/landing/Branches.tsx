"use client";

import { Button, Chip, PinIcon } from "@/components/ui";
import { listBranches } from "@/lib/api";
import { bookingQuery, branchHours, openDays, time12 } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BRANCHES } from "@/lib/mock/seed";
import { cn } from "@/lib/cn";
import type { Branch } from "@/lib/types";
import { useBranchStatus } from "@/lib/hooks/useBranchStatus";

function BranchCard({ branch, featured }: { branch: Branch; featured: boolean }) {
  const { kind, next, loaded } = useBranchStatus(branch);
  const chip =
    kind === "paused" ? { label: "Paused", tone: "neutral" as const }
    : kind === "closed" ? { label: "Closed now", tone: "neutral" as const }
    : kind === "busy" ? { label: "Busy today", tone: "orange" as const }
    : kind === "open" ? { label: "Open now", tone: "green" as const }
    : null;

  return (
    <article className={cn("flex flex-col rounded-card p-5", featured ? "bg-green text-white" : "bg-white text-ink")}>
      <div className="flex items-center justify-between">
        <PinIcon size={22} className={featured ? "text-yellow" : "text-green"} />
        <span className="min-h-7">{chip && <Chip tone={featured ? "yellow" : chip.tone}>{chip.label}</Chip>}</span>
      </div>
      <h3 className={cn("mt-3 font-display text-3xl", featured ? "text-white" : "text-green")}>{branch.name}</h3>
      <p className={cn("mt-2 text-sm", featured ? "text-white/80" : "text-muted")}>
        {branchHours(branch)} · {openDays(branch)}
      </p>
      <p className={cn("min-h-5 text-sm", featured ? "text-white/80" : "text-muted")}>
        {branch.paused ? "Not taking bookings right now" : loaded ? (next ? `Next slot ${time12(next.startsAt)}` : "No slots left") : " "}
      </p>
      <div className="mt-5">
        {branch.paused ? (
          <Button disabled className="w-full" variant="primary">Book here</Button>
        ) : (
          <Button href={`/book/branch${bookingQuery({ branch: branch.id })}`} variant={featured ? "secondary" : "primary"} className="w-full">
            Book here
          </Button>
        )}
      </div>
    </article>
  );
}

export function Branches() {
  const { data: branches } = useApi("landing-branches", () => listBranches({ includePaused: true }), SEED_BRANCHES);
  return (
    <section id="branches" aria-labelledby="branches-title" className="mx-auto max-w-[1100px] scroll-mt-8 px-6 py-20 lg:py-24">
      <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">Our branches</p>
      <h2 id="branches-title" className="mt-2 font-display text-4xl text-green lg:text-5xl">Find your branch</h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {branches.map((b, i) => (
          <BranchCard key={b.id} branch={b} featured={i === 0} />
        ))}
      </div>
    </section>
  );
}
