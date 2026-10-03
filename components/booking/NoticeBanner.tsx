"use client";

import { CloseIcon } from "@/components/ui";
import { useWizardStore } from "@/lib/wizard/store";

/** A one-off message from an earlier step ("Your hold expired", "That branch is paused"). */
export function NoticeBanner() {
  const notice = useWizardStore((s) => s.notice);
  const setNotice = useWizardStore((s) => s.setNotice);
  if (!notice) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl bg-butter p-4 font-medium text-ink max-lg:mx-4">
      <p>{notice}</p>
      <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/70">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
