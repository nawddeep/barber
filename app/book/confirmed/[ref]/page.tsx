import type { Metadata } from "next";
import { ConfirmedView } from "@/components/booking/ConfirmedView";

export const metadata: Metadata = { title: "Booking confirmed | Barbr" };

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <ConfirmedView bookingRef={ref} />;
}
