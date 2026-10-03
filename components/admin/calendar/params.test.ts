import { describe, expect, it } from "vitest";
import { CAL_DEFAULTS, parseCalParams, serializeCalParams, shiftDate } from "./params";

const parse = (qs: string) => parseCalParams(new URLSearchParams(qs));

describe("calendar URL params", () => {
  it("defaults to the day view with nothing chosen", () => expect(parse("")).toEqual(CAL_DEFAULTS));
  it("reads every param", () => {
    expect(parse("branch=lake-view&view=week&date=2026-10-05&barber=kabir-lake-view&ref=BR-1")).toEqual({
      branch: "lake-view", view: "week", date: "2026-10-05", barber: "kabir-lake-view", ref: "BR-1",
    });
  });
  it("ignores bad dates and views", () => {
    expect(parse("date=tomorrow&view=month").date).toBe("");
    expect(parse("date=2026-13-45").date).toBe("");
    expect(parse("view=month").view).toBe("day");
  });
  it("round-trips, leaving out today and defaults", () => {
    const p = { branch: "main-street", view: "week" as const, date: "2026-10-05", barber: "jhon-main-street", ref: "BR-20481" };
    expect(parse(serializeCalParams(p, "2026-10-02"))).toEqual(p);
    expect(serializeCalParams({ ...CAL_DEFAULTS, date: "2026-10-02" }, "2026-10-02")).toBe("");
    expect(serializeCalParams({ ...CAL_DEFAULTS, barber: "x" }, "2026-10-02")).toBe(""); // barber only matters in week view
  });
  it("steps by a day or a week, across month ends", () => {
    expect(shiftDate("2026-10-31", "day", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-10-01", "day", -1)).toBe("2026-09-30");
    expect(shiftDate("2026-10-02", "week", 1)).toBe("2026-10-09");
    expect(shiftDate("2026-10-02", "week", -1)).toBe("2026-09-25");
  });
});
