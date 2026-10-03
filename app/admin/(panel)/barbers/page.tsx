import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Barbers" };

export default function Page() {
  return <ComingSoon title="Barbers" blurb="Your team, their breaks and their branches." />;
}
