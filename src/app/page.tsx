"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PlanPicker from "@/components/PlanPicker";
import TodayCard from "@/components/TodayCard";
import { activePlan } from "@/lib/plans";
import { setState, useAppState } from "@/lib/store";
import { useToday } from "@/lib/use-today";
import { countSets, lastSessionOf, startSession } from "@/lib/workout";

const DAY = 24 * 60 * 60 * 1000;

function lastDone(ts?: number): string {
  if (!ts) return "not done yet";
  const days = Math.floor((Date.now() - ts) / DAY);
  if (days === 0) return "last done today";
  if (days < 7) return `last done ${new Date(ts).toLocaleDateString(undefined, { weekday: "short" })}`;
  return `last done ${days} days ago`;
}

export default function RoutinesPage() {
  const app = useAppState();
  const today = useToday();
  const router = useRouter();
  if (!app || !today) return null;

  const active = app.active;
  const plan = activePlan(app);

  function start(routineId: string) {
    setState((s) => {
      const routine = s.routines.find((r) => r.id === routineId);
      if (!routine || s.active) return s;
      return { ...s, active: startSession(routine, s.sessions) };
    });
    router.push("/workout");
  }

  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Routines</h1>
        <Link href="/settings" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-card text-lg text-muted">
          ⚙
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">Pick the plan you&apos;re following</p>
      <PlanPicker plans={app.plans ?? []} activeId={plan?.id} />

      {active && (
        <Link href="/workout" className="mt-4 block rounded-2xl bg-accent p-4 text-accent-ink">
          <div className="text-xs font-semibold">In progress</div>
          <div className="text-lg font-bold">{active.routineName}</div>
          <div className="text-sm">
            {countSets(active).done} of {countSets(active).total} sets · tap to resume
          </div>
        </Link>
      )}

      {plan && <TodayCard app={app} plan={plan} today={today} />}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">All workouts</h2>

      {app.routines.filter((r) => !r.plan).map((r) => {
        const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
        const last = lastSessionOf(app.sessions, r.id);
        return (
          <div key={r.id} className="mt-3 rounded-2xl bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-bold">{r.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {r.exercises.length} exercises · {sets} sets · {lastDone(last?.startedAt)}
                </p>
              </div>
              <Link href={`/routine/${r.id}`} className="text-sm text-muted underline-offset-2 hover:underline">
                Edit
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.exercises.map((e) => (
                <span key={e.name} className="rounded-lg bg-card2 px-2 py-1 text-xs text-[#c9c9d1]">
                  {e.name}
                </span>
              ))}
            </div>
            {!active && (
              <button
                onClick={() => start(r.id)}
                disabled={r.exercises.length === 0}
                className="mt-4 w-full rounded-xl bg-accent p-3.5 text-[15px] font-bold text-accent-ink disabled:opacity-40"
              >
                Start workout
              </button>
            )}
          </div>
        );
      })}

      <Link
        href="/routine/new"
        className="mt-3 block rounded-2xl border-[1.5px] border-dashed border-line p-4 text-center text-muted"
      >
        + New routine
      </Link>
    </>
  );
}
