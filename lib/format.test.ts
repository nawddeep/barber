import { describe, expect, it } from "vitest";
import { bookingQuery, branchHours, formatMinutes, inr, openDays, relativeSlot } from "./format";
import { SEED_BRANCHES } from "./mock/seed";

describe("format", () => {
  it("formats minutes after midnight", () => {
    expect(formatMinutes(600)).toBe("10 AM");
    expect(formatMinutes(1260)).toBe("9 PM");
    expect(formatMinutes(750)).toBe("12:30 PM");
    expect(formatMinutes(0)).toBe("12 AM");
  });
  it("formats rupees", () => {
    expect(inr(499)).toBe("₹499");
    expect(inr(1584)).toBe("₹1,584");
  });
  it("describes branch hours and days", () => {
    expect(branchHours(SEED_BRANCHES[0])).toBe("10 AM – 9 PM");
    expect(branchHours(SEED_BRANCHES[3])).toBe("11 AM – 10 PM");
    expect(openDays(SEED_BRANCHES[0])).toBe("Mon to Sun");
  });
  it("builds a booking query and skips empty values", () => {
    expect(bookingQuery({ branch: "main-street", service: "", date: "2026-10-03" })).toBe("?branch=main-street&date=2026-10-03");
    expect(bookingQuery({})).toBe("");
  });
  it("labels slots relative to today", () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
    expect(relativeSlot(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 30).toISOString())).toBe("Today, 2:30 PM");
    expect(relativeSlot(tomorrow.toISOString())).toBe("Tomorrow, 10:00 AM");
  });
});
