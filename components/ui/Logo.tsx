import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  tone = "dark",
  href,
  className,
}: {
  tone?: "dark" | "light";
  href?: string;
  className?: string;
}) {
  const classes = cn(
    "font-display tracking-wide",
    tone === "light" ? "text-butter" : "text-green",
    className ?? "text-2xl",
  );
  if (href) {
    return (
      <Link href={href} aria-label="Barbr home" className={cn(classes, "inline-flex min-h-11 items-center")}>
        BARBR
      </Link>
    );
  }
  return <span className={classes}>BARBR</span>;
}
