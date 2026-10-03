import { describe, expect, it } from "vitest";
import { DEFAULTS, parseFilters, rangeDates, serializeFilters, tabStatuses } from "./filters";

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe("parseFilters", () => {
  it("returns the defaults for an empty URL", () => {
    expect(parse("")).toEqual(DEFAULTS);
  });
  it("reads every filter", () => {
    expect(parse("q=aarav&branch=lake-view&range=custom&from=2026-10-01&to=2026-10-05&status=NO_SHOW&sort=desc&page=3&ref=BR-1")).toEqual({
      q: "aarav", branch: "lake-view", range: "custom", from: "2026-10-01", to: "2026-10-05", tab: "NO_SHOW", sort: "desc", page: 3, ref: "BR-1",
    });
  });
  it("ignores junk", () => {
    expect(parse("range=forever&status=LOL&page=-4&from=yesterday&sort=sideways")).toEqual(DEFAULTS);
    expect(parse("page=abc").page).toBe(1);
  });
});

describe("serializeFilters", () => {
  it("leaves defaults out", () => {
    expect(serializeFilters(DEFAULTS)).toBe("");
    expect(serializeFilters({ ...DEFAULTS, tab: "COMPLETED", q: "rahul" })).toBe("?q=rahul&status=COMPLETED");
  });
  it("round-trips, so a view can be bookmarked", () => {
    const f = { ...DEFAULTS, q: "o'neil & co", branch: "main-street", range: "custom" as const, from: "2026-10-01", to: "2026-10-31", tab: "PENDING_FEE" as const, sort: "desc" as const, page: 2, ref: "BR-20481" };
    expect(parse(serializeFilters(f))).toEqual(f);
  });
  it("only keeps custom dates for the custom range", () => {
    expect(serializeFilters({ ...DEFAULTS, range: "week", from: "2026-10-01", to: "2026-10-02" })).toBe("?range=week");
  });
});

describe("rangeDates", () => {
  const fri = new Date(2026, 9, 2); // Friday 2 Oct 2026
  it("today", () => expect(rangeDates({ range: "today", from: "", to: "" }, fri)).toEqual({ from: "2026-10-02", to: "2026-10-02" }));
  it("this week runs Monday to Sunday", () => expect(rangeDates({ range: "week", from: "", to: "" }, fri)).toEqual({ from: "2026-09-28", to: "2026-10-04" }));
  it("this week on a Sunday still starts the Monday before", () => {
    expect(rangeDates({ range: "week", from: "", to: "" }, new Date(2026, 9, 4))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });
  it("this month", () => expect(rangeDates({ range: "month", from: "", to: "" }, fri)).toEqual({ from: "2026-10-01", to: "2026-10-31" }));
  it("custom uses what was typed, open-ended when empty", () => {
    expect(rangeDates({ range: "custom", from: "2026-10-05", to: "" }, fri)).toEqual({ from: "2026-10-05", to: undefined });
  });
});

describe("tabStatuses", () => {
  it("All has no filter, Confirmed includes in-service", () => {
    expect(tabStatuses("ALL")).toBeUndefined();
    expect(tabStatuses("CONFIRMED")).toEqual(["CONFIRMED", "IN_SERVICE"]);
    expect(tabStatuses("NO_SHOW")).toEqual(["NO_SHOW"]);
  });
});
