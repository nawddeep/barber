import type { Metadata } from "next";
import { BranchesPage } from "@/components/admin/branches/BranchesPage";

export const metadata: Metadata = { title: "Branches & fees" };

export default function Page() {
  return <BranchesPage />;
}
