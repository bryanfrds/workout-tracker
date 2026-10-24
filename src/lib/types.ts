/**
 * What an exercise measures:
 * - strength: kg × reps (0 kg = bodyweight)
 * - carry: kg over metres (sled push/pull, farmer's carry)
 * - distance: km in a time (runs, rowing)
 * - interval: metres in a time, then recovery (track repeats)
 * - time: minutes (easy cardio, mobility, basketball)
 */
export type ExerciseKind = "strength" | "carry" | "distance" | "interval" | "time";

/** Numbers a set can hold. Which ones apply depends on the exercise kind. */
export type Metrics = {
  kg?: number;
  reps?: number;
  /** Metres (carries, intervals). */
  m?: number;
  /** Kilometres (runs, rowing). */
  km?: number;
  /** Time taken, in seconds. */
  sec?: number;
  /** Recovery after the set, in seconds. */
  rest?: number;
  /** Minutes. */
  min?: number;
};

export type PlannedExercise = Metrics & {
  name: string;
  sets: number;
  /** Defaults to "strength". */
  kind?: ExerciseKind;
  /** Can be marked "not available" (e.g. no sled at this gym). */
  optional?: boolean;
  /** Short guidance, e.g. "6–10 reps" or "Easy, conversational pace". */
  target?: string;
};

export type Routine = {
  id: string;
  name: string;
  exercises: PlannedExercise[];
  /** Training plan this belongs to; plan routines live on the Plan tab. */
  plan?: "hyrox";
  /** Plan weekday, 1 = Monday … 7 = Sunday. */
  day?: number;
  /** One-line description shown on the plan. */
  summary?: string;
  /** Exercises are done round by round (set 1 of each, then set 2 of each…). */
  circuit?: boolean;
  /** Can be finished with nothing ticked (rest day). */
  restDay?: boolean;
};

export type LoggedSet = Metrics & {
  done: boolean;
  /** When it was ticked (ms since epoch), to work out rest between sets. */
  doneAt?: number;
};

export type LoggedExercise = {
  name: string;
  sets: LoggedSet[];
  kind?: ExerciseKind;
  optional?: boolean;
  target?: string;
  /** Marked "not available" during the workout. */
  skipped?: boolean;
};

export type Session = {
  id: string;
  routineId: string;
  routineName: string;
  startedAt: number;
  endedAt?: number;
  exercises: LoggedExercise[];
  // When the current rest period ends (ms since epoch), if one is running.
  restEndsAt?: number;
  circuit?: boolean;
  restDay?: boolean;
  notes?: string;
  /** Perceived effort, 1 (very easy) to 10 (max). */
  rpe?: number;
};

/** A weekly schedule: for each day Mon–Sun, the routine ids to choose from (none = rest). */
export type Plan = {
  id: string;
  name: string;
  /** Seven entries, Monday first. */
  days: string[][];
};

export type Notifications = {
  subscription: PushSubscriptionJSON;
  /** Daily "time to train" reminder, e.g. "18:30", and its server schedule id. */
  reminder?: { time: string; id: string };
};

export type AppState = {
  routines: Routine[];
  sessions: Session[];
  active?: Session;
  restSeconds: number;
  notifications?: Notifications;
  /** The scheduled "rest's over" push for the current rest, so it can be cancelled. */
  restPush?: { endsAt: number; id: string };
  plans?: Plan[];
  /** The plan shown on the home screen and Plan tab. */
  activePlanId?: string;
  /** Colour theme id (see themes.ts). */
  theme?: string;
  /** Plan days skipped, as "<plan id>:<week start date>:<day>", e.g. "ppl:2026-10-19:3". */
  planSkips?: string[];
};
