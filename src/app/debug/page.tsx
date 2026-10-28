"use client";

import { useEffect, useState } from "react";

/**
 * Temporary: prints what the browser actually reports on the device, so the
 * bottom-bar gap can be diagnosed from real numbers instead of screenshots.
 * Delete once that's settled.
 */
export default function DebugPage() {
  const [rows, setRows] = useState<[string, string][]>([]);

  useEffect(() => {
    const read = () => {
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

      setRows([
        ["safe-area insets (t r b l)", insets],
        ["--bar-h", getComputedStyle(document.documentElement).getPropertyValue("--bar-h") || "(not set)"],
        ["window inner", `${innerWidth} x ${innerHeight}`],
        ["visualViewport", visualViewport ? `${Math.round(visualViewport.width)} x ${Math.round(visualViewport.height)}` : "none"],
        ["screen", `${screen.width} x ${screen.height}`],
        ["devicePixelRatio", String(devicePixelRatio)],
        ["standalone", String(standalone)],
        ["nav height", nav ? nav.height.toFixed(1) : "no nav"],
        ["nav bottom vs viewport", nav ? `${nav.bottom.toFixed(1)} vs ${innerHeight}` : "no nav"],
        ["document height", String(document.documentElement.scrollHeight)],
      ]);
    };
    read();
    addEventListener("resize", read);
    return () => removeEventListener("resize", read);
  }, []);

  return (
    <>
      <h1 className="mt-2 text-3xl font-extrabold">Debug</h1>
      <p className="mt-1 text-sm text-muted">Screenshot this and send it over.</p>
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
