import { z } from "zod";

/** "10:30" -> 630 */
export function timeToMin(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
}

/** 630 -> "10:30" (what <input type="time"> uses) */
export const minToTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const half = (n: number) => n % 30 === 0;

const dayHours = z
  .object({ open: z.number().int(), close: z.number().int() })
  .nullable()
  .superRefine((d, ctx) => {
    if (!d) return;
    if (!half(d.open) || !half(d.close)) ctx.addIssue({ code: "custom", message: "Use whole or half hours (like 10:00 or 10:30)" });
    else if (d.open < 0 || d.close > 1440) ctx.addIssue({ code: "custom", message: "Times must be within one day" });
    else if (d.close <= d.open) ctx.addIssue({ code: "custom", message: "Closing time must be after opening time" });
  });

const breakTime = z
  .object({ startMin: z.number().int(), endMin: z.number().int() })
  .superRefine((b, ctx) => {
    if (Number.isNaN(b.startMin) || Number.isNaN(b.endMin)) ctx.addIssue({ code: "custom", message: "Enter both times" });
    else if (b.endMin <= b.startMin) ctx.addIssue({ code: "custom", message: "A break must end after it starts" });
  });

/** Everything the "Manage branch" drawer edits, in one object. weekHours index 0 is Sunday (like date-fns getDay). */
export const branchConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the branch name").max(40, "Keep the name under 40 characters"),
  address: z.string().trim().min(3, "Enter the address").max(120, "Keep the address under 120 characters"),
  phone: z.string().trim().regex(/^\+?[\d\s-]{8,16}$/, "Enter a valid phone number"),
  weekHours: z.array(dayHours).length(7).refine((d) => d.some(Boolean), "Open at least one day"),
  services: z
    .array(
      z.object({
        serviceId: z.string(),
        priceOverrideInr: z
          .number({ error: "Enter a whole number" })
          .int("Whole rupees only")
          .min(1, "Minimum ₹1")
          .max(10000, "Maximum ₹10,000")
          .optional(),
      }),
    )
    .min(1, "Offer at least one service"),
  team: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2, "Enter the barber's name").max(40),
      specialty: z.string().trim().max(40, "Keep it under 40 characters"),
      breaks: z.array(breakTime),
    }),
  ),
});

export type BranchConfigInput = z.infer<typeof branchConfigSchema>;

/** Issues as a map from "team.0.breaks.1"-style paths to the first message at that path. */
export function issueMap(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    out[key] ??= i.message;
  }
  return out;
}
