import type { Metadata } from "next";
import { SlotStep } from "@/components/booking/SlotStep";

export const metadata: Metadata = { title: "Pick your time | Barbr" };

export default function Page() {
  return <SlotStep />;
}
