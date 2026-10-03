import type { BranchConfigInput } from "../branch-schema";
import { computeStats } from "../stats";
import type { Barber, BarberBreak, Branch, BranchService, Service } from "../types";
import { ApiError, localIso, run } from "./core";

export interface BranchSummary {
  branch: Branch;
  barberCount: number;
  bookingsToday: number;
  feesTodayInr: number;
}

/** One card per branch on "Branches & fees". Today's numbers are the same ones the dashboard shows. */
export function listBranchSummaries(): Promise<BranchSummary[]> {
  return run("listBranchSummaries", { readOnly: true }, (db, now) =>
    db.branches.map((branch) => {
      const s = computeStats(db, localIso(now), branch.id, now);
      return {
        branch,
        barberCount: db.barbers.filter((b) => b.branchId === branch.id && !b.retired).length,
        bookingsToday: s.todayBookings,
        feesTodayInr: s.feesCollectedInr,
      };
    }),
  );
}

export interface BranchDetail {
  branch: Branch;
  /** Every service the business sells, at its standard price. */
  services: Service[];
  /** Which of them this branch offers, with optional price overrides. */
  offered: BranchService[];
  team: Array<{ barber: Barber; breaks: BarberBreak[] }>;
}

export function getBranchDetail(branchId: string): Promise<BranchDetail> {
  return run("getBranchDetail", { readOnly: true }, (db) => {
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch) throw new ApiError("NOT_FOUND", "Unknown branch.");
    return {
      branch,
      services: db.services,
      offered: db.branchServices.filter((bs) => bs.branchId === branchId),
      team: db.barbers
        .filter((b) => b.branchId === branchId && !b.retired)
        .map((barber) => ({ barber, breaks: db.breaks.filter((k) => k.barberId === barber.id) })),
    };
  });
}

/** Turns bookings on or off for a branch. Paused branches leave the public branch list; existing bookings stay. */
export function setBranchPaused(input: { branchId: string; paused: boolean }): Promise<Branch> {
  return run("setBranchPaused", {}, (db) => {
    const branch = db.branches.find((b) => b.id === input.branchId);
    if (!branch) throw new ApiError("NOT_FOUND", "Unknown branch.");
    branch.paused = input.paused;
    return branch;
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

/**
 * Creates or updates a branch with its hours, services, price overrides, barbers and breaks in one go.
 * Everything is checked first, so a mistake changes nothing. A barber with upcoming bookings cannot be removed.
 */
export async function saveBranchConfig(input: BranchConfigInput): Promise<Branch> {
  const { branchConfigSchema } = await import("../branch-schema");
  return run("saveBranchConfig", {}, (db, now) => {
    const parsed = branchConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new ApiError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Check the branch details.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const cfg = parsed.data;
    const existing = cfg.id ? db.branches.find((b) => b.id === cfg.id) : undefined;
    if (cfg.id && !existing) throw new ApiError("NOT_FOUND", "Unknown branch.");
    for (const s of cfg.services) {
      if (!db.services.some((x) => x.id === s.serviceId)) throw new ApiError("INVALID_INPUT", "Unknown service.");
    }

    let id = existing?.id;
    if (!id) {
      const base = slug(cfg.name);
      id = base;
      for (let n = 2; db.branches.some((b) => b.id === id); n++) id = `${base}-${n}`;
    }

    // Barbers: who is staying, who is new, who is leaving.
    const current = db.barbers.filter((b) => b.branchId === id && !b.retired);
    const keepIds = new Set(cfg.team.flatMap((m) => (m.id ? [m.id] : [])));
    for (const m of cfg.team) {
      if (m.id && !current.some((b) => b.id === m.id)) throw new ApiError("INVALID_INPUT", "That barber does not work at this branch.");
    }
    for (const b of current.filter((x) => !keepIds.has(x.id))) {
      const upcoming = db.bookings.filter(
        (x) => x.barberId === b.id && new Date(x.startsAt) >= now && ["PENDING_FEE", "CONFIRMED", "IN_SERVICE"].includes(x.status),
      ).length;
      if (upcoming > 0) {
        throw new ApiError("INVALID_STATE", `${b.name} has ${upcoming} upcoming ${upcoming === 1 ? "booking" : "bookings"}. Move or cancel them before removing ${b.name.split(" ")[0]}.`);
      }
    }

    const branch: Branch = { id, name: cfg.name, address: cfg.address, phone: cfg.phone, weekHours: cfg.weekHours, paused: existing?.paused ?? false };
    if (existing) db.branches[db.branches.indexOf(existing)] = branch;
    else db.branches.push(branch);

    db.branchServices = [
      ...db.branchServices.filter((bs) => bs.branchId !== id),
      ...cfg.services.map((s): BranchService => ({ branchId: id, serviceId: s.serviceId, ...(s.priceOverrideInr ? { priceOverrideInr: s.priceOverrideInr } : {}) })),
    ];

    // Retire leavers (history keeps their names), update stayers, add newcomers.
    for (const b of current.filter((x) => !keepIds.has(x.id))) b.retired = true;
    for (const m of cfg.team) {
      let barber = m.id ? db.barbers.find((b) => b.id === m.id)! : undefined;
      if (barber) {
        barber.name = m.name;
        barber.specialty = m.specialty;
      } else {
        const base = `${slug(m.name.split(" ")[0])}-${id}`;
        let bid = base;
        for (let n = 2; db.barbers.some((b) => b.id === bid); n++) bid = `${base}-${n}`;
        barber = { id: bid, name: m.name, specialty: m.specialty, rating: 4.5, branchId: id };
        db.barbers.push(barber);
      }
      db.breaks = db.breaks.filter((k) => k.barberId !== barber.id);
      m.breaks.forEach((k, i) => db.breaks.push({ id: `brk-${barber.id}-${i + 1}`, barberId: barber.id, startMin: k.startMin, endMin: k.endMin }));
    }
    // Breaks of barbers who left are no longer needed.
    const gone = new Set(current.filter((x) => !keepIds.has(x.id)).map((x) => x.id));
    db.breaks = db.breaks.filter((k) => !gone.has(k.barberId));
    return branch;
  });
}
