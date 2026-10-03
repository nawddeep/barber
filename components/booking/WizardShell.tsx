"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo, Stepper } from "@/components/ui";
import { listBranches, listServices } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useWizardStore } from "@/lib/wizard/store";
import { MobileBar, SummaryCard } from "./Summary";

const stepOf = (pathname: string) => (pathname.endsWith("/slot") ? 2 : pathname.endsWith("/details") ? 3 : 1);

/**
 * Applies ?branch=&service=&date= from links (landing page, shared URLs) to the wizard store,
 * then sends people back to the first step they are missing choices for.
 */
function useWizardBoot() {
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = useRef(params.toString());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    (async () => {
      const q = new URLSearchParams(initial.current);
      const store = useWizardStore.getState();
      const wantBranch = q.get("branch");
      const wantService = q.get("service");
      const wantDate = q.get("date");

      // If the data layer is down while applying a link's choices, carry on with what we have.
      if (wantBranch || wantService || wantDate) try {
        const all = await listBranches({ includePaused: true });
        const branches = all.filter((b) => !b.paused);
        const paused = all.find((b) => b.id === wantBranch && b.paused);
        if (paused) store.setNotice(`${paused.name} is not taking bookings right now. Please pick another branch.`);
        const branchId = branches.some((b) => b.id === wantBranch) ? wantBranch! : store.branchId ?? branches[0]?.id;
        if (branchId) {
          store.setBranch(branchId);
          if (wantService) {
            const services = await listServices(branchId);
            if (services.some((s) => s.id === wantService)) useWizardStore.getState().setService(wantService);
          }
        }
        if (wantDate && /^\d{4}-\d{2}-\d{2}$/.test(wantDate)) useWizardStore.getState().setDate(wantDate);
      } catch {
        // Fall through to the guards below.
      }

      const s = useWizardStore.getState();
      const step = stepOf(pathname);
      if (step >= 2 && !(s.branchId && s.serviceId)) router.replace("/book/branch");
      else if (step >= 3 && !s.startsAt) router.replace("/book/slot");
      else if (q.size > 0) window.history.replaceState(null, "", step === 2 && s.date ? `${pathname}?date=${s.date}` : pathname);
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
    // Runs once per visit: the initial query string is captured in a ref.
  }, [hydrated, pathname, router]);

  return ready;
}

export function WizardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const step = stepOf(pathname);
  const ready = useWizardBoot();

  return (
    <div className="min-h-screen bg-cream">
      <header className={cn("border-b border-line bg-white", step >= 2 && "max-lg:hidden")}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo href="/" className="text-3xl" />
          <Stepper current={step} />
          <a href="tel:+918000010001" className="hidden min-h-11 items-center text-sm font-bold text-green lg:inline-flex">
            Need help? Call us
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] gap-8 px-4 pb-36 pt-6 data-[step='3']:max-lg:pt-4 sm:px-6 lg:grid lg:grid-cols-[1fr_360px] lg:pb-16 lg:pt-10 max-lg:data-[step='2']:px-0 max-lg:data-[step='2']:pt-0" data-step={step}>
        <main id="main" className="min-w-0">
          {ready ? children : <div className="h-96 animate-pulse rounded-card bg-cream-2" role="status" aria-label="Loading your booking" />}
        </main>
        {ready && (
          <aside className="hidden lg:block">
            <SummaryCard step={step} />
          </aside>
        )}
      </div>
      {ready && <MobileBar step={step} />}
    </div>
  );
}

export function BackToServices({ className }: { className?: string }) {
  return (
    <Link href="/book/branch" className={cn("inline-flex min-h-11 items-center border-b-2 border-green font-bold text-green", className)}>
      Change branch or service
    </Link>
  );
}
