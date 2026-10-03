import { describe, expect, it } from "vitest";
import { addMinutes } from "date-fns";
import { allowedHoldMethods, dueAtSalon, refundDecision } from "./rules";
import { DEFAULT_SETTINGS } from "./settings-schema";
import type { Payment, Settings } from "./types";

const settings: Settings = { ...DEFAULT_SETTINGS };
const NOW = new Date(2026, 9, 2, 12, 0);
const paid: Payment = { id: "p", bookingRef: "BR-1", amountInr: 99, method: "UPI", status: "PAID", createdAt: NOW.toISOString() };
const startIn = (minutes: number) => ({ startsAt: addMinutes(NOW, minutes).toISOString() });

describe("refundDecision (3-hour window)", () => {
  it("refunds well before the window", () => {
    expect(refundDecision(startIn(24 * 60), paid, settings, NOW)).toEqual({ refund: true, amountInr: 99 });
  });
  it("refunds at exactly 3 hours", () => {
    expect(refundDecision(startIn(180), paid, settings, NOW).refund).toBe(true);
  });
  it("does not refund 1 minute inside the window", () => {
    expect(refundDecision(startIn(179), paid, settings, NOW)).toEqual({ refund: false, amountInr: 0 });
  });
  it("does not refund after the slot has started", () => {
    expect(refundDecision(startIn(-10), paid, settings, NOW).refund).toBe(false);
  });
  it("does not refund when refunds are switched off", () => {
    expect(refundDecision(startIn(600), paid, { ...settings, refundOnEarlyCancel: false }, NOW).refund).toBe(false);
  });
  it("has nothing to refund without a paid fee", () => {
    expect(refundDecision(startIn(600), undefined, settings, NOW).refund).toBe(false);
    expect(refundDecision(startIn(600), { ...paid, status: "REFUNDED" }, settings, NOW).refund).toBe(false);
  });
  it("honours a different window", () => {
    expect(refundDecision(startIn(600), paid, { ...settings, refundWindowHours: 12 }, NOW).refund).toBe(false);
  });
});

describe("allowedHoldMethods", () => {
  it("follows the owner's hold mode", () => {
    expect(allowedHoldMethods({ ...settings, holdMode: "FEE_ONLY" }, 0)).toEqual(["FEE"]);
    expect(allowedHoldMethods({ ...settings, holdMode: "OTP_ONLY" }, 0)).toEqual(["OTP"]);
    expect(allowedHoldMethods({ ...settings, holdMode: "CUSTOMER_CHOOSES" }, 0)).toEqual(["FEE", "OTP"]);
  });
  it("forces the fee after 2 no-shows, even in OTP-only mode", () => {
    expect(allowedHoldMethods({ ...settings, holdMode: "OTP_ONLY" }, 2)).toEqual(["FEE"]);
    expect(allowedHoldMethods(settings, 1)).toEqual(["FEE", "OTP"]);
    expect(allowedHoldMethods(settings, 2)).toEqual(["FEE"]);
  });
  it("ignores no-shows when the rule is switched off", () => {
    expect(allowedHoldMethods({ ...settings, requireFeeAfterNoShowsEnabled: false }, 5)).toEqual(["FEE", "OTP"]);
  });
});

describe("dueAtSalon", () => {
  it("subtracts the fee when it is adjusted in the bill", () => {
    expect(dueAtSalon(499, 99, settings)).toBe(400);
    expect(dueAtSalon(499, 99, { ...settings, adjustFeeInBill: false })).toBe(499);
    expect(dueAtSalon(50, 99, settings)).toBe(0);
  });
});
