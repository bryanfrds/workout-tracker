"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import NumberInput from "@/components/NumberInput";
import RestTimer from "@/components/RestTimer";
import { setState, useAppState } from "@/lib/store";
import type { LoggedSet, Session } from "@/lib/types";
import { bestSet, countSets, formatClock, formatKg, lastSessionOf } from "@/lib/workout";

function updateActive(fn: (a: Session) => Session) {
  setState((s) => (s.active ? { ...s, active: fn(s.active) } : s));
}

function useElapsed(since: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return formatClock((now - since) / 1000);
}

export default function WorkoutPage() {
  const app = useAppState();
  if (!app) return null;
  if (!app.active) {
    return (
      <>
        <h1 className="mt-2 text-3xl font-extrabold">Workout</h1>
        <div className="mt-6 rounded-2xl bg-card p-6 text-center">
          <p className="text-muted">No workout running.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink">
            Pick a routine
          </Link>
        </div>
      </>
    );
  }
  return <ActiveWorkout key={app.active.id} />;
}

function ActiveWorkout() {
  const app = useAppState()!;
  const router = useRouter();
  const active = app.active!;
  const elapsed = useElapsed(active.startedAt);
  const { done, total } = countSets(active);
  const last = lastSessionOf(app.sessions, active.routineId);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const setRest = useCallback((endsAt: number | undefined) => {
    updateActive((a) => ({ ...a, restEndsAt: endsAt }));
  }, []);

  function editSet(ei: number, si: number, patch: Partial<LoggedSet>) {
    updateActive((a) => ({
      ...a,
      exercises: a.exercises.map((ex, i) =>
        i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) },
      ),
    }));
  }

  function toggle(ei: number, si: number) {
    const nowDone = !active.exercises[ei].sets[si].done;
    editSet(ei, si, { done: nowDone });
    if (!nowDone) return;
    const startRest = done + 1 < total;
    setState((s) =>
      s.active ? { ...s, active: { ...s.active, restEndsAt: startRest ? Date.now() + s.restSeconds * 1000 : undefined } } : s,
    );
  }

  function finish() {
    router.push("/history");
    setState((s) => {
      if (!s.active) return s;
      const session = { ...s.active, restEndsAt: undefined, endedAt: Date.now() };
      return { ...s, active: undefined, sessions: [...s.sessions, session] };
    });
  }

  function discard() {
    setState((s) => ({ ...s, active: undefined }));
    router.push("/");
  }

  return (
    <>
      <h1 className="mt-2 text-3xl font-extrabold">{active.routineName}</h1>
      <p className="mt-1 text-sm text-muted">
        {done} of {total} sets · {elapsed} elapsed
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded bg-card2">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      {active.exercises.map((ex, ei) => {
        const prev = last?.exercises.find((e) => e.name === ex.name);
        const prevBest = prev && bestSet(prev);
        return (
          <section key={ei} className="mt-3 rounded-2xl bg-card p-4">
            <h2 className="mb-2 font-bold">{ex.name}</h2>
            <div className="grid grid-cols-[26px_1fr_1fr_44px] gap-2 text-[11px] uppercase tracking-wide text-muted">
              <span>Set</span>
              <span className="text-center">kg</span>
              <span className="text-center">Reps</span>
              <span />
            </div>
            {ex.sets.map((s, si) => (
              <div key={si} className="grid grid-cols-[26px_1fr_1fr_44px] items-center gap-2 py-1.5 text-sm">
                <span className="font-semibold text-muted">{si + 1}</span>
                {(["kg", "reps"] as const).map((field) => (
                  <NumberInput
                    key={field}
                    aria-label={`${ex.name} set ${si + 1} ${field}`}
                    value={s[field]}
                    onChange={(n) => editSet(ei, si, { [field]: n })}
                    className={`w-full rounded-[10px] bg-card2 p-2 text-center outline-none focus:ring-2 focus:ring-accent ${s.done ? "opacity-50" : ""}`}
                  />
                ))}
                <button
                  onClick={() => toggle(ei, si)}
                  aria-label={`${s.done ? "Untick" : "Tick"} ${ex.name} set ${si + 1}`}
                  aria-pressed={s.done}
                  className={`h-10 w-10 rounded-xl border-2 text-xl font-extrabold transition ${
                    s.done ? "border-accent bg-accent text-accent-ink" : "border-line text-transparent"
                  }`}
                >
                  ✓
                </button>
              </div>
            ))}
            {prevBest && (
              <p className="mt-1.5 text-xs text-muted">
                Last time: {formatKg(prevBest.kg)} × {prevBest.reps}
              </p>
            )}
          </section>
        );
      })}

      <button
        onClick={finish}
        disabled={done === 0}
        className="mt-5 w-full rounded-xl bg-accent p-3.5 text-[15px] font-bold text-accent-ink disabled:opacity-40"
      >
        Finish workout
      </button>
      {confirmQuit ? (
        <div className="mt-3 flex gap-2">
          <button onClick={discard} className="flex-1 rounded-xl bg-red-500/15 p-3 text-sm font-semibold text-red-400">
            Yes, discard it
          </button>
          <button onClick={() => setConfirmQuit(false)} className="flex-1 rounded-xl bg-card p-3 text-sm">
            Keep going
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmQuit(true)} className="mt-3 w-full p-3 text-sm text-muted">
          Discard workout
        </button>
      )}

      {active.restEndsAt && <RestTimer endsAt={active.restEndsAt} onChange={setRest} />}
    </>
  );
}
