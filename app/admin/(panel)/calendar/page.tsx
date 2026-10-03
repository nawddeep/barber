import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarPage } from "@/components/admin/calendar/CalendarPage";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CalendarPage />
    </Suspense>
  );
}
