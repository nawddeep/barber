import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CIRCLES = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return { cx: +(0.5 + 0.3 * Math.cos(a)).toFixed(4), cy: +(0.5 + 0.3 * Math.sin(a)).toFixed(4) };
});

/** Render once in the root layout. Defines the shared flower clip-path. */
export function FlowerDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <clipPath id="barbr-flower" clipPathUnits="objectBoundingBox">
          <circle cx=".5" cy=".5" r=".3" />
          {CIRCLES.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r=".2" />
          ))}
        </clipPath>
      </defs>
    </svg>
  );
}

type FlowerProps = Omit<HTMLAttributes<HTMLDivElement>, "style" | "children"> & {
  size?: number;
  /** Tailwind background class for icon tiles, e.g. "bg-yellow". */
  tint?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function Flower({ size = 48, tint = "bg-yellow", className, style, children, ...rest }: FlowerProps) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center overflow-hidden", tint, className)}
      style={{ width: size, height: size, clipPath: "url(#barbr-flower)", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
