import type { Metadata } from "next";
import { BranchStep } from "@/components/booking/BranchStep";

export const metadata: Metadata = { title: "Choose a branch and service | Barbr" };

export default function Page() {
  return <BranchStep />;
}
