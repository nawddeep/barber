import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/lib/types";

type ChipTone = "neutral" | "green" | "yellow" | "orange" | "blue" | "onGreen";

const tones: Record<ChipTone, string> = {
  neutral: "bg-cream-2 text-ink",
  green: "bg-status-confirmed text-status-confirmed-ink",
  yellow: "bg-butter text-status-pending-ink",
  orange: "bg-status-cancelled text-status-cancelled-ink",
  blue: "bg-blue text-white",
  onGreen: "bg-green-soft text-butter",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  CONFIRMED: "Confirmed",
  PENDING_FEE: "Fee pending",
  IN_SERVICE: "In service",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const statusClass: Record<BookingStatus, string> = {
  CONFIRMED: "bg-status-confirmed text-status-confirmed-ink",
  PENDING_FEE: "bg-status-pending text-status-pending-ink",
  IN_SERVICE: "bg-status-service text-status-service-ink",
  COMPLETED: "bg-status-done text-status-done-ink",
  CANCELLED: "bg-status-cancelled text-status-cancelled-ink",
  NO_SHOW: "bg-status-cancelled text-status-cancelled-ink",
};

export function StatusChip({
  status,
  label,
  className,
}: {
  status: BookingStatus;
  /** Override text, e.g. "Confirmed · ₹99 paid". */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold",
        statusClass[status],
        className,
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
