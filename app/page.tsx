import type { Metadata } from "next";
import { Barbers } from "@/components/landing/Barbers";
import { Branches } from "@/components/landing/Branches";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HoldPanel } from "@/components/landing/HoldPanel";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { MobileHome } from "@/components/landing/MobileHome";
import { QuickBook } from "@/components/landing/QuickBook";
import { Services } from "@/components/landing/Services";

const title = "Barbr: book your next grooming";
const description = "Pick your branch, choose your barber and lock your slot in under a minute. Hot towel shaves, fades, beard trims and more.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/images/hot-towel-shave.jpg", width: 520, height: 280, alt: "A hot towel shave at Barbr" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/images/hot-towel-shave.jpg"] },
};

export default function Home() {
  return (
    <>
      <Hero />
      <MobileHome />
      <main id="main">
        <div className="relative z-10 mx-auto hidden max-w-[1100px] px-6 lg:-mt-20 lg:block">
          <QuickBook />
        </div>
        <Services />
        <HowItWorks />
        <Branches />
        <Barbers />
        <HoldPanel />
      </main>
      <Footer />
    </>
  );
}
