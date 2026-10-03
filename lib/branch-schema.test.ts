import { describe, expect, it } from "vitest";
import { branchConfigSchema, issueMap, minToTime, timeToMin, type BranchConfigInput } from "./branch-schema";
import { DEFAULT_SETTINGS, settingsSchema } from "./settings-schema";

const day = { open: 600, close: 1260 };
const valid: BranchConfigInput = {
  name: "Station Road", address: "4 Station Road", phone: "+91 80000 10002",
  weekHours: [day, day, day, day, day, day, day],
  services: [{ serviceId: "classic-haircut" }, { serviceId: "beard-trim", priceOverrideInr: 249 }],
  team: [{ name: "Arjun Mehta", specialty: "Styling", breaks: [{ startMin: 780, endMin: 840 }] }],
};
const problems = (over: Partial<BranchConfigInput>) => {
  const r = branchConfigSchema.safeParse({ ...valid, ...over });
  return r.success ? {} : issueMap(r.error.issues);
};

describe("time helpers", () => {
  it("converts both ways", () => {
    expect(timeToMin("10:30")).toBe(630);
    expect(timeToMin("00:00")).toBe(0);
    expect(timeToMin("21:00")).toBe(1260);
    expect(Number.isNaN(timeToMin(""))).toBe(true);
    expect(minToTime(630)).toBe("10:30");
    expect(minToTime(1260)).toBe("21:00");
    expect(minToTime(5)).toBe("00:05");
  });
});

describe("branchConfigSchema", () => {
  it("accepts a good branch", () => expect(problems({})).toEqual({}));
  it("needs a name, an address and a phone number", () => {
    expect(problems({ name: " " }).name).toBe("Enter the branch name");
    expect(problems({ address: "" }).address).toBe("Enter the address");
    expect(problems({ phone: "abc" }).phone).toBe("Enter a valid phone number");
    expect(problems({ phone: "080-1234 5678" })).toEqual({});
  });
  it("checks each day's opening hours", () => {
    const hours = [...valid.weekHours];
    hours[3] = { open: 1260, close: 600 };
    expect(problems({ weekHours: hours })["weekHours.3"]).toBe("Closing time must be after opening time");
    hours[3] = { open: 615, close: 1260 };
    expect(problems({ weekHours: hours })["weekHours.3"]).toBe("Use whole or half hours (like 10:00 or 10:30)");
    hours[3] = { open: 600, close: 1500 };
    expect(problems({ weekHours: hours })["weekHours.3"]).toBe("Times must be within one day");
  });
  it("lets some days be closed, but not all of them", () => {
    expect(problems({ weekHours: [null, day, day, day, day, day, day] })).toEqual({});
    expect(problems({ weekHours: [null, null, null, null, null, null, null] }).weekHours).toBe("Open at least one day");
  });
  it("needs at least one service, and sensible price overrides", () => {
    expect(problems({ services: [] }).services).toBe("Offer at least one service");
    expect(problems({ services: [{ serviceId: "x", priceOverrideInr: 0 }] })["services.0.priceOverrideInr"]).toBe("Minimum ₹1");
    expect(problems({ services: [{ serviceId: "x", priceOverrideInr: 9.5 }] })["services.0.priceOverrideInr"]).toBe("Whole rupees only");
    expect(problems({ services: [{ serviceId: "x", priceOverrideInr: 10001 }] })["services.0.priceOverrideInr"]).toBe("Maximum ₹10,000");
    expect(problems({ services: [{ serviceId: "x", priceOverrideInr: Number.NaN }] })["services.0.priceOverrideInr"]).toBe("Enter a whole number");
  });
  it("checks barbers and their breaks", () => {
    expect(problems({ team: [{ name: "A", specialty: "", breaks: [] }] })["team.0.name"]).toBe("Enter the barber's name");
    expect(problems({ team: [{ name: "Asha", specialty: "", breaks: [{ startMin: 900, endMin: 900 }] }] })["team.0.breaks.0"]).toBe("A break must end after it starts");
    expect(problems({ team: [{ name: "Asha", specialty: "", breaks: [{ startMin: 900, endMin: 840 }] }] })["team.0.breaks.0"]).toBe("A break must end after it starts");
    expect(problems({ team: [{ name: "Asha", specialty: "Fades", breaks: [] }] })).toEqual({});
    expect(problems({ team: [] })).toEqual({}); // a new branch can start with no barbers
  });
});

describe("settingsSchema (fee rules)", () => {
  const issues = (over: Record<string, unknown>) => {
    const r = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...over });
    return r.success ? {} : issueMap(r.error.issues);
  };
  it("accepts the defaults", () => expect(issues({})).toEqual({}));
  it("keeps the fee a whole number from 0 to 2000", () => {
    expect(issues({ feeInr: 0 })).toEqual({});
    expect(issues({ feeInr: 2000 })).toEqual({});
    expect(issues({ feeInr: 2001 }).feeInr).toBe("Maximum ₹2,000");
    expect(issues({ feeInr: -1 }).feeInr).toBe("Minimum ₹0");
    expect(issues({ feeInr: 99.5 }).feeInr).toBe("Whole rupees only");
    expect(issues({ feeInr: Number.NaN }).feeInr).toBe("Enter a whole number");
    expect(issues({ feeInr: "99" }).feeInr).toBe("Enter a whole number");
  });
  it("limits the refund window to 0 to 72 whole hours", () => {
    expect(issues({ refundWindowHours: 0 })).toEqual({});
    expect(issues({ refundWindowHours: 72 })).toEqual({});
    expect(issues({ refundWindowHours: 73 }).refundWindowHours).toBe("Maximum 72 hours");
    expect(issues({ refundWindowHours: 1.5 }).refundWindowHours).toBe("Whole hours only");
    expect(issues({ refundWindowHours: Number.NaN }).refundWindowHours).toBe("Enter the number of hours");
  });
  it("limits the no-show count to 1 to 10", () => {
    expect(issues({ requireFeeAfterNoShows: 1 })).toEqual({});
    expect(issues({ requireFeeAfterNoShows: 0 }).requireFeeAfterNoShows).toBe("At least 1");
    expect(issues({ requireFeeAfterNoShows: 11 }).requireFeeAfterNoShows).toBe("At most 10");
  });
  it("only allows 10, 15 or 30 minute holds and the three hold modes", () => {
    for (const m of [10, 15, 30]) expect(issues({ unpaidHoldMinutes: m })).toEqual({});
    expect(issues({ unpaidHoldMinutes: 20 }).unpaidHoldMinutes).toBe("Choose 10, 15 or 30 minutes");
    expect(issues({ holdMode: "EITHER" }).holdMode).toBe("Choose how customers hold a slot");
  });
});
