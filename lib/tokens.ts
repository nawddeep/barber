// Mirrors the @theme block in app/globals.css (Tailwind v4 reads tokens from CSS).
export const colors = {
  green: "#2A5C4A",
  greenDark: "#1E4536",
  yellow: "#F8DC55",
  butter: "#FFF79F",
  orange: "#E8732A",
  orangeInk: "#B84E0C",
  cream: "#FBF7F0",
  cream2: "#F3ECDD",
  admin: "#F6F1E6",
  ink: "#1B2B25",
  muted: "#5E7068",
  blue: "#3F6FE0",
  line: "#E6DDCA",
  greenSoft: "#3B6B55",
  mutedStrong: "#4A5C54",
  orangeInkStrong: "#9A4209",
  peach: "#FBDDD0",
  periwinkle: "#DDE6FA",
  sun: "#FAF0A0",
} as const;

export const statusColors = {
  CONFIRMED: { bg: "#BFE3D0", text: "#14382A" },
  PENDING_FEE: { bg: "#FFF79F", text: "#4A3F00" },
  IN_SERVICE: { bg: "#F5B58B", text: "#4A1D04" },
  COMPLETED: { bg: "#E6E0D0", text: "#3A3626" },
  CANCELLED: { bg: "#FBE0D4", text: "#7A3306" },
  NO_SHOW: { bg: "#FBE0D4", text: "#7A3306" },
} as const;

export const radii = { card: 32, input: 18 } as const;
