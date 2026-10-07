// Charte FreePaws, alignée sur www.freepaws.be.
export const colors = {
  cream: "#faf1e7",
  creamAlt: "#fdfaef",
  ink: "#2b3a30",
  inkSoft: "#4a5c4c",
  olive: "#6c7746",
  brass: "#a3823f",
  /** Laiton assombri pour le petit texte (contraste AA sur crème). */
  brassText: "#7a5f2a",
  line: "rgba(43, 58, 48, 0.16)",
  white: "#ffffff",
  danger: "#9c3a2e",
  dangerSoft: "#f6e3df",
  free: "#4c7a47",
  freeSoft: "#e3eedc",
  reserved: "#a3823f",
  reservedSoft: "#f3e8d2",
  closed: "#7c837b",
  closedSoft: "#ebe8e2",
} as const;

export const fonts = {
  serif: "Fraunces_500Medium",
  serifRegular: "Fraunces_400Regular",
  sans: "WorkSans_400Regular",
  sansMedium: "WorkSans_500Medium",
  sansSemiBold: "WorkSans_600SemiBold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 18, pill: 999 } as const;
