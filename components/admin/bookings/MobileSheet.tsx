"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/ui";

/**
 * Booking details as a full-screen sheet on phones and a drawer on tablets and small laptops (the panel sits beside the list from 1400px). A plain (non-modal) dialog on purpose: a modal dialog sits above everything,
 * which would hide the toast with the Undo button.
 */
export function MobileSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.show();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("dialog[open]:modal") && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // Runs once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <dialog ref={ref} aria-label="Booking details" className="fixed inset-0 z-40 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-admin p-0 lg:inset-auto lg:right-0 lg:top-0 lg:w-[460px] lg:max-w-[460px] lg:rounded-l-card-lg lg:shadow-[-20px_0_50px_-20px_rgba(30,69,54,0.35)] min-[1400px]:hidden">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-admin px-4 py-3">
        <p className="font-display text-xl text-green">Booking</p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close booking details" className="grid h-11 w-11 place-items-center rounded-full bg-white text-green-dark">
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="px-4 pb-10">{children}</div>
    </dialog>
  );
}
