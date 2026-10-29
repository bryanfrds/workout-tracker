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

/** Small separate key so the pre-paint script doesn't parse all workout history. */
export const THEME_KEY = "workout-tracker:theme";

/**
 * Light needs dark status-bar text on iPhone; the others need white.
 *
 * Deliberately not "black-translucent": under it iOS hands the installed app a
 * window the full screen height minus the status bar, but still positions it at
 * the top — leaving a dead strip the height of the status bar below the tab bar.
 */
export const statusBarStyle = (id: string | undefined): "default" | "black" =>
  id === "light" ? "default" : "black";

/**
 * The script the layout runs before first paint, so the saved theme applies
 * without a colour flash. Built from THEMES rather than written out by hand, so
 * it can't drift from the real themes.
 *
 * The status bar is opaque, so iPhone paints it with theme-color — which means
 * that meta has to be right before the page is shown, not after it hydrates.
 */
export function themeScript(): string {
  const themes = JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, [t.bg, statusBarStyle(t.id)]])))
    // Inlined in a <script>, where "</script" inside a string would end the tag.
    .replace(/</g, "\\u003c");
  return `try{var B=${themes};var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var v=B[t];if(Array.isArray(v)){document.documentElement.dataset.theme=t;var c=document.querySelector('meta[name="theme-color"]');if(c)c.content=v[0];var m=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(m)m.content=v[1]}}catch(e){}`;
}
