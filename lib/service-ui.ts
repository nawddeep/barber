import type { Service } from "./types";

/** Background class for a service's flower icon tile (colours from the step 1 screenshot). */
export const SERVICE_TINT: Record<Service["tint"], string> = {
  yellow: "bg-yellow",
  mint: "bg-[#BFE3D0]",
  peach: "bg-[#F5B58B]",
  lavender: "bg-[#BCC7F4]",
  butter: "bg-butter",
};
