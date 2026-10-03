"use client";

import { useState } from "react";
import { Button, Toggle, useToast } from "@/components/ui";
import { ApiError, listBranchSummaries, setBranchPaused, type BranchSummary } from "@/lib/api";
import { cn } from "@/lib/cn";
import { branchHours, inr } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { BranchDrawer } from "./BranchDrawer";
import { FeeRulesPanel } from "./FeeRulesPanel";

function BranchCard({ s, active, onToggle, onManage }: { s: BranchSummary; active: boolean; onToggle: (open: boolean) => void; onManage: () => void }) {
  const { branch } = s;
  const open = !branch.paused;
  return (
    <article aria-label={branch.name} data-active={active || undefined} className={cn("rounded-card p-6", active ? "on-dark bg-green text-white" : "bg-white text-ink")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-display text-3xl leading-tight", active ? "text-yellow" : "text-green")}>{branch.name}</h2>
          <p className={cn("mt-1 text-sm", active ? "text-white/85" : "text-muted-strong")}>
            {branchHours(branch)} · {s.barberCount} {s.barberCount === 1 ? "barber" : "barbers"}{open ? "" : " · paused"}
          </p>
        </div>
        <Toggle checked={open} onChange={onToggle} tone={active ? "onGreen" : "default"} label={`Bookings open at ${branch.name}`} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className={cn("rounded-2xl p-4", active ? "bg-white/10" : "bg-cream")}>
          <p className="font-display text-3xl leading-none" data-testid={`today-${branch.id}`}>{s.bookingsToday}</p>
          <p className={cn("mt-1 text-sm", active ? "text-white/85" : "text-muted-strong")}>Bookings today</p>
        </div>
        <div className={cn("rounded-2xl p-4", active ? "bg-white/10" : "bg-cream")}>
          <p className="font-display text-3xl leading-none" data-testid={`fees-${branch.id}`}>{inr(s.feesTodayInr)}</p>
          <p className={cn("mt-1 text-sm", active ? "text-white/85" : "text-muted-strong")}>Fees today</p>
        </div>
      </div>
      <Button variant={active ? "secondary" : "primary"} className="mt-5 w-full" size="lg" onClick={onManage} aria-label={`Manage ${branch.name}`}>
        Manage branch
      </Button>
    </article>
  );
}

export function BranchesPage() {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [activeId, setActiveId] = useState("");
  const [drawer, setDrawer] = useState<{ branchId: string | null } | null>(null);
  const q = useApi(`branch-sums:${version}`, () => listBranchSummaries());
  const sums = q.loaded ? q.data : undefined;
  const active = activeId || sums?.[0]?.branch.id || "";
  const reload = () => setVersion((v) => v + 1);

  const toggle = async (s: BranchSummary, open: boolean) => {
    try {
      await setBranchPaused({ branchId: s.branch.id, paused: !open });
      reload();
      toast.show({
        message: open ? `${s.branch.name} is open for bookings` : `${s.branch.name} paused. Customers can't book it, existing bookings stay`,
        actionLabel: "Undo",
        duration: 5000,
        onAction: async () => {
          // Back to how it was before this click.
          await setBranchPaused({ branchId: s.branch.id, paused: open });
          reload();
        },
      });
    } catch (e) {
      toast.show({ message: e instanceof ApiError ? e.message : "Could not change the branch." });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-green">Branches &amp; fees</h1>
          <p className="mt-1 text-muted-strong">Control where customers can book and what holds a slot</p>
        </div>
        <Button size="lg" onClick={() => setDrawer({ branchId: null })}>+ Add branch</Button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
        <section aria-label="Branches">
          {q.error ? (
            <div role="alert" className="rounded-3xl bg-status-cancelled p-6 text-center text-status-cancelled-ink">
              <p className="font-bold">Could not load the branches.</p>
              <Button className="mt-3" onClick={q.reload}>Try again</Button>
            </div>
          ) : !sums ? (
            <div role="status" aria-label="Loading branches" className="grid gap-5 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-card bg-cream-2" />)}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {sums.map((s) => (
                <BranchCard
                  key={s.branch.id}
                  s={s}
                  active={s.branch.id === active}
                  onToggle={(open) => void toggle(s, open)}
                  onManage={() => {
                    setActiveId(s.branch.id);
                    setDrawer({ branchId: s.branch.id });
                  }}
                />
              ))}
            </div>
          )}
        </section>
        <FeeRulesPanel />
      </div>

      {drawer && (
        <BranchDrawer
          key={drawer.branchId ?? "new"}
          branchId={drawer.branchId}
          onClose={() => setDrawer(null)}
          onSaved={(b, created) => {
            setDrawer(null);
            setActiveId(b.id);
            reload();
            toast.show({ message: created ? `${b.name} added` : `${b.name} saved` });
          }}
        />
      )}
    </div>
  );
}
