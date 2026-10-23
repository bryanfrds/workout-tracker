export type PlannedExercise = {
  name: string;
  sets: number;
  kg: number;
  reps: number;
};

export type Routine = {
  id: string;
  name: string;
  exercises: PlannedExercise[];
};

export type LoggedSet = {
  kg: number;
  reps: number;
  done: boolean;
};

export type LoggedExercise = {
  name: string;
  sets: LoggedSet[];
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
};
