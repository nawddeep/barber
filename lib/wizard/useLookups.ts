"use client";

import { getSettings, listBarbers, listBranches, listServices } from "@/lib/api";
import { useApi } from "@/lib/hooks/useApi";
import { SEED_BARBERS, SEED_BRANCHES, SEED_SERVICES } from "@/lib/mock/seed";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import type { Settings } from "@/lib/types";
import { dueAtSalon } from "@/lib/rules";

/** Names, prices and settings the booking summary needs, for the selected branch. */
export function useLookups(branchId: string | null, serviceId: string | null) {
  const branches = useApi("wz-branches", () => listBranches({ includePaused: true }), SEED_BRANCHES).data;
  const services = useApi(`wz-services:${branchId ?? ""}`, () => listServices(branchId ?? undefined), SEED_SERVICES).data;
  const barbers = useApi(
    `wz-barbers:${branchId ?? ""}`,
    () => (branchId ? listBarbers(branchId) : Promise.resolve([])),
    SEED_BARBERS.filter((b) => b.branchId === branchId),
  ).data;
  const settingsQ = useApi("wz-settings", () => getSettings(), DEFAULT_SETTINGS as Settings);
  const settings = settingsQ.data;

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const service = services.find((s) => s.id === serviceId) ?? null;
  const dueNow = dueAtSalon(service?.priceInr ?? 0, settings.feeInr, settings);
  return { branches, branch, services, service, barbers, settings, settingsLoaded: settingsQ.loaded, dueAtSalon: dueNow };
}
