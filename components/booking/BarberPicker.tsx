import { Avatar, BoltIcon, Flower, StarIcon } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Barber } from "@/lib/types";

type Props = {
  barbers: Barber[];
  /** A barber id or "any". */
  selected: string;
  onSelect: (id: string) => void;
};

const SHORT: Record<string, string> = { Fades: "Fades", Styling: "Styling", Beard: "Beards", Hot: "Shaves" };
const shortSpecialty = (specialty: string) => SHORT[specialty.split(" ")[0]] ?? specialty.split(" ")[0];

const item = (on: boolean) =>
  cn(
    "flex h-full w-[84px] shrink-0 flex-col items-center gap-2 text-center transition lg:w-auto lg:rounded-[28px] lg:border-[3px] lg:bg-white lg:p-4",
    on ? "lg:border-green" : "lg:border-transparent",
  );

export function BarberPicker({ barbers, selected, onSelect }: Props) {
  return (
    <ul className="flex items-stretch gap-4 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible">
      <li className="lg:w-auto">
        <button type="button" aria-pressed={selected === "any"} onClick={() => onSelect("any")} className={item(selected === "any")}>
          <Flower size={64} tint="bg-yellow" className={cn(selected === "any" && "max-lg:ring-0")}>
            <BoltIcon size={26} className="text-green-dark" />
          </Flower>
          <span className="font-display text-base leading-tight text-green">Any barber</span>
          <span className="hidden text-xs text-muted lg:block">Fastest slot</span>
        </button>
      </li>
      {barbers.map((b) => {
        const on = selected === b.id;
        return (
          <li key={b.id} className="lg:w-auto">
            <button type="button" aria-pressed={on} onClick={() => onSelect(b.id)} className={item(on)} aria-label={`${b.name}, ${b.specialty}, rated ${b.rating.toFixed(1)}`}>
              <Avatar name={b.name} size={64} decorative ring={on ? "ring-green" : "ring-white"} />
              <span className="font-display text-base leading-tight text-green">
                <span className="lg:hidden">{b.name.split(" ")[0]}</span>
                <span className="hidden lg:inline">{b.name}</span>
              </span>
              <span className="hidden items-center gap-1 text-xs text-muted lg:flex">
                {shortSpecialty(b.specialty)} · <StarIcon size={11} className="fill-ink text-ink" aria-hidden="true" /> {b.rating.toFixed(1)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
