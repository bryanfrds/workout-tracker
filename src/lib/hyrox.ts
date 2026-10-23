import type { AppState, Routine, Session } from "./types";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The weekly HYROX plan. It repeats every week; ids are stable so saved history lines up. */
export const HYROX_ROUTINES: Routine[] = [
  {
    id: "hyrox-mon-run",
    name: "Easy run",
    plan: "hyrox",
    day: 1,
    summary: "4–6 km at an easy, conversational pace. Builds aerobic base.",
    exercises: [{ name: "Easy run", kind: "distance", sets: 1, km: 5, target: "4–6 km, conversational pace" }],
  },
  {
    id: "hyrox-tue-lower",
    name: "Lower body + sled",
    plan: "hyrox",
    day: 2,
    summary: "Squats, RDLs and lunges, then sled push and pull if your gym has a sled.",
    exercises: [
      { name: "Squat", sets: 3, kg: 60, reps: 8, target: "6–10 reps" },
      { name: "Romanian deadlift", sets: 3, kg: 50, reps: 8, target: "8 reps" },
      { name: "Walking lunges", sets: 3, kg: 0, reps: 12, target: "12 steps per leg" },
      { name: "Sled push", kind: "carry", sets: 4, kg: 50, m: 15, optional: true, target: "10–15 m" },
      { name: "Sled pull", kind: "carry", sets: 4, kg: 40, m: 15, optional: true, target: "10–15 m" },
    ],
  },
  {
    id: "hyrox-wed-upper",
    name: "Upper body + easy cardio",
    plan: "hyrox",
    day: 3,
    summary: "Press, pull and row, then 10–20 minutes of easy cardio.",
    exercises: [
      { name: "Bench press", sets: 3, kg: 60, reps: 8, target: "6–10 reps" },
      { name: "Lat pulldown or pull-ups", sets: 3, kg: 45, reps: 10, target: "8–12 reps" },
      { name: "Seated cable row", sets: 3, kg: 45, reps: 10, target: "8–12 reps" },
      { name: "Shoulder press", sets: 3, kg: 30, reps: 8, target: "8–10 reps" },
      { name: "Easy cardio", kind: "time", sets: 1, min: 15, target: "10–20 min, easy" },
    ],
  },
  {
    id: "hyrox-thu-intervals",
    name: "Running intervals",
    plan: "hyrox",
    day: 4,
    summary: "Warm up, 5 × 400 m hard but controlled with 90 s recovery, cool down.",
    exercises: [
      { name: "Warm-up jog", kind: "time", sets: 1, min: 10, target: "10 min easy" },
      { name: "400 m repeats", kind: "interval", sets: 5, m: 400, rest: 90, target: "Challenging but controlled" },
      { name: "Cool-down", kind: "time", sets: 1, min: 8, target: "5–10 min jog or walk" },
    ],
  },
  {
    id: "hyrox-fri-rest",
    name: "Rest + mobility",
    plan: "hyrox",
    day: 5,
    restDay: true,
    summary: "Rest day. Optional 10–20 minutes of light mobility or stretching.",
    exercises: [{ name: "Mobility / stretching", kind: "time", sets: 1, min: 15, optional: true, target: "Optional" }],
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
    ],
  },
  {
    id: "hyrox-sun-run",
    name: "Easy run",
    plan: "hyrox",
    day: 7,
    summary: "Easy run at a comfortable pace.",
    exercises: [{ name: "Easy run", kind: "distance", sets: 1, km: 5, target: "Comfortable pace" }],
  },
  {
    id: "hyrox-sun-basketball",
    name: "Basketball",
    plan: "hyrox",
    day: 7,
    summary: "A basketball session instead of the run.",
    exercises: [{ name: "Basketball", kind: "time", sets: 1, min: 60, target: "Log how long; effort at the end" }],
  },
];

/** Adds any plan routines missing from saved data, leaving edited ones alone. */
export function withPlanRoutines(routines: Routine[]): Routine[] {
  const have = new Set(routines.map((r) => r.id));
  const missing = HYROX_ROUTINES.filter((r) => !have.has(r.id));
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

/** Key for a skipped plan day, e.g. "2026-10-19:3". */
export function skipKey(week: Date, day: number): string {
  const ymd = `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, "0")}-${String(week.getDate()).padStart(2, "0")}`;
  return `${ymd}:${day}`;
}

export type DayStatus = "done" | "skipped" | "today" | "missed" | "upcoming";

export type PlanDay = {
  day: number;
  name: string;
  routines: Routine[];
  /** The finished session that completed this day this week, if any. */
  session?: Session;
  status: DayStatus;
};

/** Monday 00:00 of the week `weeksAgo` weeks before the one containing `today` (calendar-based, so DST-safe). */
function weekFrom(today: Date, weeksAgo: number): { from: number; to: number } {
  const start = weekStart(today);
  const at = (k: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * k).getTime();
  return { from: at(-weeksAgo), to: at(-weeksAgo + 1) };
}

/**
 * Status of each plan day for the week containing `today`. A day is done when
 * any of its routines was finished this week (on any day), which wins over a skip.
 */
export function planWeek(
  app: Pick<AppState, "routines" | "sessions" | "planSkips">,
  today: Date,
): { days: PlanDay[]; doneCount: number; recent: { weeksAgo: number; done: number }[] } {
  const plan = app.routines.filter((r) => r.plan === "hyrox");
  const skips = new Set(app.planSkips ?? []);
  const todayNum = weekday(today);
  const start = weekStart(today);
  const inWeek = (weeksAgo: number) => {
    const { from, to } = weekFrom(today, weeksAgo);
    return app.sessions.filter((s) => s.endedAt && s.startedAt >= from && s.startedAt < to);
  };
  const thisWeek = inWeek(0);

  const days = DAY_NAMES.map((name, i): PlanDay => {
    const day = i + 1;
    const routines = plan.filter((r) => r.day === day);
    const session = thisWeek.find((s) => routines.some((r) => r.id === s.routineId));
    const status: DayStatus = session
      ? "done"
      : skips.has(skipKey(start, day))
        ? "skipped"
        : day === todayNum
          ? "today"
          : day < todayNum
            ? "missed"
            : "upcoming";
    return { day, name, routines, session, status };
  });

  // Last four weeks, oldest first: how many distinct plan days were done.
  const recent = [3, 2, 1, 0].map((weeksAgo) => {
    const daysDone = new Set(
      inWeek(weeksAgo)
        .map((s) => plan.find((r) => r.id === s.routineId)?.day)
        .filter((d): d is number => d !== undefined),
    );
    return { weeksAgo, done: daysDone.size };
  });

  return { days, doneCount: days.filter((d) => d.status === "done").length, recent };
}

/** A rest day logged without any mobility ticked. */
export function isPlainRestDay(s: Session): boolean {
  return Boolean(s.restDay) && !s.exercises.some((e) => e.sets.some((x) => x.done));
}
