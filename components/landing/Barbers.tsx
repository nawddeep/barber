"use client";

import { Avatar, StarIcon } from "@/components/ui";
import { listBarbers } from "@/lib/api";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BARBERS } from "@/lib/mock/seed";

const MAIN = SEED_BARBERS.filter((b) => b.branchId === "main-street");
const TINTS = ["bg-peach", "bg-periwinkle", "bg-sun", "bg-peach"];

export function useTeam() {
  return useApi("landing-barbers", () => listBarbers("main-street"), MAIN).data;
}

/** Desktop section. Phones get the "Find your barber" row in MobileHome. */
export function Barbers() {
  const team = useTeam();
  return (
    <section id="barbers" aria-labelledby="barbers-title" className="mx-auto hidden max-w-[1100px] scroll-mt-8 px-6 pb-24 lg:block">
      <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">Meet the team</p>
      <h2 id="barbers-title" className="mt-2 font-display text-5xl text-green">Choose your barber</h2>
      <ul className="mt-10 grid grid-cols-4 gap-5">
        {team.map((b, i) => (
          <li key={b.id} className={`flex flex-col items-center rounded-card px-4 pb-6 pt-8 text-center ${TINTS[i % TINTS.length]}`}>
            <Avatar name={b.name} size={104} ring="ring-white" decorative />
            <h3 className="mt-4 font-display text-2xl text-green">{b.name}</h3>
            <p className="mt-1 text-sm text-muted-strong">{b.specialty}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
              <StarIcon size={14} className="fill-ink text-ink" aria-hidden="true" />
              <span className="sr-only">Rated </span>
              {b.rating.toFixed(1)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
