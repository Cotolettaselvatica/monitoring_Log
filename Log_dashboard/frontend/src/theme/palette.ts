/** Palette CATIS (logo) e colori stato macchinari. */
export const catisColors = {
  red: "#E2001A",
  redDark: "#B00015",
  green: "#3AAA35",
  greenDark: "#2E8429",
  ink: "#1F2933",
} as const;

export const statusColors: Record<string, string> = {
  online: catisColors.green,
  warning: "#F5A623",
  error: catisColors.red,
  offline: "#9AA5B1",
};
