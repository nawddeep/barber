import { computeStats, type Stats } from "../stats";
import { resetDemoData } from "../mock/db";
import type { Branch, BranchService, Settings } from "../types";
import { ApiError, localIso, run } from "./core";

/** Dashboard numbers for one day (and its week). branchId null = all branches. */
export function getStats(range: { date?: string } = {}, branchId: string | null = null): Promise<Stats> {
  return run("getStats", { readOnly: true }, (db, now) =>
    computeStats(db, range.date ?? localIso(now), branchId, now),
  );
}

export function getSettings(): Promise<Settings> {
  return run("getSettings", { readOnly: true }, (db) => db.settings);
}

/** Validates, then saves. New settings apply to new bookings only. */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  // The validation library is only downloaded when someone actually saves.
  const { settingsSchema } = await import("../settings-schema");
  return run("saveSettings", {}, (db) => {
    const parsed = settingsSchema.safeParse({ ...db.settings, ...patch });
    if (!parsed.success) {
      throw new ApiError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid settings", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    db.settings = parsed.data;
    return db.settings;
  });
}

/** Creates or updates a branch (including pausing it) and optionally its service list and price overrides. */
export function saveBranch(branch: Branch, offered?: BranchService[]): Promise<Branch> {
  return run("saveBranch", {}, (db) => {
    if (branch.name.trim().length < 2) throw new ApiError("INVALID_INPUT", "Branch name is required.");
    const i = db.branches.findIndex((b) => b.id === branch.id);
    if (i >= 0) db.branches[i] = branch;
    else db.branches.push(branch);
    if (offered) {
      db.branchServices = [...db.branchServices.filter((bs) => bs.branchId !== branch.id), ...offered];
    }
    return branch;
  });
}

/** "Reset demo data" in the admin footer. */
export function resetDemo(): Promise<void> {
  return run("resetDemo", { readOnly: true }, (_db, now) => {
    resetDemoData(now);
  });
}
