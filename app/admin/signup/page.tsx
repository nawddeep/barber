import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/admin/SignUpForm";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
