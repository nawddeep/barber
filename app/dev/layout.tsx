import type { Metadata } from "next";

// Developer-only pages: keep them out of search results.
export const metadata: Metadata = {
  title: "Developer tools | Barbr",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
