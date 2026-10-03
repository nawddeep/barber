import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  /** Fixed prefix such as "+91" or "₹". */
  prefix?: ReactNode;
  invalid?: boolean;
  wrapperClassName?: string;
};

export function Input({ prefix, invalid, className, wrapperClassName, ...rest }: InputProps) {
  return (
    <div
      className={cn(
        "flex min-h-12 w-full items-stretch overflow-hidden rounded-input border-2 bg-cream transition",
        "focus-within:border-green focus-within:bg-white",
        invalid ? "border-orange-ink" : "border-line",
        wrapperClassName,
      )}
    >
      {prefix ? (
        <span className="flex items-center border-r-2 border-line px-4 text-sm font-bold text-green-dark">
          {prefix}
        </span>
      ) : null}
      <input
        aria-invalid={invalid || undefined}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70",
          className,
        )}
        {...rest}
      />
    </div>
  );
}
