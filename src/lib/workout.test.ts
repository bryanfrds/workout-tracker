import { describe, expect, it } from "vitest";
import type { Routine, Session } from "./types";
import { bestSet, countSets, formatClock, formatKg, lastSessionOf, startSession, validOr } from "./workout";

const routine: Routine = {
  id: "push",
  name: "Push day",
  exercises: [
    { name: "Bench", sets: 3, kg: 60, reps: 8 },
    { name: "Dips", sets: 2, kg: 0, reps: 10 },
  ],
};

function session(over: Partial<Session>): Session {
  return { id: "s", routineId: "push", routineName: "Push day", startedAt: 0, endedAt: 1, exercises: [], ...over };
}

describe("startSession", () => {
  it("uses the routine's targets when there's no previous session", () => {
    const s = startSession(routine, [], 100);
    expect(s.startedAt).toBe(100);
    expect(s.exercises[0].sets).toEqual([
      { kg: 60, reps: 8, done: false },
      { kg: 60, reps: 8, done: false },
      { kg: 60, reps: 8, done: false },
    ]);
  });

  it("fills each set from the same set last time, repeating the last one if the routine grew", () => {
    const prev = session({
      exercises: [{ name: "Bench", sets: [{ kg: 62.5, reps: 8, done: true }, { kg: 65, reps: 6, done: true }] }],
    });
    const sets = startSession(routine, [prev]).exercises[0].sets;
    expect(sets.map((x) => x.kg)).toEqual([62.5, 65, 65]);
    expect(sets.map((x) => x.reps)).toEqual([8, 6, 6]);
    expect(sets.every((x) => !x.done)).toBe(true);
  });

  it("falls back to targets for bad saved numbers (NaN saved as null)", () => {
    const prev = session({
      exercises: [{ name: "Bench", sets: [{ kg: null as unknown as number, reps: NaN, done: true }] }],
    });
    expect(startSession(routine, [prev]).exercises[0].sets[0]).toEqual({ kg: 60, reps: 8, done: false });
  });

  it("ignores unfinished sessions and other routines", () => {
    const sessions = [
      session({ id: "a", startedAt: 5, endedAt: undefined, exercises: [{ name: "Bench", sets: [{ kg: 99, reps: 1, done: true }] }] }),
      session({ id: "b", routineId: "pull", startedAt: 6, exercises: [{ name: "Bench", sets: [{ kg: 98, reps: 1, done: true }] }] }),
    ];
    expect(startSession(routine, sessions).exercises[0].sets[0].kg).toBe(60);
  });
});

describe("lastSessionOf", () => {
  it("returns the most recent finished session", () => {
    const sessions = [session({ id: "old", startedAt: 1 }), session({ id: "new", startedAt: 9 }), session({ id: "mid", startedAt: 5 })];
    expect(lastSessionOf(sessions, "push")?.id).toBe("new");
    expect(sessions[0].id).toBe("old"); // input not reordered
  });
});

describe("bestSet", () => {
  it("picks the heaviest done set, then most reps", () => {
    const best = bestSet({
      name: "Bench",
      sets: [
        { kg: 80, reps: 5, done: true },
        { kg: 80, reps: 6, done: true },
        { kg: 100, reps: 1, done: false },
      ],
    });
    expect(best).toEqual({ kg: 80, reps: 6, done: true });
  });

  it("returns undefined when nothing is done", () => {
    expect(bestSet({ name: "Bench", sets: [{ kg: 80, reps: 5, done: false }] })).toBeUndefined();
  });
});

describe("helpers", () => {
  it("counts done and total sets", () => {
    const s = startSession(routine, []);
    s.exercises[0].sets[1].done = true;
    expect(countSets(s)).toEqual({ done: 1, total: 5 });
  });

  it("formats weights and clocks", () => {
    expect(formatKg(0)).toBe("BW");
    expect(formatKg(62.5)).toBe("62.5 kg");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(-3)).toBe("0:00");
  });

  it("validOr rejects null, NaN and negatives", () => {
    expect(validOr(null, 5)).toBe(5);
    expect(validOr(NaN, 5)).toBe(5);
    expect(validOr(-1, 5)).toBe(5);
    expect(validOr(0, 5)).toBe(0);
  });
});
