"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeftIcon, ArrowRightIcon, BoltIcon, Button, CalendarIcon, Card, ChatIcon, CheckIcon, Chip,
  DashboardIcon, Flower, Input, Label, ListIcon, Logo, Modal, OtpInput, PhoneIcon, PinIcon, ScissorsIcon,
  SearchIcon, SegmentedControl, Select, SettingsIcon, StarIcon, Stepper, StatusChip, Toggle, UserIcon,
  WalletIcon, useToast, type CardVariant,
} from "@/components/ui";
import { colors } from "@/lib/tokens";
import type { BookingStatus } from "@/lib/types";

const ICONS = [
  ["scissors", ScissorsIcon], ["pin", PinIcon], ["calendar", CalendarIcon], ["phone", PhoneIcon],
  ["chat", ChatIcon], ["check", CheckIcon], ["arrow-right", ArrowRightIcon], ["arrow-left", ArrowLeftIcon],
  ["star", StarIcon], ["user", UserIcon], ["settings", SettingsIcon], ["dashboard", DashboardIcon],
  ["list", ListIcon], ["wallet", WalletIcon], ["search", SearchIcon], ["bolt", BoltIcon],
] as const;

const STATUSES: BookingStatus[] = ["CONFIRMED", "PENDING_FEE", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"];
const CARDS: CardVariant[] = ["cream", "white", "green", "yellow", "orange", "blue"];
const TINTS = ["bg-yellow", "bg-orange", "bg-blue", "bg-status-confirmed", "bg-butter", "bg-cream-2"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="font-display text-3xl text-green">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const toast = useToast();
  const [otp, setOtp] = useState("48");
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState<"fee" | "otp" | "both">("both");
  const [view, setView] = useState<"day" | "week">("day");
  const [open, setOpen] = useState<null | "modal" | "sheet">(null);

  return (
    <main id="main" className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-8">
      <header className="space-y-2">
        <Logo />
        <h1 className="font-display text-5xl text-green">Design system</h1>
        <p className="text-muted">Every Phase 1 component and variant, for comparison with /design.</p>
      </header>

      <Section title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(colors).map(([name, hex]) => (
            <div key={name} className="rounded-3xl bg-white p-3 text-xs">
              <div className="mb-2 h-14 rounded-2xl border border-line" style={{ background: hex }} />
              <p className="font-bold">{name}</p>
              <p className="text-muted">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <Card>
          <p className="font-display text-5xl text-green">Book your next grooming</p>
          <p className="font-display text-3xl text-green">₹3,762 · 78%</p>
          <p className="mt-3 text-base">DM Sans 400: Pick your branch, choose your barber.</p>
          <p className="text-base font-medium">DM Sans 500: Steamed towels, classic razor.</p>
          <p className="text-base font-bold">DM Sans 700: Hot Towel Shave · 40 min</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-orange-ink">Popular services</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="space-y-4">
          {(["md", "lg"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <Button size={size}>Primary</Button>
              <Button size={size} variant="secondary">Secondary</Button>
              <Button size={size} variant="accent">Accent</Button>
              <Button size={size} variant="outline">Outline</Button>
              <Button size={size} disabled>Disabled</Button>
              <Button size={size} href="/">Link button <ArrowRightIcon size={18} /></Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="space-y-5">
            <div>
              <Label htmlFor="ds-name">Full name</Label>
              <Input id="ds-name" placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="ds-phone">Mobile number</Label>
              <Input id="ds-phone" prefix="+91" placeholder="98765 43210" inputMode="tel" />
            </div>
            <div>
              <Label htmlFor="ds-err">With error</Label>
              <Input id="ds-err" invalid defaultValue="12345" aria-describedby="ds-err-msg" />
              <p id="ds-err-msg" className="mt-1 text-sm text-orange-ink">Enter a 10-digit mobile number.</p>
            </div>
            <div>
              <Label htmlFor="ds-branch">Branch</Label>
              <Select id="ds-branch" defaultValue="main">
                <option value="main">Main Street</option>
                <option value="station">Station Road</option>
                <option value="lake">Lake View</option>
              </Select>
            </div>
          </Card>
          <Card className="space-y-6">
            <div>
              <Label>OTP input</Label>
              <OtpInput value={otp} onChange={setOtp} />
              <p className="mt-2 text-xs text-muted">Demo code: 4815</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">Toggle</span>
              <Toggle checked={on} onChange={setOn} label="Adjust fee in final bill" />
            </div>
            <div className="flex items-center justify-between rounded-3xl bg-green p-3 text-white">
              <span className="font-bold">Toggle on green</span>
              <Toggle tone="onGreen" checked={on} onChange={setOn} label="Bookings open" />
            </div>
            <div>
              <Label>Segmented (boxes)</Label>
              <SegmentedControl
                label="How customers hold a slot"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "fee", label: "Fee only" },
                  { value: "otp", label: "Phone OTP only" },
                  { value: "both", label: "Customer chooses" },
                ]}
              />
            </div>
            <div>
              <Label>Segmented (pill)</Label>
              <SegmentedControl
                variant="pill"
                label="Calendar view"
                value={view}
                onChange={setView}
                options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]}
              />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Chips and status chips">
        <div className="flex flex-wrap gap-3">
          <Chip>Neutral</Chip>
          <Chip tone="green">Open now</Chip>
          <Chip tone="yellow">OTP verified</Chip>
          <Chip tone="orange">Busy today</Chip>
          <Chip tone="blue">Blue</Chip>
          <span className="rounded-full bg-green p-1"><Chip tone="onGreen">4 branches · open 10 AM – 9 PM</Chip></span>
        </div>
        <div className="flex flex-wrap gap-3">
          {STATUSES.map((s) => <StatusChip key={s} status={s} />)}
          <StatusChip status="CONFIRMED" label="Confirmed · ₹99 paid" />
        </div>
      </Section>

      <Section title="Flower shapes">
        <div className="flex flex-wrap items-center gap-5">
          {TINTS.map((t) => (
            <Flower key={t} tint={t} size={64}><ScissorsIcon className="text-green-dark" /></Flower>
          ))}
          <Flower size={160} tint="bg-yellow">
            <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_40%_35%,#f8dc55,#2a5c4a)] font-display text-4xl text-white">
              BR
            </div>
          </Flower>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((v) => (
            <Card key={v} variant={v}>
              <p className="font-display text-2xl">{v}</p>
              <p className="text-sm opacity-90">Classic Haircut · ₹299 · 30 min</p>
            </Card>
          ))}
          <Card dashed>
            <p className="font-display text-2xl text-green">Dashed</p>
            <p className="text-sm">Haircut + Beard Combo · ₹449</p>
          </Card>
          <Card large variant="green">
            <p className="font-display text-2xl">Large radius (40px)</p>
          </Card>
        </div>
      </Section>

      <Section title="Stepper">
        <div className="space-y-4 rounded-3xl bg-white p-5">
          {[1, 2, 3, 4].map((n) => (
            <Stepper key={n} current={n} />
          ))}
        </div>
      </Section>

      <Section title="Logo">
        <div className="flex flex-wrap gap-4">
          <div className="rounded-3xl bg-white p-6"><Logo className="text-4xl" /></div>
          <div className="rounded-3xl bg-green p-6"><Logo tone="light" className="text-4xl" /></div>
        </div>
      </Section>

      <Section title="Icons">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {ICONS.map(([name, Icon]) => (
            <div key={name} className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 text-green">
              <Icon size={26} />
              <span className="text-xs text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Toast, modal and sheet">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => toast.show({ message: "Booking marked as no-show" })}>Show toast</Button>
          <Button
            variant="secondary"
            onClick={() => toast.show({ message: "Booking moved to 3:00 PM", actionLabel: "Undo", onAction: () => toast.show({ message: "Move undone" }) })}
          >
            Toast with Undo
          </Button>
          <Button variant="outline" onClick={() => setOpen("modal")}>Open modal</Button>
          <Button variant="outline" onClick={() => setOpen("sheet")}>Open sheet</Button>
        </div>
        <Modal open={open === "modal"} onClose={() => setOpen(null)} title="Cancel booking?">
          <p className="mb-5">Your ₹99 fee will be refunded because there are more than 3 hours to go.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOpen(null)}>Keep booking</Button>
            <Button onClick={() => setOpen(null)}>Yes, cancel</Button>
          </div>
        </Modal>
        <Modal open={open === "sheet"} onClose={() => setOpen(null)} title="Booking BR-20481" variant="sheet">
          <p>Sheet: bottom on mobile, right-hand drawer on desktop.</p>
        </Modal>
      </Section>
    </main>
  );
}
