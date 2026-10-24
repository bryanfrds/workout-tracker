"use client";

import { useSyncExternalStore } from "react";
import { HYROX_ROUTINES, withPlanRoutines } from "./hyrox";
import { SEED_PLANS, withPlans } from "./plans";
import { DEFAULT_THEME } from "./themes";
import type { AppState } from "./types";

const KEY = "workout-tracker:v1";

export const SEED: AppState = {
  restSeconds: 90,
  activePlanId: "hyrox",
  theme: DEFAULT_THEME,
  sessions: [],
  routines: [
    {
      id: "push",
      name: "Push day",
      exercises: [
        { name: "Bench press", sets: 4, kg: 60, reps: 8 },
        { name: "Shoulder press", sets: 3, kg: 30, reps: 8 },
        { name: "Incline dumbbell", sets: 3, kg: 20, reps: 10 },
        { name: "Triceps pushdown", sets: 3, kg: 25, reps: 12 },
      ],
    },
    {
      id: "pull",
      name: "Pull day",
      exercises: [
        { name: "Deadlift", sets: 3, kg: 100, reps: 5 },
        { name: "Pull-ups", sets: 3, kg: 0, reps: 8 },
        { name: "Rows", sets: 3, kg: 50, reps: 10 },
        { name: "Curls", sets: 3, kg: 12, reps: 12 },
      ],
    },
    {
      id: "legs",
      name: "Leg day",
      exercises: [
        { name: "Squat", sets: 4, kg: 80, reps: 5 },
        { name: "Romanian deadlift", sets: 3, kg: 60, reps: 8 },
        { name: "Lunges", sets: 3, kg: 16, reps: 10 },
      ],
    },
    ...HYROX_ROUTINES,
  ],
  plans: SEED_PLANS,
};

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? { ...SEED, plans: undefined, ...(JSON.parse(raw) as AppState) } : SEED;
    // Saves from before the HYROX plan / multiple plans existed get them added.
    state = withPlans({ ...saved, routines: withPlanRoutines(saved.routines) });
  } catch {
    state = SEED;
  }
  return state;
}

export function getState(): AppState {
  return load();
}

export function setState(update: (s: AppState) => AppState): void {
  state = update(load());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns null during server render and the first client render. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getState, () => null);
}
