import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingsPage } from "@/components/admin/bookings/BookingsPage";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BookingsPage />
    </Suspense>
  );
}
