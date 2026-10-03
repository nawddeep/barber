import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { addMinutes } from "date-fns";
import { BarberPicker } from "./BarberPicker";
import { DayStrip, type DayItem } from "./DayStrip";
import { ServiceGrid } from "./ServiceGrid";
import { SlotGrid } from "./SlotGrid";
import { SEED_BARBERS, SEED_SERVICES } from "@/lib/mock/seed";
import type { Slot, SlotGroups } from "@/lib/slots";
import { useWizardStore } from "@/lib/wizard/store";

describe("ServiceGrid", () => {
  const services = SEED_SERVICES.map((s) => ({ ...s }));
  it("marks the selected service and reports clicks", () => {
    const onSelect = vi.fn();
    render(<ServiceGrid services={services} selectedId="classic-haircut" onSelect={onSelect} />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: /Classic Haircut/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Beard Trim/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /Beard Trim/ }));
    expect(onSelect).toHaveBeenCalledWith("beard-trim");
  });
  it("shows the branch price it is given", () => {
    render(<ServiceGrid services={[{ ...services[0], priceInr: 449 }]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("₹449")).toBeInTheDocument();
  });
});

const base = new Date(2026, 9, 3, 10, 0);
const slot = (mins: number, available = true): Slot => ({
  startsAt: addMinutes(base, mins).toISOString(),
  endsAt: addMinutes(base, mins + 30).toISOString(),
  group: mins < 120 ? "morning" : mins < 420 ? "afternoon" : "evening",
  available,
  barberId: available ? "jhon-main-street" : null,
  freeBarberIds: available ? ["jhon-main-street"] : [],
});
const groups = (open = true): SlotGroups => ({
  morning: [slot(0), slot(30, false), slot(60)],
  afternoon: [slot(240)],
  evening: open ? [slot(540)] : [slot(540, false)],
});

describe("SlotGrid", () => {
  it("shows a loading state while slots load", () => {
    render(<SlotGrid groups={null} selected={null} onSelect={() => {}} emptyMessage="none" />);
    expect(screen.getByText("Loading slots…")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
  it("groups slots, disables taken ones and marks the selected one", () => {
    const g = groups();
    const onSelect = vi.fn();
    render(<SlotGrid groups={g} selected={g.afternoon[0].startsAt} onSelect={onSelect} emptyMessage="none" />);
    for (const name of ["Morning", "Afternoon", "Evening"]) expect(screen.getByRole("region", { name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:30 AM, unavailable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "2:00 PM" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "10:00 AM" }));
    expect(onSelect).toHaveBeenCalledWith(g.morning[0]);
    fireEvent.click(screen.getByRole("button", { name: "10:30 AM, unavailable" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("announces how many slots are open", () => {
    render(<SlotGrid groups={groups()} selected={null} onSelect={() => {}} emptyMessage="none" />);
    expect(screen.getByText("4 slots available")).toBeInTheDocument();
  });
  it("shows the empty state with a way forward when nothing is open", () => {
    const onNext = vi.fn();
    const none: SlotGroups = { morning: [slot(0, false)], afternoon: [], evening: [] };
    render(<SlotGrid groups={none} selected={null} onSelect={() => {}} emptyMessage="No slots left today, try tomorrow" onTryNextDay={onNext} />);
    expect(screen.getByText("No slots left today, try tomorrow")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try the next day" }));
    expect(onNext).toHaveBeenCalled();
  });
});

describe("DayStrip", () => {
  const days: DayItem[] = [
    { date: "2026-10-02", weekday: "Fri", day: 2, caption: "Today", disabled: false },
    { date: "2026-10-03", weekday: "Sat", day: 3, caption: "9 slots", disabled: false },
    { date: "2026-10-04", weekday: "Sun", day: 4, caption: "Full", disabled: true },
  ];
  it("selects days, skips disabled ones and reports paging", () => {
    const onSelect = vi.fn();
    const onNext = vi.fn();
    render(<DayStrip days={days} selected="2026-10-03" onSelect={onSelect} monthLabel="October 2026" hint="Bookings open 14 days ahead" onNext={onNext} />);
    const strip = screen.getByRole("list", { name: "Choose a day" });
    expect(within(strip).getByRole("button", { name: "Sat 3, 9 slots" })).toHaveAttribute("aria-pressed", "true");
    expect(within(strip).getByRole("button", { name: "Sun 4, Full" })).toBeDisabled();
    fireEvent.click(within(strip).getByRole("button", { name: "Fri 2, Today" }));
    expect(onSelect).toHaveBeenCalledWith("2026-10-02");
    expect(screen.getByRole("button", { name: "Previous 7 days" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next 7 days" }));
    expect(onNext).toHaveBeenCalled();
  });
});

describe("BarberPicker", () => {
  const barbers = SEED_BARBERS.filter((b) => b.branchId === "main-street");
  it("offers any barber plus every barber, with the selection pressed", () => {
    const onSelect = vi.fn();
    render(<BarberPicker barbers={barbers} selected="any" onSelect={onSelect} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Any barber/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Kabir Khan/ }));
    expect(onSelect).toHaveBeenCalledWith("kabir-main-street");
  });
});

describe("wizard store", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });
  it("clears barber and time when the branch changes", () => {
    const s = useWizardStore.getState();
    s.setBranch("main-street");
    s.setService("classic-haircut");
    s.setBarber("kabir-main-street");
    s.setSlot("2026-10-03T10:00:00.000Z", "kabir-main-street");
    s.setBranch("lake-view");
    expect(useWizardStore.getState()).toMatchObject({ branchId: "lake-view", barberId: "any", startsAt: null, assignedBarberId: null, serviceId: "classic-haircut" });
  });
  it("keeps the slot when the same branch is chosen again, but clears it when the service or date changes", () => {
    const s = useWizardStore.getState();
    s.setBranch("main-street");
    s.setService("classic-haircut");
    s.setSlot("2026-10-03T10:00:00.000Z", "a");
    s.setBranch("main-street");
    expect(useWizardStore.getState().startsAt).not.toBeNull();
    s.setService("beard-trim");
    expect(useWizardStore.getState().startsAt).toBeNull();
    s.setSlot("2026-10-03T10:00:00.000Z", "a");
    s.setDate("2026-10-04");
    expect(useWizardStore.getState().startsAt).toBeNull();
  });
  it("persists to sessionStorage", () => {
    useWizardStore.getState().setBranch("station-road");
    expect(JSON.parse(sessionStorage.getItem("barbr-wizard-v1")!).state.branchId).toBe("station-road");
  });
});
