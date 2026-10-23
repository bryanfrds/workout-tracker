"use client";

import Link from "next/link";
import { setActivePlan } from "@/lib/plan-actions";
import type { Plan } from "@/lib/types";

/** Horizontal chips to switch the plan you're following, plus a "new plan" link. */
export default function PlanPicker({ plans, activeId }: { plans: Plan[]; activeId?: string }) {
  return (
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Plan">
      {plans.map((p) => (
        <button
          key={p.id}
          onClick={() => setActivePlan(p.id)}
          aria-pressed={p.id === activeId}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
            p.id === activeId ? "bg-accent text-accent-ink" : "bg-card text-text"
          }`}
        >
          {p.name}
        </button>
      ))}
      <Link href="/plans/new" className="shrink-0 rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted">
        + New plan
      </Link>
    </div>
  );
}
