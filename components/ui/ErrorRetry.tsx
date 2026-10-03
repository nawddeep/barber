import { Button } from "./Button";
import { cn } from "@/lib/cn";

/** Shown instead of a spinner that would never finish. */
export function ErrorRetry({
  title = "Something went wrong",
  message = "We could not load this. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("rounded-card bg-status-cancelled p-6 text-center text-status-cancelled-ink", className)}>
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      <Button className="mt-4" onClick={onRetry}>Try again</Button>
    </div>
  );
}
