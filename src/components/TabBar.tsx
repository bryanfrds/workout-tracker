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
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {/* --bar-h above the home-indicator inset, the same split iOS uses — at
          64px the inset read as dead space under the labels. */}
      <div className="mx-auto flex h-[var(--bar-h,48px)] max-w-md items-center justify-around text-[11px]">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            /* Full height so the tap target clears 44px; the icon and label
               are centred either way, so it looks the same. */
            className={`flex h-full w-16 flex-col items-center justify-center gap-0.5 ${isOn(t.href) ? "text-accent" : "text-muted"}`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
