import { DAY_NAMES, HYROX_ROUTINES, skipKey, weekStart, weekday } from "./hyrox";
import type { AppState, Plan, Routine, Session } from "./types";

const hyroxDay = (day: number) => HYROX_ROUTINES.filter((r) => r.day === day).map((r) => r.id);

/** Plans every new install starts with. Ids are stable so saved skips line up. */
export const SEED_PLANS: Plan[] = [
  { id: "hyrox", name: "HYROX week", days: [1, 2, 3, 4, 5, 6, 7].map(hyroxDay) },
  { id: "ppl", name: "PPL week", days: [["push"], ["pull"], ["legs"], ["push"], ["pull"], ["legs"], []] },
];

/** Adds seeded plans to saves from before plans existed, and picks one if none is active. */
export function withPlans(state: AppState): AppState {
  if (state.plans) return state.activePlanId ? state : { ...state, activePlanId: state.plans[0]?.id };
  // Only seed PPL if its routines still exist in this save.
  const ids = new Set(state.routines.map((r) => r.id));
  const plans = SEED_PLANS.filter((p) => p.days.flat().every((id) => ids.has(id)));
  // Skips saved before plans existed were all HYROX ("2026-10-19:3").
  const planSkips = state.planSkips?.map((k) => (/^\d{4}-/.test(k) ? `hyrox:${k}` : k));
  return { ...state, plans, planSkips, activePlanId: state.activePlanId ?? plans[0]?.id };
}

export function activePlan(state: Pick<AppState, "plans" | "activePlanId">): Plan | undefined {
  return state.plans?.find((p) => p.id === state.activePlanId) ?? state.plans?.[0];
}

/** Routines for a plan day, skipping ids whose routine was deleted. */
export function dayRoutines(plan: Plan, day: number, routines: Routine[]): Routine[] {
  return (plan.days[day - 1] ?? []).map((id) => routines.find((r) => r.id === id)).filter((r): r is Routine => !!r);
}

export type DayStatus = "done" | "skipped" | "rest" | "today" | "missed" | "upcoming";

export type PlanDay = {
  day: number;
  name: string;
  routines: Routine[];
  /** The finished session that completed this day this week, if any. */
  session?: Session;
  status: DayStatus;
};

/** Start and end (ms) of the week `weeksAgo` before the one containing `today`. Calendar-based, so DST-safe. */
function weekFrom(today: Date, weeksAgo: number): { from: number; to: number } {
  const start = weekStart(today);
  const at = (k: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * k).getTime();
  return { from: at(-weeksAgo), to: at(-weeksAgo + 1) };
}

/**
 * Matches finished sessions in a week to plan days, one session per day. A
 * session prefers the day it was done on, otherwise any open day that has its
 * routine — so Push on Monday doesn't also tick Thursday's Push. If needed, an
 * earlier match is moved to another of its days to fit a later session in.
 */
function assignSessions(days: string[][], sessions: Session[]): Map<number, Session> {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const candidates = (s: Session) => {
    const own = weekday(new Date(s.startedAt));
    const fits = [1, 2, 3, 4, 5, 6, 7].filter((d) => days[d - 1]?.includes(s.routineId));
    return fits.includes(own) ? [own, ...fits.filter((d) => d !== own)] : fits;
  };
  const byDay = new Map<number, Session>();
  // Standard augmenting-path matching (tiny: at most 7 days).
  const place = (s: Session, seen: Set<number>): boolean => {
    for (const d of candidates(s)) {
      if (seen.has(d)) continue;
      seen.add(d);
      const holder = byDay.get(d);
      if (!holder || place(holder, seen)) {
        byDay.set(d, s);
        return true;
      }
    }
    return false;
  };
  for (const s of ordered) place(s, new Set());
  return byDay;
}

/** The plan's days with ids of deleted routines removed. */
export function liveDays(plan: Plan, routines: Routine[]): string[][] {
  const ids = new Set(routines.map((r) => r.id));
  return plan.days.map((d) => d.filter((id) => ids.has(id)));
}

/** Removes a deleted routine from every plan. */
export function withoutRoutine(plans: Plan[] | undefined, routineId: string): Plan[] | undefined {
  return plans?.map((p) => ({ ...p, days: p.days.map((d) => d.filter((id) => id !== routineId)) }));
}

/**
 * Sets one choice on a plan day in the editor. Slot 0 is the main workout,
 * slot 1 the alternative. Clearing the main workout makes it a rest day;
 * duplicates are dropped.
 */
export function setPlanDay(days: string[][], day: number, slot: number, id: string): string[][] {
  return days.map((d, i) => {
    if (i !== day) return d;
    if (slot === 0 && !id) return [];
    const next = [...d];
    next[slot] = id;
    return [...new Set(next.filter(Boolean))];
  });
}

/** Status of each day of `plan` for the week containing `today`, plus recent weeks' counts. */
export function planWeek(
  app: Pick<AppState, "routines" | "sessions" | "planSkips">,
  plan: Plan,
  today: Date,
): { days: PlanDay[]; doneCount: number; trainingDays: number; recent: { weeksAgo: number; done: number }[] } {
  const skips = new Set(app.planSkips ?? []);
  const todayNum = weekday(today);
  const start = weekStart(today);
  const inWeek = (weeksAgo: number) => {
    const { from, to } = weekFrom(today, weeksAgo);
    return app.sessions.filter((s) => s.endedAt && s.startedAt >= from && s.startedAt < to);
  };
  const days_ = liveDays(plan, app.routines);
  const assigned = assignSessions(days_, inWeek(0));

  const days = DAY_NAMES.map((name, i): PlanDay => {
    const day = i + 1;
    const routines = dayRoutines(plan, day, app.routines);
    const session = assigned.get(day);
    const status: DayStatus = session
      ? "done"
      : routines.length === 0
        ? "rest"
        : skips.has(skipKey(plan.id, start, day))
          ? "skipped"
          : day === todayNum
            ? "today"
            : day < todayNum
              ? "missed"
              : "upcoming";
    return { day, name, routines, session, status };
  });

  const recent = [3, 2, 1, 0].map((weeksAgo) => ({ weeksAgo, done: assignSessions(days_, inWeek(weeksAgo)).size }));
  return {
    days,
    doneCount: days.filter((d) => d.status === "done").length,
    trainingDays: days.filter((d) => d.routines.length > 0).length,
    recent,
  };
}

/** A rest day logged without any mobility ticked. */
export function isPlainRestDay(s: Session): boolean {
  return Boolean(s.restDay) && !s.exercises.some((e) => e.sets.some((x) => x.done));
}
