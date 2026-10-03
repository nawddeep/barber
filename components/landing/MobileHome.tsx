"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Avatar, CalendarIcon, Flower, HomeIcon, PinIcon, ScissorsIcon, Select, UserIcon } from "@/components/ui";
import { listBranches, listServices } from "@/lib/api";
import { bookingQuery, inr } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SHAVE_PHOTO } from "@/lib/images";
import { SEED_BRANCHES, SEED_SERVICES } from "@/lib/mock/seed";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui";
import { useTeam } from "./Barbers";

const OPEN = SEED_BRANCHES.filter((b) => !b.paused);
const CARD_TONES = ["bg-yellow text-green-dark", "bg-orange text-ink", "bg-blue text-white", "bg-cream text-green-dark", "bg-butter text-green-dark"];
const HOME_SERVICES = ["hot-towel-shave", "classic-haircut", "fade-styling", "beard-trim", "haircut-beard"];

/** Phone layout (below lg), following the mobile home screenshot. */
export function MobileHome() {
  const { data: branches } = useApi("m-branches", () => listBranches(), OPEN);
  const [pick, setPick] = useState("");
  const branchId = branches.some((b) => b.id === pick) ? pick : branches[0]?.id ?? "";
  const { data: services } = useApi(`m-services:${branchId}`, () => listServices(branchId), SEED_SERVICES);
  const team = useTeam();
  const list = HOME_SERVICES.map((id) => services.find((s) => s.id === id)).filter((s) => !!s);

  return (
    <>
      <header className="on-dark relative overflow-hidden bg-green pb-10 text-white lg:hidden">
        <Flower size={320} tint="bg-green-soft" className="absolute -right-24 -top-24" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl px-5 pt-6">
          <div className="flex items-center justify-between">
            <Logo tone="light" href="/" className="text-3xl" />
            <Link href="/admin/login" aria-label="Sign in" className="grid h-14 w-14 place-items-center rounded-full bg-cream-2 text-green ring-4 ring-butter">
              <UserIcon size={24} />
            </Link>
          </div>

          <div className="relative mt-6">
            <label htmlFor="m-branch" className="sr-only">Branch</label>
            <PinIcon size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-yellow" />
            <Select
              id="m-branch"
              value={branchId}
              onChange={(e) => setPick(e.target.value)}
              className="border-white/30 bg-white/15 pl-11 font-bold text-white [&>option]:text-ink"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>

          <h1 className="mt-6 font-display text-5xl leading-[1.02]">
            Book your next <span className="text-yellow">grooming</span>
          </h1>
          <p className="mt-2 text-white/85">Ready for a fresh cut?</p>

          <h2 id="m-services" className="mt-8 font-display text-2xl">Popular services</h2>
        </div>

        <ul
          aria-labelledby="m-services"
          className="relative mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none]"
        >
          {list.map((s, i) => (
            <li key={s.id} className="w-[78%] max-w-[300px] shrink-0 snap-center first:ml-[max(0px,calc((100vw-36rem)/2))]">
              <Link
                href={`/book/slot${bookingQuery({ branch: branchId, service: s.id })}`}
                aria-label={`${s.name}, ${inr(s.priceInr)}, ${s.durationMin} minutes. Book this service`}
                className={cn("flex h-full min-h-[330px] flex-col items-center justify-between rounded-[32px] p-6 text-center", CARD_TONES[i % CARD_TONES.length])}
              >
                {i === 0 ? (
                  <Flower size={170} tint="bg-butter">
                    <Flower size={130} tint="bg-butter" className="relative">
                      <Image src={SHAVE_PHOTO} alt="" fill sizes="130px" className="object-cover object-[35%_50%]" />
                    </Flower>
                  </Flower>
                ) : (
                  <Flower size={96} tint="bg-white/90"><ScissorsIcon size={32} className="text-green-dark" /></Flower>
                )}
                <div>
                  <h3 className="font-display text-3xl leading-tight">{s.name}</h3>
                  <p className="mt-1 text-sm">{s.description}</p>
                  <span className="mt-3 inline-block rounded-full bg-green-dark px-4 py-2 text-sm font-bold text-white">
                    {inr(s.priceInr)} · {s.durationMin} min
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="relative mx-auto mt-8 max-w-xl px-5">
          <h2 id="m-barbers" className="font-display text-2xl">Find your barber</h2>
          <ul aria-labelledby="m-barbers" className="mt-4 flex justify-between gap-3">
            {team.map((b) => (
              <li key={b.id} className="text-center">
                <Link href={`/book/branch${bookingQuery({ branch: branchId })}`} className="block" aria-label={`Book with ${b.name}`}>
                  <Avatar name={b.name} size={68} ring="ring-butter" decorative />
                  <span className="mt-2 block text-sm font-bold">{b.name.split(" ")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <nav aria-label="Mobile" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-full bg-cream p-2 shadow-[0_12px_30px_-8px_rgba(0,0,0,0.35)] lg:hidden">
        {[
          { href: "/", label: "Home", icon: HomeIcon, active: true },
          { href: "/book/branch", label: "Book a service", icon: ScissorsIcon },
          { href: "/book/slot", label: "Pick a slot", icon: CalendarIcon },
          { href: "/admin/login", label: "Sign in", icon: UserIcon },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link
            key={label}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn("grid h-14 w-14 place-items-center rounded-full", active ? "bg-orange text-green-dark" : "text-green-dark")}
          >
            <Icon size={26} />
          </Link>
        ))}
      </nav>
    </>
  );
}
