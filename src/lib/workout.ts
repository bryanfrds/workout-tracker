import type { ExerciseKind, LoggedExercise, LoggedSet, Metrics, Routine, Session } from "./types";

export type MetricKey = keyof Metrics;

/** The boxes shown for each kind of exercise, in order. */
export const FIELDS: Record<ExerciseKind, MetricKey[]> = {
  strength: ["kg", "reps"],
  carry: ["kg", "m"],
  distance: ["km", "sec"],
  interval: ["m", "sec", "rest"],
  time: ["min"],
};

export const FIELD_LABELS: Record<MetricKey, string> = {
  kg: "kg",
  reps: "Reps",
  m: "Metres",
  km: "km",
  sec: "Time",
  rest: "Rest",
  min: "Min",
};

/** Fields entered as m:ss rather than a plain number. */
export const DURATION_FIELDS: MetricKey[] = ["sec", "rest"];

export const KIND_LABELS: Record<ExerciseKind, string> = {
  strength: "Weights (kg × reps)",
  carry: "Sled / carry (kg × metres)",
  distance: "Run / row (km + time)",
  interval: "Intervals (metres + time + rest)",
  time: "Minutes",
};

export const kindOf = (ex: { kind?: ExerciseKind }): ExerciseKind => ex.kind ?? "strength";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** `n` if it's a usable non-negative number (older saves may hold null), else `fallback`. */
export function validOr(n: number | null | undefined, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** Most recent finished session of this routine, if any. */
export function lastSessionOf(sessions: Session[], routineId: string): Session | undefined {
  return sessions
    .filter((s) => s.routineId === routineId && s.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Seconds per km, if the set has both a distance and a time. */
export function paceOf(set: Metrics, kind: ExerciseKind): number | undefined {
  const km = kind === "interval" ? (set.m ?? 0) / 1000 : set.km;
  return isNum(km) && km > 0 && isNum(set.sec) && set.sec > 0 ? set.sec / km : undefined;
}

/**
 * The standout completed set: heaviest for weights and carries, fastest pace
 * for runs and intervals, longest for timed work.
 */
export function bestSet(ex: LoggedExercise): LoggedSet | undefined {
  const kind = kindOf(ex);
  const done = ex.sets.filter((s) => s.done);
  const n = (v: number | undefined) => (isNum(v) ? v : 0);
  const score = (s: LoggedSet): number[] => {
    switch (kind) {
      case "strength":
        return [n(s.kg), n(s.reps)];
      case "carry":
        return [n(s.kg), n(s.m)];
      case "distance":
      case "interval": {
        const pace = paceOf(s, kind);
        return [pace ? -pace : -Infinity, n(kind === "distance" ? s.km : s.m)];
      }
      case "time":
        return [n(s.min)];
    }
  };
  return done.sort((a, b) => {
    const [x, y] = [score(a), score(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i];
    return 0;
  })[0];
}

/**
 * Builds a new session from a routine, filling each set with what was done
 * last time for that exercise, falling back to the routine's targets.
 */
export function startSession(routine: Routine, sessions: Session[], now = Date.now()): Session {
  const last = lastSessionOf(sessions, routine.id);
  return {
    id: newId(),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: now,
    circuit: routine.circuit,
    restDay: routine.restDay,
    exercises: routine.exercises.map((planned) => {
      const kind = kindOf(planned);
      const prev = last?.exercises.find((e) => e.name === planned.name && !e.skipped);
      return {
        name: planned.name,
        kind,
        optional: planned.optional,
        target: planned.target,
        sets: Array.from({ length: Math.max(1, planned.sets) }, (_, i) => {
          const p = prev?.sets[i] ?? prev?.sets.at(-1);
          const set: LoggedSet = { done: false };
          for (const key of FIELDS[kind]) {
            const value = isNum(p?.[key]) ? p[key] : planned[key];
            if (isNum(value)) set[key] = value;
          }
          return set;
        }),
      };
    }),
  };
}

export function countSets(session: Session): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of session.exercises) {
    if (ex.skipped) continue;
    for (const s of ex.sets) {
      total++;
      if (s.done) done++;
    }
  }
  return { done, total };
}

export function formatKg(kg: number | undefined): string {
  if (!isNum(kg)) return "–";
  return kg === 0 ? "BW" : `${kg} kg`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}

/**
 * Parses "1:45", "1:02:30" or plain seconds "105". A dot or comma also works as
 * the separator ("28.30" = 28:30), since the iPhone number keypad has no colon.
 * Returns undefined if it isn't a time.
 */
export function parseClock(text: string): number | undefined {
  const t = text.trim().replace(/[.,]/g, ":");
  if (!t) return undefined;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return undefined;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Short human description of one set, e.g. "5 km in 28:30 (5:42/km)". */
export function describeSet(kind: ExerciseKind, s: Metrics): string {
  const pace = paceOf(s, kind);
  const paceText = pace ? ` (${formatClock(pace)}/km)` : "";
  switch (kind) {
    case "strength":
      return `${formatKg(s.kg)} × ${isNum(s.reps) ? s.reps : "–"}`;
    case "carry":
      return `${formatKg(s.kg)} · ${isNum(s.m) ? s.m : "–"} m`;
    case "distance":
      return `${isNum(s.km) ? s.km : "–"} km${isNum(s.sec) && s.sec > 0 ? ` in ${formatClock(s.sec)}` : ""}${paceText}`;
    case "interval":
      return `${isNum(s.m) ? s.m : "–"} m${isNum(s.sec) && s.sec > 0 ? ` in ${formatClock(s.sec)}` : ""}${
        isNum(s.rest) && s.rest > 0 ? ` · rest ${formatClock(s.rest)}` : ""
      }`;
    case "time":
      return `${isNum(s.min) ? s.min : "–"} min`;
  }
}

/** Average gap between ticks within the session, in seconds (a rough rest time). */
export function averageRest(session: Session): number | undefined {
  const times = session.exercises
    .flatMap((e) => e.sets)
    .map((s) => s.doneAt)
    .filter(isNum)
    .sort((a, b) => a - b);
  if (times.length < 2) return undefined;
  return (times.at(-1)! - times[0]) / (times.length - 1) / 1000;
}

/** How long to rest after ticking this set, or 0 for no rest timer. */
export function restAfter(session: Session, ex: LoggedExercise, set: LoggedSet, defaultSeconds: number): number {
  if (session.circuit || session.restDay) return 0; // rest as needed
  const kind = kindOf(ex);
  if (kind === "interval") return isNum(set.rest) ? set.rest : defaultSeconds;
  if (kind === "strength" || kind === "carry") return defaultSeconds;
  return 0;
}

/** What's next, for the "rest's over" notification. */
export function nextSetText(s: Session): string {
  for (const ex of s.exercises) {
    if (ex.skipped) continue;
    const i = ex.sets.findIndex((x) => !x.done);
    if (i >= 0) {
      return `Next: ${ex.name} · set ${i + 1} of ${ex.sets.length} · ${describeSet(kindOf(ex), ex.sets[i])}`;
    }
  }
  return "Back to it";
}

/** Short facts for a routine card, e.g. ["5 exercises", "3 rounds"]. */
export function routineMeta(r: Routine): string[] {
  const bits = [`${r.exercises.length} exercise${r.exercises.length === 1 ? "" : "s"}`];
  if (r.circuit) bits.push(`${r.exercises[0]?.sets ?? 0} rounds`);
  else {
    const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
    bits.push(`${sets} set${sets === 1 ? "" : "s"}`);
  }
  return bits;
}
