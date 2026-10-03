import { Suspense } from "react";
import { WizardShell } from "@/components/booking/WizardShell";

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WizardShell>{children}</WizardShell>
    </Suspense>
  );
}
