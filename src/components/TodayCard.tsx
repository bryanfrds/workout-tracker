"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { weekday } from "@/lib/hyrox";
import { logRestDay, startRoutine, toggleSkip } from "@/lib/plan-actions";
import type { PlanDay } from "@/lib/plans";
import type { AppState, Plan, Routine } from "@/lib/types";

/** "5 exercises · 3 rounds" for a routine. */
export function routineMeta(r: Routine): string[] {
  const bits = [`${r.exercises.length} exercise${r.exercises.length === 1 ? "" : "s"}`];
  if (r.circuit) bits.push(`${r.exercises[0]?.sets ?? 0} rounds`);
  else bits.push(`${r.exercises.reduce((n, e) => n + e.sets, 0)} sets`);
  return bits;
}

/** The big card for one plan day: what it is, and a button to start it. */
export function DayCard({
  app,
  plan,
  today,
  day,
  eyebrow,
  details,
}: {
  app: AppState;
  plan: Plan;
  today: Date;
  day: PlanDay;
  eyebrow: React.ReactNode;
  /** Extra content for the chosen routine (e.g. its exercise list), shown above the buttons. */
  details?: (routine: Routine) => React.ReactNode;
}) {
  const router = useRouter();
  const [pick, setPick] = useState(0);
  const routine = day.routines[Math.min(pick, day.routines.length - 1)];
  const isToday = day.day === weekday(today);

  const start = (r: Routine) => {
    startRoutine(r);
    router.push("/workout");
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

      {day.status === "done" && day.session && (
        <>
          <h2 className="mt-1.5 text-[22px] font-extrabold">✓ {day.session.routineName}</h2>
          <p className="mt-1 text-sm text-muted">
            {new Date(day.session.startedAt).toDateString() === today.toDateString()
              ? "Done for today. Nice."
              : `Done on ${new Date(day.session.startedAt).toLocaleDateString(undefined, { weekday: "long" })}.`}
          </p>
        </>
      )}

      {routine && day.status !== "rest" && day.status !== "done" && (
        <>
          <h2 className={`mt-1.5 text-[22px] font-extrabold ${day.status === "skipped" ? "text-muted line-through" : ""}`}>
            {routine.name}
          </h2>
          {routine.summary && <p className="mt-1 text-sm leading-snug text-muted">{routine.summary}</p>}

          {day.routines.length > 1 && (
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

          <div className="mt-3 flex gap-3.5 text-[13px] text-text2">
            {routineMeta(routine).map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>

          {details?.(routine)}

          {day.status === "skipped" ? (
            <button
              onClick={() => toggleSkip(plan.id, today, day.day)}
              className="mt-4 w-full rounded-[14px] bg-card2 p-3 text-sm font-semibold"
            >
              Undo skip
            </button>
          ) : app.active ? (
            <Link href="/workout" className="mt-4 block rounded-[14px] bg-card2 p-3.5 text-center font-semibold">
              Workout in progress ›
            </Link>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => start(routine)}
                className="flex-1 rounded-[14px] bg-accent p-[15px] text-base font-bold text-accent-ink"
              >
                {routine.restDay ? "Log mobility" : "Start workout"}
              </button>
              {routine.restDay && (
                <button onClick={() => logRestDay(routine)} className="flex-1 rounded-[14px] bg-card2 p-3 text-sm font-semibold">
                  Log rest day
                </button>
              )}
              {!isToday && !routine.restDay && (
                <button
                  onClick={() => toggleSkip(plan.id, today, day.day)}
                  className="rounded-[14px] bg-card2 px-4 text-sm font-semibold"
                >
                  Skip
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
