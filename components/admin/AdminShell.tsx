"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Flower, Logo, Modal, UserIcon } from "@/components/ui";
import { resetDemo } from "@/lib/api";
import type { AdminSession } from "@/lib/api/session";
import { canOpen, clearSession, useSession } from "@/lib/auth-session";
import { cn } from "@/lib/cn";
import { ADMIN_NAV, isActive } from "./nav";

function SidebarContent({ session, pathname, onNavigate, onReset }: { session: AdminSession; pathname: string; onNavigate?: () => void; onReset: () => void }) {
  const router = useRouter();
  const items = ADMIN_NAV.filter((i) => !("ownerOnly" in i && i.ownerOnly) || session.role === "OWNER");
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-8">
      <div className="px-3">
        <Logo tone="light" href="/admin" className="text-4xl" />
        <p className="mt-1 text-sm text-white/75">{session.role === "OWNER" ? "Owner panel" : "Staff panel"}</p>
      </div>

      <nav aria-label="Admin" className="mt-8 flex-1">
        <ul className="space-y-1.5">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-4 font-medium transition",
                    active ? "bg-yellow font-bold text-green-dark" : "text-white/85 hover:bg-white/10",
                  )}
                >
                  <Icon size={20} /> {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={onReset} className="min-h-11 rounded-full px-3 text-sm text-white/75 underline-offset-4 hover:text-white hover:underline">
            Reset demo data
          </button>
          <button
            type="button"
            onClick={() => {
              clearSession();
              onNavigate?.();
              router.replace("/admin/login");
            }}
            className="min-h-11 rounded-full px-3 text-sm font-bold text-yellow hover:bg-white/10"
          >
            Log out
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-3xl bg-white/10 p-3">
          <Flower size={44} tint="bg-butter"><UserIcon size={20} className="text-green-dark" /></Flower>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{session.name}</p>
            <p className="text-sm text-white/75">All branches</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** Sign-in guard, sidebar (drawer on phones) and the owner-only check for every /admin page. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready } = useSession();
  const [drawer, setDrawer] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (ready && !session) router.replace(`/admin/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [ready, session, pathname, router]);

  useEffect(() => {
    const d = drawerRef.current;
    if (!d) return;
    if (drawer && !d.open) d.showModal();
    if (!drawer && d.open) d.close();
  }, [drawer]);

  if (!ready || !session) {
    return <div className="min-h-screen bg-admin" role="status" aria-label="Checking your sign-in" />;
  }

  const doReset = async () => {
    setResetting(true);
    await resetDemo();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-admin lg:pl-[260px]">
      <aside className="on-dark fixed inset-y-0 left-0 z-30 hidden w-[260px] bg-green-dark lg:block">
        <SidebarContent session={session} pathname={pathname} onReset={() => setResetOpen(true)} />
      </aside>

      <header className="on-dark sticky top-0 z-20 flex items-center justify-between bg-green-dark px-4 py-3 lg:hidden">
        <Logo tone="light" href="/admin" className="text-3xl" />
        <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white">
          <MenuIcon />
        </button>
      </header>

      <dialog
        ref={drawerRef}
        aria-label="Menu"
        onClose={() => setDrawer(false)}
        onClick={(e) => e.target === drawerRef.current && setDrawer(false)}
        className="on-dark m-0 h-dvh max-h-none w-[280px] max-w-[85vw] bg-green-dark p-0 text-white backdrop:bg-ink/50 lg:hidden"
      >
        <SidebarContent session={session} pathname={pathname} onNavigate={() => setDrawer(false)} onReset={() => { setDrawer(false); setResetOpen(true); }} />
      </dialog>

      <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
        {canOpen(session.role, pathname) ? (
          children
        ) : (
          <div className="mx-auto max-w-md rounded-card bg-white p-8 text-center">
            <h1 className="font-display text-4xl text-green">Owners only</h1>
            <p className="mt-3 text-muted-strong">Branches & fees can only be changed by the owner. You are signed in as staff.</p>
            <Button href="/admin" className="mt-6">Back to dashboard</Button>
          </div>
        )}
      </main>

      {resetOpen && (
        <Modal open onClose={() => setResetOpen(false)} title="Reset demo data?">
          <p className="text-ink">This replaces every booking, fee rule and branch setting with fresh sample data. Your sign-in stays.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setResetOpen(false)}>Keep my data</Button>
            <Button onClick={doReset} disabled={resetting}>{resetting ? "Resetting…" : "Yes, reset"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
