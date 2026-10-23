"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { weekday } from "@/lib/hyrox";
import { logRestDay, startRoutine, toggleSkip } from "@/lib/plan-actions";
import { planWeek } from "@/lib/plans";
import type { AppState, Plan } from "@/lib/types";

/** Today's workout from the plan you're following, with a start button. */
export default function TodayCard({ app, plan, today }: { app: AppState; plan: Plan; today: Date }) {
  const router = useRouter();
  const d = planWeek(app, plan, today).days[weekday(today) - 1];

  return (
    <section className="mt-3 rounded-2xl bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Today · {d.name}</h2>
        <Link href="/plan" className="shrink-0 text-sm text-muted">
          See the week ›
        </Link>
      </div>

      {d.status === "rest" && (
        <>
          <p className="mt-1 text-lg font-bold">Rest day</p>
          <p className="text-sm text-muted">Nothing planned. Recover, or pick any workout below.</p>
        </>
      )}

      {d.status === "done" && d.session && (
        <>
          <p className="mt-1 text-lg font-bold">✓ {d.session.routineName}</p>
          <p className="text-sm text-muted">Done for today. Nice.</p>
        </>
      )}

      {d.status === "skipped" && (
        <>
          <p className="mt-1 text-lg font-bold text-muted line-through">{d.routines.map((r) => r.name).join(" or ")}</p>
          <button onClick={() => toggleSkip(plan.id, today, d.day)} className="mt-1 text-sm text-muted underline">
            Undo skip
          </button>
        </>
      )}

      {(d.status === "today" || d.status === "missed" || d.status === "upcoming") &&
        d.routines.map((r, i) => (
          <div key={r.id} className={i > 0 ? "mt-4 border-t border-line pt-4" : "mt-1"}>
            {i > 0 && <p className="mb-1 text-xs text-muted">or</p>}
            <p className="text-lg font-bold">{r.name}</p>
            {r.summary && <p className="text-sm text-muted">{r.summary}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.exercises.map((e) => (
                <span key={e.name} className="rounded-lg bg-card2 px-2 py-1 text-xs text-[#c9c9d1]">
                  {e.name}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {app.active ? (
                <Link href="/workout" className="flex-1 rounded-xl bg-card2 p-3 text-center text-sm font-semibold">
                  Workout in progress
                </Link>
              ) : (
                <button
                  onClick={() => {
                    startRoutine(r);
                    router.push("/workout");
                  }}
                  className="flex-1 rounded-xl bg-accent p-3.5 text-[15px] font-bold text-accent-ink"
                >
                  {r.restDay ? "Log mobility" : "Start workout"}
                </button>
              )}
              {r.restDay && (
                <button onClick={() => logRestDay(r)} className="flex-1 rounded-xl bg-card2 p-3 text-sm font-semibold">
                  Log rest day
                </button>
              )}
            </div>
          </div>
        ))}
    </section>
  );
}
