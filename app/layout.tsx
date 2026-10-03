import type { Metadata } from "next";
import { Bagel_Fat_One, DM_Sans } from "next/font/google";
import "./globals.css";
import { OfflineNotice } from "@/components/OfflineNotice";
import { FlowerDefs } from "@/components/ui/Flower";
import { ToastProvider } from "@/components/ui/Toast";

const bagel = Bagel_Fat_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bagel",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Barbr: book your next grooming",
  description: "Book a slot at any Barbr branch in under a minute.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bagel.variable} ${dmSans.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only z-[80] rounded-full bg-yellow px-4 py-2 font-bold text-green-dark focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <OfflineNotice />
        <FlowerDefs />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
