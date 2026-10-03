import type { Metadata } from "next";
import { DetailsStep } from "@/components/booking/DetailsStep";

export const metadata: Metadata = { title: "Your details | Barbr" };

export default function Page() {
  return <DetailsStep />;
}
