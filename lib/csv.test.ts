import { describe, expect, it } from "vitest";
import { bookingsToCsv, csvCell, toCsv, BOOKING_CSV_HEADER } from "./csv";
import type { BookingRow } from "./api/bookings";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Rahul Sharma")).toBe("Rahul Sharma");
    expect(csvCell(499)).toBe("499");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("defuses spreadsheet formulas", () => {
    for (const evil of ["=HYPERLINK(\"x\")", "+1+1", "-2+3", "@SUM(A1)"]) expect(csvCell(evil).startsWith("'") || csvCell(evil).startsWith('"\'')).toBe(true);
    expect(csvCell("=1+1")).toBe("'=1+1");
  });
  it("does not touch real negative numbers", () => {
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("joins with CRLF and no trailing newline", () => {
    expect(toCsv([["a", "b"], [1, "c,d"]])).toBe('a,b\r\n1,"c,d"');
  });
});

const row = (over: Partial<BookingRow> = {}): BookingRow => ({
  ref: "BR-20481", branchId: "main-street", serviceId: "hot-towel-shave", barberId: "jhon-main-street",
  customer: { name: "Aarav Mehta", phone: "9876543210" }, startsAt: new Date(2026, 9, 3, 14, 30).toISOString(),
  endsAt: new Date(2026, 9, 3, 15, 30).toISOString(), status: "CONFIRMED", holdMethod: "FEE", holdExpiresAt: null,
  priceInr: 499, feeInr: 99, createdAt: "", events: [], serviceName: "Hot Towel Shave", barberName: "Jhon Abraham",
  branchName: "Main Street", paymentStatus: "PAID", paymentMethod: "UPI", ...over,
});

describe("bookingsToCsv", () => {
  it("has a header and one line per booking, with full phone numbers", () => {
    const csv = bookingsToCsv([row(), row({ ref: "BR-2", holdMethod: "NONE", feeInr: 0, paymentStatus: null, customer: { name: "=Evil", phone: "9000000000" } })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(BOOKING_CSV_HEADER.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("BR-20481,Aarav Mehta,9876543210,Hot Towel Shave,Jhon Abraham,Main Street,2026-10-03,2:30 PM,CONFIRMED,Fee,499,99,PAID");
    expect(lines[2]).toContain("'=Evil");
    expect(lines[2]).toContain("Walk-in,499,0,None");
  });
  it("is just the header for no bookings", () => {
    expect(bookingsToCsv([])).toBe(BOOKING_CSV_HEADER.join(","));
  });
});
