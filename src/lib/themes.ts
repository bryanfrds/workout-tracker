/** Colour themes. Values live in globals.css under [data-theme=...]; this is the list for Settings. */
export const THEMES = [
  { id: "ocean", label: "Ocean", bg: "#07111f", card: "#0f1d31", accent: "#38bdf8" },
  { id: "lime", label: "Lime", bg: "#0b0b0d", card: "#1a1a1f", accent: "#c6ff3d" },
  { id: "ember", label: "Ember", bg: "#0e0a08", card: "#1c1512", accent: "#ff7a1a" },
  { id: "grape", label: "Grape", bg: "#0d0a14", card: "#1a1526", accent: "#a78bfa" },
  { id: "rose", label: "Rose", bg: "#120a0d", card: "#21141a", accent: "#fb7185" },
  { id: "mono", label: "Mono", bg: "#0a0a0a", card: "#171717", accent: "#fafafa" },
  { id: "light", label: "Light", bg: "#f4f4f6", card: "#ffffff", accent: "#4f46e5" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "ocean";

export function themeOf(id: string | undefined) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
