"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import RestTimer from "@/components/RestTimer";
import SetRow, { SetHeader } from "@/components/SetRow";
import { setState, useAppState } from "@/lib/store";
import type { LoggedExercise, LoggedSet, Session } from "@/lib/types";
import { bestSet, countSets, describeSet, formatClock, kindOf, lastSessionOf, restAfter } from "@/lib/workout";

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
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/plan" className="rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink">
              HYROX plan
            </Link>
            <Link href="/" className="rounded-xl bg-card2 px-5 py-3 font-bold">
              Routines
            </Link>
          </div>
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
    const ex = active.exercises[ei];
    const nowDone = !ex.sets[si].done;
    setState((s) => {
      if (!s.active) return s;
      const now = Date.now();
      const exercises = s.active.exercises.map((e, i) =>
        i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, done: nowDone, doneAt: nowDone ? now : undefined } : x)) },
      );
      if (!nowDone) return { ...s, active: { ...s.active, exercises } };
      const seconds = done + 1 < total ? restAfter(s.active, ex, ex.sets[si], s.restSeconds) : 0;
      return { ...s, active: { ...s.active, exercises, restEndsAt: seconds > 0 ? now + seconds * 1000 : undefined } };
    });
  }

  function setSkipped(ei: number, skipped: boolean) {
    updateActive((a) => ({ ...a, exercises: a.exercises.map((e, i) => (i === ei ? { ...e, skipped } : e)) }));
  }

  const lastTime = (ex: LoggedExercise) => {
    const prev = last?.exercises.find((e) => e.name === ex.name && !e.skipped);
    const best = prev && bestSet(prev);
    return best ? `Last time: ${describeSet(kindOf(ex), best)}` : null;
  };

  const rounds = active.circuit ? Math.max(...active.exercises.map((e) => e.sets.length)) : 0;

  function finish() {
    router.push(active.routineId.startsWith("hyrox-") ? "/plan" : "/history");
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
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {active.circuit
        ? Array.from({ length: rounds }, (_, r) => (
            <section key={r} className="mt-3 rounded-2xl bg-card p-4">
              <h2 className="font-bold">
                Round {r + 1} of {rounds}
              </h2>
              <p className="text-xs text-muted">Rest as needed between exercises and rounds.</p>
              {active.exercises.map((ex, ei) =>
                ex.skipped || !ex.sets[r] ? null : (
                  <div key={ei} className="mt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">{ex.name}</h3>
                      {ex.target && <span className="text-xs text-muted">{ex.target}</span>}
                    </div>
                    <SetHeader ex={ex} first="" />
                    <SetRow
                      ex={ex}
                      set={ex.sets[r]}
                      label=""
                      name={`${ex.name} round ${r + 1}`}
                      onEdit={(patch) => editSet(ei, r, patch)}
                      onToggle={() => toggle(ei, r)}
                    />
                  </div>
                ),
              )}
            </section>
          ))
        : active.exercises.map((ex, ei) => (
            <section key={ei} className={`mt-3 rounded-2xl bg-card p-4 ${ex.skipped ? "opacity-60" : ""}`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{ex.name}</h2>
                  {ex.target && <p className="text-xs text-muted">{ex.target}</p>}
                </div>
                {ex.optional && (
                  <button
                    onClick={() => setSkipped(ei, !ex.skipped)}
                    aria-pressed={Boolean(ex.skipped)}
                    className="shrink-0 rounded-lg bg-card2 px-2.5 py-1.5 text-xs font-semibold text-muted"
                  >
                    {ex.skipped ? "Not available · undo" : "Not available?"}
                  </button>
                )}
              </div>
              {!ex.skipped && (
                <>
                  <SetHeader ex={ex} />
                  {ex.sets.map((s, si) => (
                    <SetRow
                      key={si}
                      ex={ex}
                      set={s}
                      label={String(si + 1)}
                      name={`${ex.name} set ${si + 1}`}
                      onEdit={(patch) => editSet(ei, si, patch)}
                      onToggle={() => toggle(ei, si)}
                    />
                  ))}
                  {lastTime(ex) && <p className="mt-1.5 text-xs text-muted">{lastTime(ex)}</p>}
                </>
              )}
            </section>
          ))}

      {active.circuit && (
        <div className="mt-3 rounded-2xl bg-card p-4 text-xs text-muted">
          {active.exercises
            .filter((e) => !e.skipped)
            .map((ex) => (lastTime(ex) ? <p key={ex.name}>{`${ex.name}: ${lastTime(ex)!.replace("Last time: ", "last time ")}`}</p> : null))}
        </div>
      )}

      <section className="mt-3 rounded-2xl bg-card p-4">
        <h2 className="font-bold">How did it feel?</h2>
        <div className="mt-3 grid grid-cols-10 gap-1" role="group" aria-label="Effort from 1 to 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => updateActive((a) => ({ ...a, rpe: a.rpe === n ? undefined : n }))}
              aria-pressed={active.rpe === n}
              aria-label={`Effort ${n}`}
              className={`rounded-lg py-2 text-sm font-semibold ${active.rpe === n ? "bg-accent text-accent-ink" : "bg-card2"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>Very easy</span>
          <span>All out</span>
        </div>
        <textarea
          value={active.notes ?? ""}
          onChange={(e) => updateActive((a) => ({ ...a, notes: e.target.value }))}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-3 w-full resize-none rounded-xl bg-card2 p-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
        />
      </section>

      <button
        onClick={finish}
        disabled={done === 0 && !active.restDay}
        className="mt-5 w-full rounded-xl bg-accent p-3.5 text-[15px] font-bold text-accent-ink disabled:opacity-40"
      >
        {active.restDay && done === 0 ? "Log rest day" : "Finish workout"}
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
