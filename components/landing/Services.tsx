"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Flower, ScissorsIcon, UserIcon } from "@/components/ui";
import { listServices } from "@/lib/api";
import { inr } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SHAVE_PHOTO } from "@/lib/images";
import { SEED_SERVICES } from "@/lib/mock/seed";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

const href = (s: Service) => `/book/branch?service=${s.id}`;

function Tile({ tone, children, className }: { tone: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-[236px] flex-col justify-between rounded-card p-6 transition hover:-translate-y-0.5", tone, className)}>
      {children}
    </div>
  );
}

function SmallCard({ s, tone, tile, icon, className }: { s: Service; tone: string; tile: string; icon: ReactNode; className?: string }) {
  return (
    <Link href={href(s)} className={cn("block rounded-card", className)} aria-label={`${s.name}, ${inr(s.priceInr)}, ${s.durationMin} minutes. Book this service`}>
      <Tile tone={tone}>
        <div className="flex items-start justify-between">
          <Flower size={52} tint={tile}>{icon}</Flower>
          <span className="text-sm font-bold">{s.durationMin} min</span>
        </div>
        <div>
          <h3 className="font-display text-3xl leading-tight">{s.name}</h3>
          <p className="mt-1 text-sm">{s.description}</p>
          <p className="mt-4 font-display text-2xl">{inr(s.priceInr)}</p>
        </div>
      </Tile>
    </Link>
  );
}

export function Services() {
  const { data: services } = useApi("landing-services", () => listServices(), SEED_SERVICES);
  const by = (id: string) => services.find((s) => s.id === id);
  const hts = by("hot-towel-shave");
  const classic = by("classic-haircut");
  const fade = by("fade-styling");
  const beard = by("beard-trim");
  const combo = by("haircut-beard");

  return (
    <section id="services" aria-labelledby="services-title" className="mx-auto hidden max-w-[1100px] scroll-mt-8 px-6 py-24 lg:block">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">Popular services</p>
          <h2 id="services-title" className="mt-2 font-display text-5xl text-green">Pick your ritual</h2>
        </div>
        <Link href="/book/branch" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-green font-bold text-green">
          All services <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-5">
        {hts && (
          <Link href={href(hts)} className="row-span-2 block" aria-label={`${hts.name}, ${inr(hts.priceInr)}, ${hts.durationMin} minutes. Book this service`}>
            <div className="flex h-full flex-col items-center justify-between rounded-card bg-yellow p-6 text-center text-green-dark transition hover:-translate-y-0.5">
              <Flower size={230} tint="bg-butter" className="mt-2">
                <Flower size={170} tint="bg-butter" className="relative">
                  <Image src={SHAVE_PHOTO} alt="Hot towel shave in progress" fill sizes="170px" className="object-cover object-[35%_50%]" />
                </Flower>
              </Flower>
              <div>
                <h3 className="font-display text-4xl">{hts.name}</h3>
                <p className="mt-1 text-sm">{hts.description}</p>
                <p className="mt-4 inline-flex items-center gap-3">
                  <span className="rounded-full bg-green px-4 py-1.5 font-display text-lg text-white">{inr(hts.priceInr)}</span>
                  <span className="text-sm font-bold">{hts.durationMin} min</span>
                </p>
              </div>
            </div>
          </Link>
        )}
        {classic && <SmallCard s={classic} tone="bg-green text-white" tile="bg-yellow" icon={<ScissorsIcon className="text-green-dark" />} />}
        {fade && <SmallCard s={fade} tone="bg-orange text-ink" tile="bg-white" icon={<UserIcon className="text-green-dark" />} />}
        {beard && (
          <SmallCard s={beard} tone="bg-blue text-white" tile="bg-butter" icon={<UserIcon className="text-green-dark" />} className="col-span-2" />
        )}
        {combo && (
          <Link
            href={href(combo)}
            className="col-span-3 flex items-center gap-5 rounded-card border-2 border-dashed border-green-dark bg-cream-2 p-5 transition hover:bg-butter/40"
            aria-label={`${combo.name} combo, ${inr(combo.priceInr)}, ${combo.durationMin} minutes. Book this service`}
          >
            <Flower size={60} tint="bg-yellow"><span className="font-display text-sm text-green-dark">2in1</span></Flower>
            <div className="flex-1">
              <h3 className="font-display text-3xl text-green">{combo.name.replace("Haircut + Beard", "Haircut + Beard Combo")}</h3>
              <p className="text-sm text-muted-strong">One chair, one slot, the full look</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl text-green">{inr(combo.priceInr)}</p>
              <p className="text-sm text-muted-strong">{combo.durationMin} min</p>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
