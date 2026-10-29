import type { Routine } from "./types";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * The weekly plan: a muscle-group split carrying the running and HYROX work.
 * It repeats every week; ids are stable so saved history lines up. Sunday has
 * no routine at all, which is what makes it a full rest day.
 *
 * Treadmill speeds and inclines live in `target`, since a set records distance
 * and time rather than a pace the machine was set to.
 */
export const HYROX_ROUTINES: Routine[] = [
  {
    id: "hyrox-mon-chest",
    name: "Chest + triceps + easy run",
    plan: "hyrox",
    day: 1,
    summary: "4–5 km easy, then chest and triceps.",
    exercises: [
      { name: "Easy run", kind: "distance", sets: 1, km: 4.5, target: "4–5 km at 8–10 km/h, 0–1% incline" },
      { name: "Dumbbell bench press", sets: 3, kg: 22.5, reps: 10, target: "8–12 reps" },
      { name: "Chest flyes", sets: 3, kg: 12, reps: 12, target: "10–15 reps" },
      { name: "Cable triceps pushdown", sets: 3, kg: 25, reps: 12, target: "10–15 reps" },
      { name: "Overhead triceps extension", sets: 3, kg: 20, reps: 12, target: "10–15 reps" },
      { name: "Single-arm cable pushdown", sets: 2, kg: 10, reps: 12, target: "12–15 reps per arm" },
    ],
  },
  {
    id: "hyrox-tue-back",
    name: "Back + biceps",
    plan: "hyrox",
    day: 2,
    summary: "Pulls and rows, then curls. Controlled reps — stop if elbows or forearms complain.",
    exercises: [
      { name: "Lat pulldown", sets: 3, kg: 45, reps: 10, target: "8–12 reps" },
      { name: "Seated cable row", sets: 3, kg: 45, reps: 10, target: "8–12 reps" },
      { name: "Chest-supported row", sets: 3, kg: 30, reps: 10, target: "10–12 reps" },
      { name: "Dumbbell bicep curls", sets: 3, kg: 12, reps: 10, target: "10–12 reps" },
      { name: "Hammer curls", sets: 2, kg: 12, reps: 12, target: "12–15 reps" },
    ],
  },
  {
    id: "hyrox-wed-legs",
    name: "Legs + core",
    plan: "hyrox",
    day: 3,
    summary: "Challenging but manageable — Thursday's intervals and Saturday's HYROX still have to happen.",
    exercises: [
      { name: "Squat", sets: 3, kg: 60, reps: 8, target: "6–10 reps" },
      { name: "Romanian deadlift", sets: 3, kg: 50, reps: 8, target: "8–10 reps" },
      { name: "Walking lunges", sets: 3, kg: 0, reps: 10, target: "10 steps per leg" },
      { name: "Calf raises", sets: 3, kg: 20, reps: 12, target: "12–15 reps" },
      { name: "Plank", kind: "time", sets: 3, min: 1, target: "45–60 seconds" },
    ],
  },
  {
    id: "hyrox-thu-intervals",
    name: "Running intervals + shoulders",
    plan: "hyrox",
    day: 4,
    summary: "5 × 400 m hard but controlled, then shoulders.",
    exercises: [
      { name: "Warm-up jog", kind: "time", sets: 1, min: 10, target: "10 min at 7.5–8 km/h" },
      {
        name: "400 m repeats",
        kind: "interval",
        sets: 5,
        m: 400,
        rest: 90,
        target: "10.5 km/h, 90 s walk back. Drop to 10 if form slips",
      },
      { name: "Cool-down", kind: "time", sets: 1, min: 8, target: "5–10 min at 4–5 km/h" },
      { name: "Shoulder press", sets: 3, kg: 30, reps: 8, target: "8–10 reps" },
      { name: "Lateral raises", sets: 3, kg: 8, reps: 12, target: "12–15 reps" },
      { name: "Rear-delt flyes", sets: 2, kg: 8, reps: 12, target: "12–15 reps" },
    ],
  },
  {
    id: "hyrox-fri-recovery",
    name: "Rest + light recovery",
    plan: "hyrox",
    day: 5,
    restDay: true,
    summary: "Nothing mandatory. An easy walk and some mobility if you feel like it — Saturday is the hard one.",
    exercises: [
      { name: "Easy walk", kind: "time", sets: 1, min: 20, optional: true, target: "Optional" },
      { name: "Mobility / stretching", kind: "time", sets: 1, min: 15, optional: true, target: "Optional" },
    ],
  },
  {
    id: "hyrox-sat-conditioning",
    name: "HYROX conditioning",
    plan: "hyrox",
    day: 6,
    circuit: true,
    summary: "3 rounds at a manageable pace. Rest between exercises and rounds as needed.",
    exercises: [
      { name: "Run", kind: "distance", sets: 3, km: 0.5, target: "500 m" },
      { name: "Row", kind: "distance", sets: 3, km: 0.5, target: "500 m" },
      { name: "Wall balls", sets: 3, kg: 6, reps: 15, target: "15 reps" },
      { name: "Farmer's carry", kind: "carry", sets: 3, kg: 24, m: 20, target: "20 m" },
      { name: "Burpee broad jumps", sets: 3, kg: 0, reps: 10, target: "10 reps" },
      { name: "Sled push", kind: "carry", sets: 3, kg: 50, m: 15, optional: true, target: "If the gym has a sled" },
      { name: "Sled pull", kind: "carry", sets: 3, kg: 40, m: 15, optional: true, target: "If the gym has a sled" },
    ],
  },
];

/** Not on the plan, but kept in Other workouts for logging a one-off. */
export const SPARE_ROUTINES: Routine[] = [
  {
    id: "hyrox-mon-run",
    name: "Easy run",
    summary: "An unplanned run, outside the week's plan.",
    exercises: [{ name: "Easy run", kind: "distance", sets: 1, km: 5, target: "Comfortable pace" }],
  },
  {
    id: "hyrox-sun-basketball",
    name: "Basketball",
    summary: "A basketball session, outside the week's plan.",
    exercises: [{ name: "Basketball", kind: "time", sets: 1, min: 60, target: "Log how long; effort at the end" }],
  },
];

/**
 * The plan's first version. Saves made before the rewrite still hold these, so
 * `withCurrentPlan` clears out the ones the new week replaced. Finished
 * sessions keep their own routine ids, so history is untouched either way.
 */
export const REPLACED_ROUTINE_IDS = [
  "hyrox-tue-lower",
  "hyrox-wed-upper",
  "hyrox-fri-rest",
  "hyrox-sun-run",
] as const;

/** Adds any plan routines missing from saved data, leaving edited ones alone. */
export function withPlanRoutines(routines: Routine[]): Routine[] {
  const have = new Set(routines.map((r) => r.id));
  const missing = [...HYROX_ROUTINES, ...SPARE_ROUTINES].filter((r) => !have.has(r.id));
  return missing.length ? [...routines, ...missing] : routines;
}

/** Monday 00:00 local time of the week containing `d`. */
export function weekStart(d = new Date()): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

/** 1 = Monday … 7 = Sunday. */
export function weekday(d = new Date()): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** Key for a skipped plan day, e.g. "ppl:2026-10-19:3". */
export function skipKey(planId: string, week: Date, day: number): string {
  const ymd = `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, "0")}-${String(week.getDate()).padStart(2, "0")}`;
  return `${planId}:${ymd}:${day}`;
}
