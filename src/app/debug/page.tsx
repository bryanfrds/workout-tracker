"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Temporary: prints what the browser actually reports on the device, so the
 * bottom-bar gap can be diagnosed from real numbers instead of screenshots.
 * Delete once that's settled.
 */
export default function DebugPage() {
  const [rows, setRows] = useState<[string, string][]>([]);

  const read = useCallback(() => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;left:-9999px;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
      document.body.append(probe);
      const p = getComputedStyle(probe);
      const insets = [p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft].join(" ");
      probe.remove();

      const nav = document.querySelector("nav")?.getBoundingClientRect();
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));

      const vv = window.visualViewport;
      setRows([
        ["safe-area insets (t r b l)", insets],
        ["--bar-h", getComputedStyle(document.documentElement).getPropertyValue("--bar-h").trim() || "(not set)"],
        ["window inner", `${innerWidth} x ${innerHeight}`],
        ["visualViewport", vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)}` : "none"],
        ["screen", `${screen.width} x ${screen.height}`],
        ["devicePixelRatio", String(devicePixelRatio)],
        ["standalone", String(standalone)],
        ["nav height", nav ? nav.height.toFixed(1) : "no nav"],
        ["nav bottom vs viewport", nav ? `${nav.bottom.toFixed(1)} vs ${innerHeight}` : "no nav"],
        ["document height", String(document.documentElement.scrollHeight)],
        ["read at", new Date().toLocaleTimeString()],
      ]);
  }, []);

  // The tab bar arrives in a Suspense boundary, and iOS reports a 0px bottom
  // inset on first paint and corrects it a tick later — so read more than once.
  useEffect(() => {
    const frame = requestAnimationFrame(read);
    const timers = [150, 600, 1500].map((ms) => setTimeout(read, ms));
    addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
    };
  }, [read]);

  return (
    <>
      <h1 className="mt-2 text-3xl font-extrabold">Debug</h1>
      <p className="mt-1 text-sm text-muted">Screenshot this and send it over.</p>
      <button onClick={read} className="mt-3 w-full rounded-xl bg-accent p-3 font-bold text-accent-ink">
        Read again
      </button>
      <dl className="mt-4 rounded-2xl bg-card p-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
