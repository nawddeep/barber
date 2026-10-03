import { ArrowRightIcon, Button, Logo } from "@/components/ui";

export function Footer() {
  return (
    <footer className="on-dark bg-green-dark text-white">
      <div className="mx-auto max-w-[1100px] px-6 pb-28 pt-16 lg:pb-10 lg:pt-20">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <p className="font-display text-5xl leading-[1.05] text-butter lg:text-6xl">
            Fresh cut.<br />Zero waiting.
          </p>
          <Button href="/book/branch" variant="secondary" size="lg">
            Book a slot <ArrowRightIcon size={20} />
          </Button>
        </div>
        <div className="mt-14 flex flex-col gap-6 border-t border-white/15 pt-8 text-sm text-white/75 lg:flex-row lg:items-center lg:justify-between">
          <Logo tone="light" className="text-xl" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {[
                ["#services", "Services"],
                ["#branches", "Branches"],
                ["#barbers", "Barbers"],
                ["#hold", "Cancellation policy"],
                ["tel:+918000010001", "Contact"],
              ].map(([href, label]) => (
                <li key={label}>
                  <a href={href} className="inline-flex min-h-11 items-center hover:text-white">{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <p>© {new Date().getFullYear()} Barbr. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
