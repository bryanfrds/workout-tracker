import { describe, expect, it } from "vitest";
import { HYROX_ROUTINES, isPlainRestDay, planWeek, skipKey, weekStart, weekday, withPlanRoutines } from "@/lib/hyrox";
import type { LoggedExercise, Session } from "@/lib/types";
import {
  averageRest,
  bestSet,
  countSets,
  describeSet,
  nextSetText,
  parseClock,
  restAfter,
  startSession,
} from "@/lib/workout";

const byId = (id: string) => HYROX_ROUTINES.find((r) => r.id === id)!;

describe("plan", () => {
  it("covers every day of the week, with a choice on Sunday", () => {
    const days = HYROX_ROUTINES.map((r) => r.day);
    expect(new Set(days)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    expect(HYROX_ROUTINES.filter((r) => r.day === 7).map((r) => r.name)).toEqual(["Easy run", "Basketball"]);
    expect(new Set(HYROX_ROUTINES.map((r) => r.id)).size).toBe(HYROX_ROUTINES.length);
  });

  it("adds missing plan routines to old saves without touching edited ones", () => {
    const edited = { ...byId("hyrox-mon-run"), name: "My easy run" };
    const merged = withPlanRoutines([{ id: "push", name: "Push", exercises: [] }, edited]);
    expect(merged).toHaveLength(1 + HYROX_ROUTINES.length);
    expect(merged.find((r) => r.id === "hyrox-mon-run")?.name).toBe("My easy run");
    const again = withPlanRoutines(merged);
    expect(again).toBe(merged);
  });

  it("works out weeks from Monday", () => {
    const sat = new Date(2026, 9, 24); // Saturday 24 Oct 2026
    expect(weekday(sat)).toBe(6);
    expect(weekStart(sat)).toEqual(new Date(2026, 9, 19));
    expect(weekStart(new Date(2026, 9, 19))).toEqual(new Date(2026, 9, 19));
    expect(weekday(new Date(2026, 9, 25))).toBe(7);
    expect(skipKey(weekStart(sat), 3)).toBe("2026-10-19:3");
  });
});

describe("parseClock", () => {
  it("reads m:ss, h:mm:ss and plain seconds", () => {
    expect(parseClock("1:45")).toBe(105);
    expect(parseClock("28:30")).toBe(1710);
    expect(parseClock("1:02:03")).toBe(3723);
    expect(parseClock("90")).toBe(90);
  });

  it("reads a dot or comma as the separator (iPhone keypad has no colon)", () => {
    expect(parseClock("28.30")).toBe(1710);
    expect(parseClock("1,45")).toBe(105);
    expect(parseClock("1.02.03")).toBe(3723);
  });

  it("rejects things that aren't times", () => {
    for (const t of ["", "1:", "1.", "1:75", "28.75", "abc", "-5"]) expect(parseClock(t)).toBeUndefined();
  });
});

describe("describeSet", () => {
  it("formats each kind", () => {
    expect(describeSet("strength", { kg: 60, reps: 8 })).toBe("60 kg × 8");
    expect(describeSet("carry", { kg: 50, m: 15 })).toBe("50 kg · 15 m");
    expect(describeSet("distance", { km: 5, sec: 1710 })).toBe("5 km in 28:30 (5:42/km)");
    expect(describeSet("distance", { km: 5 })).toBe("5 km");
    expect(describeSet("interval", { m: 400, sec: 105, rest: 90 })).toBe("400 m in 1:45 · rest 1:30");
    expect(describeSet("time", { min: 15 })).toBe("15 min");
  });
});

describe("bestSet by kind", () => {
  const ex = (kind: LoggedExercise["kind"], sets: LoggedExercise["sets"]): LoggedExercise => ({ name: "x", kind, sets });

  it("picks the fastest interval and run pace", () => {
    expect(
      bestSet(
        ex("interval", [
          { m: 400, sec: 110, done: true },
          { m: 400, sec: 100, done: true },
          { m: 400, sec: 90, done: false },
        ]),
      )?.sec,
    ).toBe(100);
    expect(
      bestSet(
        ex("distance", [
          { km: 5, sec: 1800, done: true },
          { km: 4, sec: 1300, done: true },
        ]),
      )?.km,
    ).toBe(4);
  });

  it("picks the heaviest carry and the longest timed set", () => {
    expect(bestSet(ex("carry", [{ kg: 40, m: 20, done: true }, { kg: 50, m: 10, done: true }]))?.kg).toBe(50);
    expect(bestSet(ex("time", [{ min: 10, done: true }, { min: 20, done: true }]))?.min).toBe(20);
  });
});

describe("startSession with plan routines", () => {
  it("copies kinds, targets and the right fields", () => {
    const s = startSession(byId("hyrox-thu-intervals"), []);
    const repeats = s.exercises[1];
    expect(repeats).toMatchObject({ name: "400 m repeats", kind: "interval", target: "Challenging but controlled" });
    expect(repeats.sets).toHaveLength(5);
    expect(repeats.sets[0]).toEqual({ m: 400, rest: 90, done: false });
  });

  it("prefills from last time but not from a skipped exercise", () => {
    const routine = byId("hyrox-tue-lower");
    const prev = startSession(routine, [], 1);
    prev.endedAt = 2;
    prev.exercises[0].sets[0] = { kg: 70, reps: 6, done: true };
    prev.exercises[3] = { ...prev.exercises[3], skipped: true, sets: [{ kg: 999, m: 1, done: false }] };
    const next = startSession(routine, [prev], 3);
    expect(next.exercises[0].sets[0]).toEqual({ kg: 70, reps: 6, done: false });
    expect(next.exercises[3].sets[0]).toEqual({ kg: 50, m: 15, done: false });
    expect(next.exercises[3].skipped).toBeUndefined();
  });

  it("leaves skipped exercises out of the set count", () => {
    const s = startSession(byId("hyrox-tue-lower"), []);
    expect(countSets(s).total).toBe(17);
    s.exercises[3].skipped = true;
    s.exercises[4].skipped = true;
    expect(countSets(s).total).toBe(9);
    expect(nextSetText({ ...s, exercises: s.exercises.slice(3) })).toBe("Back to it");
  });
});

describe("restAfter", () => {
  const session = (id: string): Session => startSession(byId(id), []);

  it("uses the interval's own recovery, the default for lifts, and none for runs or circuits", () => {
    const thu = session("hyrox-thu-intervals");
    expect(restAfter(thu, thu.exercises[1], { ...thu.exercises[1].sets[0], rest: 75 }, 90)).toBe(75);
    expect(restAfter(thu, thu.exercises[1], { ...thu.exercises[1].sets[0], rest: 0 }, 90)).toBe(0);
    expect(restAfter(thu, thu.exercises[1], { m: 400, done: false }, 90)).toBe(90);
    expect(restAfter(thu, thu.exercises[0], thu.exercises[0].sets[0], 90)).toBe(0);
    const tue = session("hyrox-tue-lower");
    expect(restAfter(tue, tue.exercises[0], tue.exercises[0].sets[0], 120)).toBe(120);
    const sat = session("hyrox-sat-conditioning");
    expect(restAfter(sat, sat.exercises[2], sat.exercises[2].sets[0], 90)).toBe(0);
    const mon = session("hyrox-mon-run");
    expect(restAfter(mon, mon.exercises[0], mon.exercises[0].sets[0], 90)).toBe(0);
  });
});

describe("averageRest", () => {
  it("averages the gaps between ticks", () => {
    const s = startSession(byId("hyrox-tue-lower"), []);
    s.exercises[0].sets[0].doneAt = 0;
    s.exercises[0].sets[1].doneAt = 90_000;
    s.exercises[0].sets[2].doneAt = 210_000;
    expect(averageRest(s)).toBe(105);
    expect(averageRest(startSession(byId("hyrox-mon-run"), []))).toBeUndefined();
  });
});

describe("planWeek", () => {
  const SAT = new Date(2026, 9, 24, 15); // Saturday afternoon; week starts Mon 19 Oct
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).getTime();
  const finished = (routineId: string, startedAt: number, extra: Partial<Session> = {}): Session => ({
    id: `${routineId}-${startedAt}`,
    routineId,
    routineName: routineId,
    startedAt,
    endedAt: startedAt + 3_600_000,
    exercises: [],
    ...extra,
  });
  const app = (sessions: Session[], planSkips: string[] = []) => ({ routines: HYROX_ROUTINES, sessions, planSkips });
  const status = (r: ReturnType<typeof planWeek>) => r.days.map((d) => d.status);

  it("marks done, skipped, missed, today and upcoming", () => {
    const r = planWeek(
      app([finished("hyrox-mon-run", at(2026, 9, 19)), finished("hyrox-thu-intervals", at(2026, 9, 22))], ["2026-10-19:2"]),
      SAT,
    );
    expect(status(r)).toEqual(["done", "skipped", "missed", "done", "missed", "today", "upcoming"]);
    expect(r.doneCount).toBe(2);
  });

  it("counts a day done whichever Sunday option was picked, and done beats skipped", () => {
    const r = planWeek(app([finished("hyrox-sun-basketball", at(2026, 9, 24))], ["2026-10-19:7"]), SAT);
    expect(r.days[6]).toMatchObject({ status: "done", session: { routineId: "hyrox-sun-basketball" } });
  });

  it("counts a logged rest day as done for Friday", () => {
    const r = planWeek(app([finished("hyrox-fri-rest", at(2026, 9, 23), { restDay: true })]), SAT);
    expect(r.days[4].status).toBe("done");
  });

  it("ignores unfinished sessions, last week's sessions and non-plan routines", () => {
    const r = planWeek(
      app([
        { ...finished("hyrox-mon-run", at(2026, 9, 19)), endedAt: undefined },
        finished("hyrox-tue-lower", at(2026, 9, 18, 23)),
        finished("push", at(2026, 9, 20)),
      ]),
      SAT,
    );
    expect(r.doneCount).toBe(0);
  });

  it("puts sessions in the right week across a daylight-saving change", () => {
    // Late Sunday in a week containing a DST change must still count for that week.
    const sunNight = new Date(2026, 2, 29, 23, 30).getTime(); // Sun 29 Mar 2026 (EU DST change)
    const r = planWeek(app([finished("hyrox-sun-run", sunNight)]), new Date(2026, 2, 29, 23, 45));
    expect(r.days[6].status).toBe("done");
    const next = planWeek(app([finished("hyrox-sun-run", sunNight)]), new Date(2026, 2, 30, 0, 15));
    expect(next.days[6].status).toBe("upcoming");
    expect(next.recent.at(-2)?.done).toBe(1);
  });

  it("reports distinct plan days done for the last four weeks", () => {
    const r = planWeek(
      app([
        finished("hyrox-mon-run", at(2026, 9, 12)),
        finished("hyrox-mon-run", at(2026, 9, 13)), // same plan day twice counts once
        finished("hyrox-sat-conditioning", at(2026, 9, 17)),
        finished("hyrox-mon-run", at(2026, 9, 19)),
      ]),
      SAT,
    );
    expect(r.recent).toEqual([
      { weeksAgo: 3, done: 0 },
      { weeksAgo: 2, done: 0 },
      { weeksAgo: 1, done: 2 },
      { weeksAgo: 0, done: 1 },
    ]);
  });
});

describe("isPlainRestDay", () => {
  it("is true only for a rest day with nothing ticked", () => {
    const fri = startSession(byId("hyrox-fri-rest"), []);
    expect(isPlainRestDay(fri)).toBe(true);
    fri.exercises[0].sets[0].done = true;
    expect(isPlainRestDay(fri)).toBe(false);
    expect(isPlainRestDay(startSession(byId("hyrox-mon-run"), []))).toBe(false);
  });
});
