import { CheckIcon, Flower, ScissorsIcon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { inr } from "@/lib/format";
import { SERVICE_TINT } from "@/lib/service-ui";
import type { Service } from "@/lib/types";

type Props = {
  services: Array<Service & { priceInr: number }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Six selectable service cards. Prices already include branch overrides. */
export function ServiceGrid({ services, selectedId, onSelect }: Props) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => {
        const selected = s.id === selectedId;
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(s.id)}
              className={cn(
                "relative flex h-full min-h-[180px] w-full flex-col justify-between rounded-[28px] border-[3px] bg-white p-5 text-left transition",
                selected ? "border-green" : "border-transparent hover:border-line",
              )}
            >
              {selected && (
                <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-green text-white">
                  <CheckIcon size={14} aria-label="Selected" />
                </span>
              )}
              <Flower size={52} tint={SERVICE_TINT[s.tint]}>
                <ScissorsIcon size={22} className="text-green-dark" />
              </Flower>
              <div className="mt-4">
                <h3 className="font-display text-xl leading-tight text-green">{s.name}</h3>
                <p className="mt-1 text-sm text-muted">{s.description}</p>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="font-display text-xl text-green-dark">{inr(s.priceInr)}</span>
                <span className="text-sm text-muted">{s.durationMin} min</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
