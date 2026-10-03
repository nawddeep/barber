"use client";

import { addDays, format, parseISO, startOfDay } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ChatIcon, ErrorRetry, Flower, PhoneIcon, PinIcon, ScissorsIcon, Select, StarIcon, useToast } from "@/components/ui";
import { ApiError, getNextFreeSlot, getSlotCounts, getSlots, listBranches, rescheduleBooking } from "@/lib/api";
import { now } from "@/lib/clock";
import { inr, localDate } from "@/lib/format";
import { useApi } from "@/lib/hooks/useApi";
import { SHAVE_PHOTO } from "@/lib/images";
import { SEED_BRANCHES } from "@/lib/mock/seed";
import { SERVICE_TINT } from "@/lib/service-ui";
import { allSlots, type Slot } from "@/lib/slots";
import { useCheckoutStore } from "@/lib/wizard/checkout";
import { useWizardStore } from "@/lib/wizard/store";
import { useLookups } from "@/lib/wizard/useLookups";
import { BarberPicker } from "./BarberPicker";
import { DayStrip, type DayItem } from "./DayStrip";
import { SlotGrid } from "./SlotGrid";
import { BackToServices } from "./WizardShell";
import { NoticeBanner } from "./NoticeBanner";

/** Phone-only header: service photo, price, call and chat buttons, branch switcher. */
function MobileHero() {
  const { branchId, serviceId, rescheduleRef } = useWizardStore();
  const setBranch = useWizardStore((s) => s.setBranch);
  const l = useLookups(branchId, serviceId);
  const open = useApi("s2-open-branches", () => listBranches(), SEED_BRANCHES.filter((b) => !b.paused)).data;
  const rating = l.barbers.length ? l.barbers.reduce((n, b) => n + b.rating, 0) / l.barbers.length : 4.9;
  const phone = l.branch?.phone.replace(/\D/g, "") ?? "";

  return (
    <div className="lg:hidden">
      <div className="relative h-56 overflow-hidden rounded-b-[36px] bg-green">
        {serviceId === "hot-towel-shave" ? (
          <Image src={SHAVE_PHOTO} alt="Hot towel shave in progress" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className={`grid h-full place-items-center ${l.service ? SERVICE_TINT[l.service.tint] : "bg-yellow"}`}>
            <Flower size={140} tint="bg-white/70"><ScissorsIcon size={48} className="text-green-dark" /></Flower>
          </div>
        )}
        <Link href={rescheduleRef ? `/book/confirmed/${rescheduleRef}` : "/book/branch"} aria-label={rescheduleRef ? "Back to your booking" : "Back to branch and service"} className="absolute left-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-cream text-orange shadow">
          <ArrowLeftIcon size={22} />
        </Link>
      </div>

      <div className="space-y-4 px-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-4xl leading-tight text-green">{l.service?.name ?? "Pick your time"}</h1>
          <span className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-green px-3 text-sm font-bold text-white">
            <StarIcon size={14} className="fill-yellow text-yellow" aria-hidden="true" /> <span className="sr-only">Rated </span>{rating.toFixed(1)}
          </span>
        </div>
        <p className="text-muted-strong">{l.service?.description}</p>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-orange px-5 py-2 font-display text-2xl text-ink">{l.service ? inr(l.service.priceInr) : ""}</span>
          <div className="flex gap-3">
            <a href={`tel:+${phone}`} aria-label={`Call ${l.branch?.name ?? "the branch"}`} className="grid h-12 w-12 place-items-center rounded-full bg-white text-orange shadow-sm">
              <PhoneIcon size={22} />
            </a>
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label={`Chat with ${l.branch?.name ?? "the branch"} on WhatsApp`} className="grid h-12 w-12 place-items-center rounded-full bg-white text-orange shadow-sm">
              <ChatIcon size={22} />
            </a>
          </div>
        </div>
        {rescheduleRef ? (
          <p className="flex min-h-12 items-center gap-2 rounded-input bg-white px-4 font-bold text-green-dark"><PinIcon size={18} className="text-green" /> {l.branch?.name}</p>
        ) : (
        <div className="relative">
          <label htmlFor="m-slot-branch" className="sr-only">Branch</label>
          <PinIcon size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-green" />
          <Select id="m-slot-branch" value={branchId ?? ""} onChange={(e) => setBranch(e.target.value)} className="border-green bg-white pl-11 font-bold text-green-dark">
            {open.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
        )}
      </div>
    </div>
  );
}

export function SlotStep() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { branchId, serviceId, barberId, date: storedDate, startsAt, rescheduleRef, assignedBarberId } = useWizardStore();
  const { setDate, setBarber, setSlot, clearSlot, setNotice } = useWizardStore.getState();
  const setCheckout = useCheckoutStore((st) => st.set);
  const [moving, setMoving] = useState(false);
  const l = useLookups(branchId, serviceId);
  const today = localDate(now());
  const maxDate = localDate(addDays(startOfDay(now()), l.settings.advanceBookingDays));

  const q = { branchId: branchId ?? "", serviceId: serviceId ?? "", barberId, ignoreRef: rescheduleRef ?? undefined };
  const qk = `${q.branchId}:${q.serviceId}:${q.barberId}:${rescheduleRef ?? ""}`;

  // First visit: open on the earliest day that has a free slot.
  const next = useApi(`s2-next:${qk}`, () => getNextFreeSlot({ branchId: q.branchId, serviceId: q.serviceId, barberId }));
  const date = storedDate ?? (next.data ? localDate(new Date(next.data.startsAt)) : today);

  const offset = Math.round((+startOfDay(parseISO(date)) - +startOfDay(now())) / 86_400_000);
  const [pagePick, setPagePick] = useState<number | null>(null);
  const windowStart = Math.min(pagePick ?? Math.floor(Math.max(offset, 0) / 7) * 7, 14);
  const windowFrom = localDate(addDays(startOfDay(now()), windowStart));

  const counts = useApi(`s2-counts:${qk}:${windowFrom}`, () => getSlotCounts({ ...q, from: windowFrom, days: 7 }));
  const slots = useApi(`s2-slots:${qk}:${date}`, () => getSlots({ ...q, date }));

  // Keep the chosen slot honest after slots reload (barber or service changed, someone else booked it).
  useEffect(() => {
    if (slots.loading || !slots.data || !startsAt) return;
    if (localDate(new Date(startsAt)) !== date) return;
    const slot = allSlots(slots.data).find((x) => x.startsAt === startsAt);
    if (!slot || !slot.available) clearSlot();
    else if (slot.barberId !== useWizardStore.getState().assignedBarberId) setSlot(slot.startsAt, slot.barberId);
  }, [slots.loading, slots.data, startsAt, date, clearSlot, setSlot]);

  // Rescheduling: the summary button moves the existing booking instead of going to step 3.
  const moveRef = useRef<() => void>(() => {});
  useEffect(() => {
    moveRef.current = async () => {
      if (!rescheduleRef || !startsAt) return;
      setMoving(true);
      try {
        await rescheduleBooking({ ref: rescheduleRef, startsAt, barberId: assignedBarberId ?? barberId });
        toast.show({ message: "Booking moved to your new time" });
        useWizardStore.getState().reset();
        router.push(`/book/confirmed/${rescheduleRef}`);
      } catch (e) {
        setNotice(e instanceof ApiError ? e.message : "Could not move the booking.");
        clearSlot();
        setMoving(false);
      }
    };
  });
  useEffect(() => {
    if (!rescheduleRef) return;
    setCheckout({ action: { label: "Confirm new time", onClick: () => moveRef.current(), busy: moving, disabled: !startsAt } });
    return () => setCheckout({ action: null });
  }, [rescheduleRef, moving, startsAt, setCheckout]);

  const pickDate = (d: string) => {
    setDate(d);
    // Synchronous, so a reload right after a click never sees a stale ?date=. Next keeps useSearchParams in sync.
    window.history.replaceState(null, "", `${pathname}?date=${d}`);
  };

  const days: DayItem[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startOfDay(now()), windowStart + i);
    const iso = localDate(d);
    const n = counts.data?.find((c) => c.date === iso)?.count;
    const beyond = iso > maxDate;
    return {
      date: iso,
      weekday: format(d, "EEE"),
      day: d.getDate(),
      caption: iso === today ? "Today" : beyond ? "–" : n === undefined ? "…" : n === 0 ? "Full" : `${n} slots`,
      disabled: beyond || n === 0,
    };
  });

  const nextDay = localDate(addDays(parseISO(date), 1));
  const isToday = date === today;

  return (
    <div className="space-y-8 max-lg:space-y-6">
      <MobileHero />

      <NoticeBanner />

      <div className="hidden items-end justify-between gap-4 lg:flex">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">{rescheduleRef ? `Rescheduling ${rescheduleRef}` : "Step 2 of 4"}</p>
          <h1 className="mt-2 font-display text-5xl text-green">{rescheduleRef ? "Pick a new time" : "Pick your time"}</h1>
        </div>
        {rescheduleRef ? (
          <Link href={`/book/confirmed/${rescheduleRef}`} className="inline-flex min-h-11 items-center border-b-2 border-green font-bold text-green">Back to my booking</Link>
        ) : (
          <BackToServices />
        )}
      </div>

      <div className="space-y-8 px-4 max-lg:space-y-6 lg:px-0">
        <DayStrip
          days={days}
          selected={date}
          onSelect={pickDate}
          monthLabel={format(parseISO(days[0].date), "MMMM yyyy")}
          hint={`Bookings open ${l.settings.advanceBookingDays} days ahead`}
          onPrev={windowStart > 0 ? () => setPagePick(Math.max(windowStart - 7, 0)) : undefined}
          onNext={windowStart + 7 <= l.settings.advanceBookingDays ? () => setPagePick(windowStart + 7) : undefined}
        />

        {slots.error ? (
          <ErrorRetry title="Could not load the times" message="Check your connection and try again. Nothing you picked was lost." onRetry={slots.reload} />
        ) : (
        <SlotGrid
          groups={slots.loading ? null : (slots.data ?? null)}
          selected={startsAt}
          onSelect={(slot: Slot) => {
            setDate(date);
            setSlot(slot.startsAt, slot.barberId);
          }}
          emptyMessage={isToday ? "No slots left today, try tomorrow" : "No slots left on this day, try another"}
          onTryNextDay={nextDay <= maxDate ? () => pickDate(nextDay) : undefined}
        />
        )}

        <section aria-labelledby="barber-title">
          <h2 id="barber-title" className="mb-4 font-display text-3xl text-green max-lg:text-2xl">Choose <span className="lg:hidden">barber</span><span className="hidden lg:inline">your barber</span></h2>
          <BarberPicker barbers={l.barbers} selected={barberId} onSelect={setBarber} />
        </section>
      </div>
    </div>
  );
}
