import Link from "next/link";
import { Button, Logo } from "@/components/ui";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#branches", label: "Branches" },
  { href: "#barbers", label: "Barbers" },
  { href: "#how", label: "How it works" },
];

export function SiteNav() {
  return (
    <nav aria-label="Primary" className="flex items-center justify-between gap-6 py-6">
      <Logo tone="light" href="/" className="text-3xl" />
      <ul className="flex items-center gap-8 text-sm font-medium text-white">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="inline-flex min-h-11 items-center hover:text-butter">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4">
        <Link href="/admin/login" className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium text-white hover:text-butter">
          Sign in
        </Link>
        <Button href="/book/branch" variant="secondary">
          Book a slot
        </Button>
      </div>
    </nav>
  );
}
