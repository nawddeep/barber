import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { ChevronUpDownIcon } from "./Icons";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
  invalid?: boolean;
  wrapperClassName?: string;
};

/** Native select styled like the design. */
export function Select({ invalid, className, wrapperClassName, children, ...rest }: SelectProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          "min-h-12 w-full appearance-none rounded-input border-2 bg-cream py-3 pl-4 pr-11 text-base font-medium text-ink",
          "focus:border-green focus:bg-white",
          invalid ? "border-orange-ink" : "border-line",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronUpDownIcon
        size={16}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-green-dark"
      />
    </div>
  );
}
