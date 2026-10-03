import { z } from "zod";

export const settingsSchema = z.object({
  feeInr: z
    .number({ error: "Enter a whole number" })
    .int("Whole rupees only")
    .min(0, "Minimum ₹0")
    .max(2000, "Maximum ₹2,000"),
  holdMode: z.enum(["FEE_ONLY", "OTP_ONLY", "CUSTOMER_CHOOSES"], { error: "Choose how customers hold a slot" }),
  adjustFeeInBill: z.boolean(),
  refundOnEarlyCancel: z.boolean(),
  refundWindowHours: z
    .number({ error: "Enter the number of hours" })
    .int("Whole hours only")
    .min(0, "Minimum 0 hours")
    .max(72, "Maximum 72 hours"),
  unpaidHoldMinutes: z.union([z.literal(10), z.literal(15), z.literal(30)], { error: "Choose 10, 15 or 30 minutes" }),
  advanceBookingDays: z.number().int().min(1).max(60),
  requireFeeAfterNoShowsEnabled: z.boolean(),
  requireFeeAfterNoShows: z
    .number({ error: "Enter a number" })
    .int("Whole numbers only")
    .min(1, "At least 1")
    .max(10, "At most 10"),
});

export { DEFAULT_SETTINGS } from "./default-settings";
