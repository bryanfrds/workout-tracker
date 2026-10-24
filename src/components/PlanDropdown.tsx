"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setActivePlan } from "@/lib/plan-actions";
import type { Plan } from "@/lib/types";

/** The plan name as a big title; tap it to switch plan, edit it, or make a new one. */
export default function PlanDropdown({ plans, active }: { plans: Plan[]; active?: Plan }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-[15px] hover:bg-card2";

  return (
    <div ref={ref} className="relative mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 text-left text-3xl font-extrabold"
      >
        <span>{active?.name ?? "Pick a plan"}</span>
        <span className={`text-base text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-11 z-30 w-64 rounded-2xl border border-line bg-card p-1.5 shadow-2xl">
          {plans.map((p) => (
            <button
              key={p.id}
              role="menuitemradio"
              aria-checked={p.id === active?.id}
              onClick={() => {
                setActivePlan(p.id);
                setOpen(false);
              }}
              className={`${item} ${p.id === active?.id ? "font-bold text-accent" : ""}`}
            >
              {p.name}
              {p.id === active?.id && <span>✓</span>}
            </button>
          ))}
          <hr className="mx-1 my-1.5 border-line" />
          {active && (
            <Link role="menuitem" href={`/plans/${active.id}`} className={item}>
              Edit this plan <span className="text-muted">›</span>
            </Link>
          )}
          <Link role="menuitem" href="/plans/new" className={item}>
            + New plan
          </Link>
        </div>
      )}
    </div>
  );
}
