import { z } from "zod";
import { INDIAN_MOBILE } from "./phone";

export const phoneSchema = z.string().regex(INDIAN_MOBILE, "Enter a valid 10-digit mobile number");

export const PAY_TABS = ["UPI", "CARD", "NETBANKING"] as const;
export type PayTab = (typeof PAY_TABS)[number];

export const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank"];

const shape = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: phoneSchema,
  terms: z.boolean().refine((v) => v, "Please accept the cancellation policy"),
  method: z.enum(["FEE", "OTP"]),
  payTab: z.enum(PAY_TABS),
  // MOCK: payment fields are validated for look and feel only. Nothing is sent anywhere.
  upiId: z.string().trim(),
  cardNumber: z.string(),
  cardExpiry: z.string(),
  cardCvv: z.string(),
  bank: z.string(),
});

/** Name, phone and terms always apply. Payment fields only matter when paying the fee. */
export const detailsSchema = shape.superRefine((v, ctx) => {
  if (v.method !== "FEE") return;
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.payTab === "UPI" && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(v.upiId)) add("upiId", "Enter a UPI ID like name@bank");
  if (v.payTab === "CARD") {
    if (!/^\d{16}$/.test(v.cardNumber.replace(/\s/g, ""))) add("cardNumber", "Enter the 16-digit card number");
    const m = /^(\d{2})\/(\d{2})$/.exec(v.cardExpiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) add("cardExpiry", "Use MM/YY");
    if (!/^\d{3,4}$/.test(v.cardCvv)) add("cardCvv", "3 or 4 digits");
  }
  if (v.payTab === "NETBANKING" && !v.bank) add("bank", "Choose your bank");
});

export type DetailsInput = z.infer<typeof shape>;
