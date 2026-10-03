import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <ComingSoon title="Payments" blurb="Booking fees collected and refunds." />;
}
