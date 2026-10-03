"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./Icons";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** "modal" is centred; "sheet" slides up from the bottom on mobile and sits right on desktop. */
  variant?: "modal" | "sheet";
  /** A wider drawer on desktop (for long forms). */
  wide?: boolean;
  children: ReactNode;
  className?: string;
};

/** Built on native <dialog>: focus trap, Esc to close and inert background come for free. */
export function Modal({ open, onClose, title, variant = "modal", wide, children, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const sheet = variant === "sheet";

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg overflow-visible rounded-card-lg bg-cream p-0 text-ink backdrop:bg-ink/50",
        sheet &&
          "mb-0 mt-auto w-full max-w-none rounded-b-none lg:mb-auto lg:mr-0 lg:h-dvh lg:rounded-none lg:rounded-l-card-lg",
        sheet && (wide ? "lg:w-[580px] lg:max-w-[580px]" : "lg:w-[440px] lg:max-w-[440px]"),
        className,
      )}
    >
      <div className={cn("max-h-[90dvh] overflow-y-auto p-6", sheet && "lg:h-dvh lg:max-h-none")}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl text-green">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full bg-cream-2 text-green-dark"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
