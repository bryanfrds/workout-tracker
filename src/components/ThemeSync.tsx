"use client";

import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { THEME_KEY, statusBarStyle, themeOf } from "@/lib/themes";

/** Keeps the page's colour theme (and the phone's status bar colour) in step with Settings. */
export default function ThemeSync() {
  const theme = useAppState()?.theme;

  useEffect(() => {
    if (theme === undefined) return;
    const t = themeOf(theme);
    document.documentElement.dataset.theme = t.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
    // iPhone reads this when the installed app launches, so it applies from the next open.
    document
      .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute("content", statusBarStyle(t.id));
    try {
      localStorage.setItem(THEME_KEY, t.id);
    } catch {
      // Storage blocked: the theme still applies for this visit.
    }
  }, [theme]);

  return null;
}
