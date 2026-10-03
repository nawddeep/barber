import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardVariant = "cream" | "white" | "green" | "yellow" | "orange" | "blue";

const variants: Record<CardVariant, string> = {
  cream: "bg-cream-2 text-ink",
  white: "bg-white text-ink",
  green: "on-dark bg-green text-white",
  yellow: "bg-yellow text-green-dark",
  orange: "bg-orange text-ink",
  blue: "bg-blue text-white",
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  /** 40px radius instead of 32px. */
  large?: boolean;
  dashed?: boolean;
};

export function Card({ variant = "white", large, dashed, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "p-6",
        large ? "rounded-card-lg" : "rounded-card",
        variants[variant],
        dashed && "border-2 border-dashed border-green-dark bg-cream-2",
        className,
      )}
      {...rest}
    />
  );
}
