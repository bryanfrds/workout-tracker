"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { planWeek, skipKey, weekStart, type DayStatus } from "@/lib/hyrox";
import { setState, useAppState } from "@/lib/store";
import type { Routine, Session } from "@/lib/types";
import { describeSet, kindOf, startSession } from "@/lib/workout";

const noop = () => () => {};

/** Today's date, read on the client only so server and client render the same. */
function useToday(): Date | null {
  const day = useSyncExternalStore(noop, () => new Date().toDateString(), () => null);
  return day ? new Date(day) : null;
}

export default function PlanPage() {
  const app = useAppState();
  const today = useToday();
  const router = useRouter();
  if (!app || !today) return null;

  const start = weekStart(today);
  const { days, doneCount, recent } = planWeek(app, today);
  const history = recent.map((w) => ({ label: w.weeksAgo === 0 ? "This week" : `${w.weeksAgo}w ago`, done: w.done }));

  function start_(routine: Routine) {
    setState((s) => (s.active ? s : { ...s, active: startSession(routine, s.sessions) }));
    router.push("/workout");
  }

  function toggleSkip(day: number) {
    const key = skipKey(start, day);
    setState((s) => {
      const list = s.planSkips ?? [];
      return { ...s, planSkips: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
    });
  }

  function logRestDay(routine: Routine) {
    setState((s) => {
      const session: Session = { ...startSession(routine, s.sessions), exercises: [], endedAt: Date.now() };
      return { ...s, sessions: [...s.sessions, session] };
    });
  }

  function setRounds(routine: Routine, rounds: number) {
    setState((s) => ({
      ...s,
      routines: s.routines.map((r) =>
        r.id === routine.id ? { ...r, exercises: r.exercises.map((e) => ({ ...e, sets: rounds })) } : r,
      ),
    }));
  }

  const badge: Record<DayStatus, string> = {
    done: "bg-accent text-accent-ink",
    skipped: "bg-card2 text-muted line-through",
    today: "border-2 border-accent text-accent",
    missed: "bg-card2 text-muted",
    upcoming: "bg-card2 text-text",
  };

  return (
    <>
      <h1 className="mt-2 text-3xl font-extrabold">HYROX plan</h1>
      <p className="mt-1 text-sm text-muted">Same week every week. Skip or swap days when you need recovery.</p>

      <section className="mt-4 rounded-2xl bg-card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">This week</h2>
          <span className="text-sm text-muted">{doneCount} of 7 days done</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <a
              key={d.day}
              href={`#day-${d.day}`}
              aria-label={`${d.name}: ${d.status}`}
              className={`grid h-9 place-items-center rounded-lg text-xs font-bold ${badge[d.status]}`}
            >
              {d.status === "done" ? "✓" : d.name[0]}
            </a>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {history.map((w) => (
            <div key={w.label}>
              <div className="h-12 overflow-hidden rounded-lg bg-card2">
                <div className="mt-auto bg-accent" style={{ height: `${(w.done / 7) * 100}%`, marginTop: `${(1 - w.done / 7) * 3}rem` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {w.label} · {w.done}/7
              </div>
            </div>
          ))}
        </div>
      </section>

      {days.map((d) => {
        const main = d.routines[0];
        if (!main) return null;
        return (
          <details
            key={d.day}
            id={`day-${d.day}`}
            open={d.status === "today"}
            className="group mt-3 scroll-mt-6 rounded-2xl bg-card p-4"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${badge[d.status]}`}>
                {d.status === "done" ? "✓" : d.name.slice(0, 3)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">
                  {d.name}
                  {d.status === "today" && " · today"}
                  {d.status === "skipped" && " · skipped"}
                  {d.status === "done" && d.session && ` · done (${d.session.routineName})`}
                </span>
                <span className="block font-bold">{d.routines.map((r) => r.name).join(" or ")}</span>
              </span>
              <span className="text-muted transition group-open:rotate-90">›</span>
            </summary>

            <div className="mt-3 space-y-4">
              {d.routines.map((r) => (
                <div key={r.id}>
                  {d.routines.length > 1 && <h3 className="text-sm font-bold">{r.name}</h3>}
                  {r.summary && <p className="text-sm text-muted">{r.summary}</p>}
                  <ul className="mt-2 text-sm">
                    {r.exercises.map((e) => (
                      <li key={e.name} className="flex justify-between gap-3 border-t border-line py-1.5">
                        <span>
                          {e.name}
                          {e.optional && <span className="text-muted"> (optional)</span>}
                        </span>
                        <span className="text-right text-muted">
                          {r.circuit ? "" : `${e.sets} × `}
                          {e.target ?? describeSet(kindOf(e), e)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {r.circuit && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-muted">Rounds</span>
                      {[3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => setRounds(r, n)}
                          aria-pressed={r.exercises[0]?.sets === n}
                          className={`rounded-lg px-3 py-1.5 font-semibold ${r.exercises[0]?.sets === n ? "bg-accent text-accent-ink" : "bg-card2"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {app.active ? (
                      <Link href="/workout" className="flex-1 rounded-xl bg-card2 p-3 text-center text-sm font-semibold">
                        Workout in progress
                      </Link>
                    ) : (
                      <button
                        onClick={() => start_(r)}
                        className="flex-1 rounded-xl bg-accent p-3 text-sm font-bold text-accent-ink"
                      >
                        {r.restDay ? "Log mobility" : `Start ${d.routines.length > 1 ? r.name.toLowerCase() : "workout"}`}
                      </button>
                    )}
                    {r.restDay && d.status !== "done" && (
                      <button onClick={() => logRestDay(r)} className="flex-1 rounded-xl bg-card2 p-3 text-sm font-semibold">
                        Log rest day
                      </button>
                    )}
                    <Link
                      href={`/routine/${r.id}`}
                      className="rounded-xl bg-card2 px-4 py-3 text-sm text-muted"
                      aria-label={`Edit ${r.name}`}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}

              {d.status !== "done" && (
                <button onClick={() => toggleSkip(d.day)} className="w-full p-2 text-sm text-muted">
                  {d.status === "skipped" ? "Undo skip" : "Skip this day"}
                </button>
              )}
            </div>
          </details>
        );
      })}
    </>
  );
}
