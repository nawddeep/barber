import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Owner panel | Barbr", template: "%s | Barbr admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
