import { describe, expect, it } from "vitest";
import { canTransition, eventTypeFor, transitionError, TRANSITIONS } from "./transitions";
import type { BookingStatus } from "./types";

const ALL: BookingStatus[] = ["PENDING_FEE", "CONFIRMED", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"];

describe("status transitions", () => {
  it("allows the normal life of a booking", () => {
    expect(canTransition("PENDING_FEE", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "IN_SERVICE")).toBe(true);
    expect(canTransition("IN_SERVICE", "COMPLETED")).toBe(true);
    expect(canTransition("CONFIRMED", "NO_SHOW")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("PENDING_FEE", "CANCELLED")).toBe(true);
  });
  it("never leaves a final status", () => {
    for (const from of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
      for (const to of ALL) expect(canTransition(from, to), `${from} to ${to}`).toBe(false);
      expect(TRANSITIONS[from]).toEqual([]);
    }
  });
  it("never goes backwards or skips the fee", () => {
    expect(canTransition("COMPLETED", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "PENDING_FEE")).toBe(false);
    expect(canTransition("IN_SERVICE", "CANCELLED")).toBe(false);
    expect(canTransition("IN_SERVICE", "NO_SHOW")).toBe(false);
    expect(canTransition("PENDING_FEE", "NO_SHOW")).toBe(false);
    expect(canTransition("PENDING_FEE", "COMPLETED")).toBe(false);
  });
  it("explains blocked changes in plain words", () => {
    expect(transitionError("COMPLETED", "CONFIRMED")).toBe("A completed booking cannot become confirmed.");
    expect(transitionError("NO_SHOW", "CANCELLED")).toBe("A no-show booking cannot become cancelled.");
    expect(transitionError("CONFIRMED", "CONFIRMED")).toBe("This booking is already confirmed.");
    expect(transitionError("CONFIRMED", "NO_SHOW")).toBeNull();
  });
  it("maps statuses to timeline events", () => {
    expect(eventTypeFor("NO_SHOW")).toBe("NO_SHOW");
    expect(eventTypeFor("COMPLETED")).toBe("COMPLETED");
    expect(eventTypeFor("CONFIRMED")).toBe("CONFIRMED");
  });
});
