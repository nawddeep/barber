import { describe, expect, it } from "vitest";
import { detailsSchema, phoneSchema, type DetailsInput } from "./booking-schema";

const base: DetailsInput = {
  name: "Asha Rao", phone: "9811122233", terms: true, method: "FEE", payTab: "UPI",
  upiId: "asha@okbank", cardNumber: "", cardExpiry: "", cardCvv: "", bank: "",
};
const issues = (v: Partial<DetailsInput>) => {
  const r = detailsSchema.safeParse({ ...base, ...v });
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe("phoneSchema", () => {
  it("accepts 10-digit Indian mobiles starting 6 to 9", () => {
    for (const ok of ["9811122233", "6000000000", "7012345678"]) expect(phoneSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects short, long, non-digit and wrong-prefix numbers", () => {
    for (const bad of ["", "981112223", "98111222334", "98111 22233", "5811122233", "abcdefghij"]) expect(phoneSchema.safeParse(bad).success, bad).toBe(false);
  });
});

describe("detailsSchema", () => {
  it("passes a valid fee booking", () => expect(issues({})).toEqual([]));
  it("needs a name of at least 2 characters", () => {
    expect(issues({ name: "A" })).toEqual(["name"]);
    expect(issues({ name: "  " })).toEqual(["name"]);
    expect(issues({ name: "Al" })).toEqual([]);
  });
  it("needs the terms ticked", () => expect(issues({ terms: false })).toEqual(["terms"]));
  it("checks the UPI id only for UPI", () => {
    expect(issues({ upiId: "nope" })).toEqual(["upiId"]);
    expect(issues({ upiId: "a@b" })).toEqual(["upiId"]);
    expect(issues({ payTab: "NETBANKING", upiId: "", bank: "HDFC Bank" })).toEqual([]);
  });
  it("checks card fields", () => {
    expect(issues({ payTab: "CARD" }).sort()).toEqual(["cardCvv", "cardExpiry", "cardNumber"]);
    expect(issues({ payTab: "CARD", cardNumber: "4111 1111 1111 1111", cardExpiry: "12/29", cardCvv: "123" })).toEqual([]);
    expect(issues({ payTab: "CARD", cardNumber: "4111111111111111", cardExpiry: "13/29", cardCvv: "123" })).toEqual(["cardExpiry"]);
  });
  it("needs a bank for netbanking", () => {
    expect(issues({ payTab: "NETBANKING" })).toEqual(["bank"]);
    expect(issues({ payTab: "NETBANKING", bank: "Axis Bank" })).toEqual([]);
  });
  it("ignores payment fields for an OTP hold", () => {
    expect(issues({ method: "OTP", upiId: "", payTab: "CARD" })).toEqual([]);
  });
});
