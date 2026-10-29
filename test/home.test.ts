import { describe, expect, it } from "vitest";
import { HYROX_ROUTINES } from "@/lib/hyrox";
import { dayActions, dayFromParam, upcomingDays } from "@/lib/plans";
import { DEFAULT_THEME, THEMES, statusBarStyle, themeOf, themeScript } from "@/lib/themes";
import { routineMeta } from "@/lib/workout";

const byId = (id: string) => HYROX_ROUTINES.find((r) => r.id === id)!;

describe("upcomingDays", () => {
  it("lists the next three days", () => {
    expect(upcomingDays(1)).toEqual([2, 3, 4]);
  });

  it("stops at Sunday instead of wrapping into days already past", () => {
    expect(upcomingDays(6)).toEqual([7]);
    expect(upcomingDays(7)).toEqual([]);
  });
});

describe("dayFromParam", () => {
  it("uses a valid ?day= and falls back to today otherwise", () => {
    expect(dayFromParam("4", 6)).toBe(4);
    for (const bad of [null, "", "0", "8", "2.5", "abc"]) expect(dayFromParam(bad, 6)).toBe(6);
  });
});

describe("dayActions", () => {
  const free = { workoutRunning: false, allowSkip: true };

  it("lets you start or skip any open day, including today", () => {
    for (const s of ["today", "upcoming", "missed"] as const) expect(dayActions(s, free)).toEqual(["start", "skip"]);
  });

  it("hides skip where it isn't wanted (Home)", () => {
    expect(dayActions("today", { ...free, allowSkip: false })).toEqual(["start"]);
  });

  it("offers mobility, rest-day logging and skip on a rest-day routine", () => {
    expect(dayActions("today", { ...free, restDay: true })).toEqual(["logMobility", "logRest", "skip"]);
  });

  it("offers 'do it again' on a finished day, but not for a rest day", () => {
    expect(dayActions("done", free)).toEqual(["again"]);
    expect(dayActions("done", { ...free, restDay: true })).toEqual([]);
  });

  it("only offers undo on a skipped day and nothing on a plan rest day", () => {
    expect(dayActions("skipped", free)).toEqual(["undoSkip"]);
    expect(dayActions("skipped", { ...free, workoutRunning: true })).toEqual(["undoSkip"]);
    expect(dayActions("rest", free)).toEqual([]);
  });

  it("points to the running workout instead of starting another", () => {
    expect(dayActions("today", { ...free, workoutRunning: true })).toEqual(["resume"]);
    expect(dayActions("done", { ...free, workoutRunning: true })).toEqual(["resume"]);
  });
});

describe("themes", () => {
  it("defaults to Ocean and falls back to it for unknown ids", () => {
    expect(DEFAULT_THEME).toBe("ocean");
    expect(themeOf(undefined).id).toBe("ocean");
    expect(themeOf("nope").id).toBe("ocean");
    expect(themeOf("light").label).toBe("Light");
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it("uses dark status-bar text only for the light theme", () => {
    expect(statusBarStyle("light")).toBe("default");
    expect(statusBarStyle("ocean")).toBe("black");
    expect(statusBarStyle(undefined)).toBe("black");
  });

  // black-translucent shortens the installed app's window by the status bar
  // height, leaving a dead strip under the tab bar. iOS reads the style from
  // the layout's own metadata at launch, so that's the copy worth guarding.
  it("never asks for a translucent status bar", () => {
    for (const t of THEMES) expect(statusBarStyle(t.id)).not.toBe("black-translucent");
  });

  /** Runs the pre-paint script against stand-ins, and reports what it wrote. */
  function runThemeScript(saved: string | null) {
    const metas: Record<string, { content: string }> = {
      "theme-color": { content: "" },
      "apple-mobile-web-app-status-bar-style": { content: "" },
    };
    const root = { dataset: {} as Record<string, string> };
    const doc = {
      documentElement: root,
      querySelector: (sel: string) => metas[sel.replace(/^meta\[name="(.*)"\]$/, "$1")] ?? null,
    };
    new Function("localStorage", "document", themeScript())({ getItem: () => saved }, doc);
    return {
      theme: root.dataset.theme,
      color: metas["theme-color"].content,
      statusBar: metas["apple-mobile-web-app-status-bar-style"].content,
    };
  }

  it("applies a saved dark theme before the page is painted", () => {
    expect(runThemeScript("mono")).toEqual({ theme: "mono", color: themeOf("mono").bg, statusBar: "black" });
  });

  it("applies the light theme, including its dark status-bar text", () => {
    expect(runThemeScript("light")).toEqual({ theme: "light", color: themeOf("light").bg, statusBar: "default" });
  });

  it.each([["nothing saved", null], ["a theme that no longer exists", "neon"], ["an inherited property", "toString"]])(
    "leaves the markup alone with %s",
    (_label, saved) => {
      expect(runThemeScript(saved)).toEqual({ theme: undefined, color: "", statusBar: "" });
    },
  );

  it("can't be cut short by a theme value", () => {
    expect(themeScript()).not.toContain("</script");
  });

  it("the layout takes its status-bar style from statusBarStyle", async () => {
    const { readFileSync } = await import("node:fs");
    const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
    expect(layout).not.toContain("black-translucent");
    expect(layout).toContain("statusBarStyle: statusBarStyle(");
  });

  it("has a CSS block for every theme", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    for (const t of THEMES) expect(css).toContain(`[data-theme="${t.id}"]`);
  });
});

describe("routineMeta", () => {
  it("counts sets, or rounds for circuits", () => {
    expect(routineMeta(byId("hyrox-tue-lower"))).toEqual(["5 exercises", "17 sets"]);
    expect(routineMeta(byId("hyrox-sat-conditioning"))).toEqual(["5 exercises", "3 rounds"]);
    expect(routineMeta(byId("hyrox-mon-run"))).toEqual(["1 exercise", "1 set"]);
  });
});
