import type { LoggedExercise, LoggedSet, Routine, Session } from "./types";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** `n` if it's a usable non-negative number (older saves may hold null), else `fallback`. */
export function validOr(n: number | null | undefined, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Most recent finished session of this routine, if any. */
export function lastSessionOf(sessions: Session[], routineId: string): Session | undefined {
  return sessions
    .filter((s) => s.routineId === routineId && s.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Heaviest completed set (ties broken by reps). */
export function bestSet(ex: LoggedExercise): LoggedSet | undefined {
  return ex.sets
    .filter((s) => s.done)
    .sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0];
}

/**
 * Builds a new session from a routine, filling each set with what was
 * lifted last time for that exercise, falling back to the routine's targets.
 */
export function startSession(routine: Routine, sessions: Session[], now = Date.now()): Session {
  const last = lastSessionOf(sessions, routine.id);
  return {
    id: newId(),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: now,
    exercises: routine.exercises.map((planned) => {
      const prev = last?.exercises.find((e) => e.name === planned.name);
      return {
        name: planned.name,
        sets: Array.from({ length: planned.sets }, (_, i) => {
          const p = prev?.sets[i] ?? prev?.sets.at(-1);
          return { kg: validOr(p?.kg, planned.kg), reps: validOr(p?.reps, planned.reps), done: false };
        }),
      };
    }),
  };
}

export function countSets(session: Session): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      total++;
      if (s.done) done++;
    }
  }
  return { done, total };
}

export function formatKg(kg: number): string {
  if (!Number.isFinite(kg)) return "–";
  return kg === 0 ? "BW" : `${kg} kg`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What's next, for the "rest's over" notification. */
export function nextSetText(s: Session): string {
  for (const ex of s.exercises) {
    const i = ex.sets.findIndex((x) => !x.done);
    if (i >= 0) {
      const set = ex.sets[i];
      return `Next: ${ex.name} · set ${i + 1} of ${ex.sets.length} · ${formatKg(set.kg)} × ${set.reps}`;
    }
  }
  return "Back to it";
}
