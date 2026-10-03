import Image from "next/image";
import { Avatar, Button, Flower, StarIcon, ArrowRightIcon } from "@/components/ui";
import { SHAVE_PHOTO } from "@/lib/images";
import { SiteNav } from "./SiteNav";
import { BranchesPill, NextFreeSlotChip } from "./HeroStatus";

const BARBERS = ["Jhon Abraham", "Arjun Mehta", "Kabir Khan", "Dev Sharma"];

/** Desktop hero (lg and up). Phones get MobileHome instead. */
export function Hero() {
  return (
    <header className="on-dark relative hidden overflow-hidden rounded-b-[64px] bg-green pb-28 text-white lg:block">
      <Flower size={460} tint="bg-green-soft" className="absolute -right-24 -top-36" aria-hidden="true" />
      <Flower size={300} tint="bg-green-soft" className="absolute -right-40 top-4" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1100px] px-6">
        <SiteNav />
        <div className="grid grid-cols-[1.1fr_1fr] items-center gap-6 pt-8">
          <div>
            <BranchesPill />
            <h1 className="mt-6 font-display text-[84px] leading-[0.98] text-white">
              Book your next <span className="text-yellow">grooming</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/85">
              Pick your branch, choose your barber and lock your slot in under a minute. No calls, no waiting in line.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/book/branch" variant="secondary" size="lg">
                Book a slot <ArrowRightIcon size={20} />
              </Button>
              <Button href="#services" variant="outline" size="lg" className="border-white/35 text-white hover:bg-white/10">
                See services
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-3">
                {BARBERS.map((n) => (
                  <Avatar key={n} name={n} size={44} ring="ring-green" />
                ))}
              </div>
              <p className="text-sm text-white/80">Choose from our barbers at every branch</p>
            </div>
          </div>

          <div className="relative mx-auto h-[500px] w-full max-w-[460px]" aria-hidden="false">
            <Flower size={400} tint="bg-yellow" className="absolute right-6 top-4" aria-hidden="true">
              <Flower size={336} tint="bg-butter" className="relative">
                <Image
                  src={SHAVE_PHOTO}
                  alt="A customer relaxing under a hot towel during a classic shave"
                  fill
                  priority
                  sizes="336px"
                  className="object-cover object-[35%_50%]"
                />
              </Flower>
            </Flower>
            <span className="absolute -bottom-0 left-0 h-[104px] w-[104px] rounded-full bg-orange" aria-hidden="true" />
            <Flower size={84} tint="bg-blue" className="absolute right-0 top-8" aria-hidden="true" />
            <span className="absolute left-2 top-12 inline-flex min-h-10 items-center gap-2 rounded-full bg-cream px-4 text-sm font-bold text-ink shadow-md">
              <StarIcon size={14} className="fill-orange text-orange" /> 4.9 · Hot Towel Shave
            </span>
            <NextFreeSlotChip className="absolute -right-2 bottom-8 rounded-2xl bg-cream px-5 py-3 shadow-md" />
          </div>
        </div>
      </div>
    </header>
  );
}
