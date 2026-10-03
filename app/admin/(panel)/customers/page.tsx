import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return <ComingSoon title="Customers" blurb="Who books with you, and who misses their slot." />;
}
