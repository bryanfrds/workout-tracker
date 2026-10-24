"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logRestDay, startRoutine, toggleSkip } from "@/lib/plan-actions";
import { dayActions, type DayAction, type PlanDay } from "@/lib/plans";
import type { AppState, Plan, Routine } from "@/lib/types";
import { routineMeta } from "@/lib/workout";

/** The big card for one plan day: what it is, and buttons to start, log or skip it. */
export function DayCard({
  app,
  plan,
  today,
  day,
  eyebrow,
  details,
  allowSkip = true,
}: {
  app: AppState;
  plan: Plan;
  today: Date;
  day: PlanDay;
  eyebrow: React.ReactNode;
  /** Extra content for the chosen routine (e.g. its exercise list), shown above the buttons. */
  details?: (routine: Routine) => React.ReactNode;
  allowSkip?: boolean;
}) {
  const router = useRouter();
  const doneIndex = day.session ? day.routines.findIndex((r) => r.id === day.session!.routineId) : -1;
  const [pick, setPick] = useState(Math.max(0, doneIndex));
  const routine = day.routines[Math.min(pick, day.routines.length - 1)];
  const done = day.status === "done" && day.session;

  const start = (r: Routine) => {
    startRoutine(r);
    router.push("/workout");
  };

  const actions = routine
    ? dayActions(day.status, { restDay: routine.restDay, workoutRunning: Boolean(app.active), allowSkip })
    : [];

  const button = (a: DayAction) => {
    const primary = "flex-1 rounded-[14px] bg-accent p-[15px] text-base font-bold text-accent-ink";
    const secondary = "rounded-[14px] bg-card2 px-4 py-3 text-sm font-semibold";
    switch (a) {
      case "start":
        return (
          <button key={a} onClick={() => start(routine!)} className={primary}>
            Start workout
          </button>
        );
      case "again":
        return (
          <button key={a} onClick={() => start(routine!)} className={`${secondary} flex-1`}>
            Do it again
          </button>
        );
      case "logMobility":
        return (
          <button key={a} onClick={() => start(routine!)} className={primary}>
            Log mobility
          </button>
        );
      case "logRest":
        return (
          <button key={a} onClick={() => logRestDay(routine!)} className={`${secondary} flex-1`}>
            Log rest day
          </button>
        );
      case "skip":
        return (
          <button key={a} onClick={() => toggleSkip(plan.id, today, day.day)} className={secondary}>
            Skip
          </button>
        );
      case "undoSkip":
        return (
          <button key={a} onClick={() => toggleSkip(plan.id, today, day.day)} className={`${secondary} flex-1`}>
            Undo skip
          </button>
        );
      case "resume":
        return (
          <Link key={a} href="/workout" className={`${secondary} flex-1 text-center`}>
            Workout in progress ›
          </Link>
        );
    }
  };

  return (
    <section className="rounded-[22px] bg-card p-[18px]">
      {eyebrow}

      {day.status === "rest" && (
        <>
          <h2 className="mt-1.5 text-[22px] font-extrabold">Rest day</h2>
          <p className="mt-1 text-sm text-muted">Nothing planned. Recover, or start any workout below.</p>
        </>
      )}

      {routine && day.status !== "rest" && (
        <>
          <h2 className={`mt-1.5 text-[22px] font-extrabold ${day.status === "skipped" ? "text-muted line-through" : ""}`}>
            {done ? `✓ ${day.session!.routineName}` : routine.name}
          </h2>
          {done ? (
            <p className="mt-1 text-sm text-muted">
              {new Date(day.session!.startedAt).toDateString() === today.toDateString()
                ? "Done for today. Nice."
                : `Done on ${new Date(day.session!.startedAt).toLocaleDateString(undefined, { weekday: "long" })}.`}
            </p>
          ) : (
            routine.summary && <p className="mt-1 text-sm leading-snug text-muted">{routine.summary}</p>
          )}

          {day.routines.length > 1 && !done && (
            <div className="mt-3 flex gap-2" role="group" aria-label="Choose one">
              {day.routines.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setPick(i)}
                  aria-pressed={r.id === routine.id}
                  className={`flex-1 rounded-xl border-2 p-2.5 text-sm font-semibold ${
                    r.id === routine.id ? "border-accent text-accent" : "border-transparent bg-card2"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          {!done && (
            <div className="mt-3 flex gap-3.5 text-[13px] text-text2">
              {routineMeta(routine).map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          )}

          {details?.(routine)}

          {actions.length > 0 && <div className="mt-4 flex gap-2">{actions.map(button)}</div>}
        </>
      )}
    </section>
  );
}
