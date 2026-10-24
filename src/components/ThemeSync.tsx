"use client";

import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { themeOf } from "@/lib/themes";

/** Keeps the page's colour theme (and the phone's status bar colour) in step with Settings. */
export default function ThemeSync() {
  const theme = useAppState()?.theme;

  useEffect(() => {
    if (theme === undefined) return;
    const t = themeOf(theme);
    document.documentElement.dataset.theme = t.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
  }, [theme]);

  return null;
}
