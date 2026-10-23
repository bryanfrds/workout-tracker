"use client";

import { skipKey, weekStart } from "./hyrox";
import { setState } from "./store";
import type { Routine, Session } from "./types";
import { startSession } from "./workout";

/** Starts a workout from a routine unless one is already running. */
export function startRoutine(routine: Routine) {
  setState((s) => (s.active ? s : { ...s, active: startSession(routine, s.sessions) }));
}

export function toggleSkip(planId: string, today: Date, day: number) {
  const key = skipKey(planId, weekStart(today), day);
  setState((s) => {
    const list = s.planSkips ?? [];
    return { ...s, planSkips: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
  });
}

/** Records a rest day with nothing ticked. */
export function logRestDay(routine: Routine) {
  setState((s) => {
    const session: Session = { ...startSession(routine, s.sessions), exercises: [], endedAt: Date.now() };
    return { ...s, sessions: [...s.sessions, session] };
  });
}

export function setActivePlan(id: string) {
  setState((s) => ({ ...s, activePlanId: id }));
}
