import { describe, expect, it } from "vitest";
import { buildIcs, directionsUrl } from "./ics";
import { SEED_BARBERS, SEED_BRANCHES, SEED_SERVICES } from "./mock/seed";
import type { Booking } from "./types";

const booking: Booking = {
  ref: "BR-20481", branchId: "main-street", serviceId: "hot-towel-shave", barberId: "jhon-main-street",
  customer: { name: "Aarav Mehta", phone: "9876543210" },
  startsAt: "2026-10-03T09:00:00.000Z", endsAt: "2026-10-03T10:00:00.000Z",
  status: "CONFIRMED", holdMethod: "FEE", holdExpiresAt: null, priceInr: 499, feeInr: 99,
  createdAt: "2026-10-02T09:00:00.000Z", events: [],
};
const input = {
  booking, branch: SEED_BRANCHES[0], service: SEED_SERVICES[0],
  barber: SEED_BARBERS.find((b) => b.id === "jhon-main-street")!, now: new Date("2026-10-02T12:00:00Z"),
};

describe("buildIcs", () => {
  const ics = buildIcs(input);
  const lines = ics.split("\r\n");

  it("is a well-formed calendar with CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    expect(lines.at(-1)).toBe("");
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(1);
  });
  it("uses UTC times and the real service length, not the padded slot length", () => {
    expect(lines).toContain("DTSTART:20261003T090000Z");
    expect(lines).toContain("DTEND:20261003T094000Z"); // Hot Towel Shave is 40 min (slot is 60)
    expect(lines).toContain("DTSTAMP:20261002T120000Z");
  });
  it("has a stable UID, summary and escaped text", () => {
    expect(lines).toContain("UID:BR-20481@barbr.demo");
    expect(lines).toContain("SUMMARY:Hot Towel Shave at Barbr Main Street");
    expect(ics).toContain("LOCATION:Barbr Main Street\\, 12 Main Street\\, Indiranagar");
  });
  it("folds lines longer than 75 characters", () => {
    expect(lines.every((l) => l.length <= 75)).toBe(true);
  });
});

describe("directionsUrl", () => {
  it("builds a maps search link", () => {
    const url = directionsUrl(SEED_BRANCHES[0]);
    expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(url)).toContain("Barbr Main Street, 12 Main Street");
  });
});
