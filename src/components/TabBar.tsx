"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/plan", label: "Plan", icon: "▦" },
  { href: "/workout", label: "Workout", icon: "●" },
  { href: "/history", label: "History", icon: "◷" },
];

export default function TabBar() {
  const path = usePathname();
  const isOn = (href: string) => (href === "/" ? path === "/" || path.startsWith("/routine") : href === "/plan" ? path === "/plan" || path.startsWith("/plans") : path.startsWith(href));

  return (
    // The ::after strip carries the bar colour below its bottom edge: installed iPhone apps can
    // place fixed elements short of the screen bottom, which otherwise shows a dark gap.
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur after:absolute after:inset-x-0 after:top-full after:h-40 after:bg-bar after:content-['']">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around text-[11px]">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex w-16 flex-col items-center gap-0.5 ${isOn(t.href) ? "text-accent" : "text-muted"}`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
