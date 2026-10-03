import Image from "next/image";
import { barberPhoto, hasBarberPhoto } from "@/lib/images";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Avatar({
  name,
  size = 56,
  ring,
  decorative,
  className,
}: {
  name: string;
  size?: number;
  /** Tailwind ring colour class, e.g. "ring-butter". */
  ring?: string;
  /** Use when the name is already printed next to the photo. */
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-full bg-cream-2", ring && `ring-4 ${ring}`, className)}
      style={{ width: size, height: size }}
    >
      {hasBarberPhoto(name) ? (
        <Image src={barberPhoto(name)} alt={decorative ? "" : name} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name} className="grid h-full w-full place-items-center bg-yellow font-display text-green-dark" style={{ fontSize: size * 0.38 }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
