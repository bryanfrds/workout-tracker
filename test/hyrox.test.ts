import { describe, expect, it } from "vitest";
import { HYROX_ROUTINES, SPARE_ROUTINES, skipKey, weekStart, weekday, withPlanRoutines } from "@/lib/hyrox";
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
  it("trains Monday to Saturday and leaves Sunday empty", () => {
    expect(HYROX_ROUTINES.map((r) => r.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(HYROX_ROUTINES.some((r) => r.day === 7)).toBe(false);
    expect(new Set(HYROX_ROUTINES.map((r) => r.id)).size).toBe(HYROX_ROUTINES.length);
  });

  it("keeps the spare routines off the plan", () => {
    for (const r of SPARE_ROUTINES) {
      expect(r.plan).toBeUndefined();
      expect(r.day).toBeUndefined();
    }
  });

  it("covers every muscle group the week is meant to hit", () => {
    const named = (day: number) =>
      HYROX_ROUTINES.filter((r) => r.day === day)
        .flatMap((r) => r.exercises)
        .map((e) => e.name.toLowerCase())
        .join(" ");
    expect(named(1)).toContain("bench");
    expect(named(1)).toContain("triceps");
    expect(named(2)).toContain("row");
    expect(named(2)).toContain("curl");
    expect(named(3)).toContain("squat");
    expect(named(4)).toContain("shoulder press");
    expect(named(6)).toContain("wall balls");
  });

  it("runs on Monday and does intervals on Thursday", () => {
    expect(byId("hyrox-mon-chest").exercises[0]).toMatchObject({ kind: "distance", km: 4.5 });
    expect(byId("hyrox-thu-intervals").exercises.find((e) => e.kind === "interval")).toMatchObject({
      sets: 5,
      m: 400,
      rest: 90,
    });
  });

  it("lets Friday be logged with nothing ticked", () => {
    const friday = byId("hyrox-fri-recovery");
    expect(friday.restDay).toBe(true);
    expect(friday.exercises.every((e) => e.optional)).toBe(true);
  });

  it("adds missing plan routines to old saves without touching edited ones", () => {
    const edited = { ...byId("hyrox-wed-legs"), name: "My leg day" };
    const merged = withPlanRoutines([{ id: "push", name: "Push", exercises: [] }, edited]);
    expect(merged).toHaveLength(1 + HYROX_ROUTINES.length + SPARE_ROUTINES.length);
    expect(merged.find((r) => r.id === "hyrox-wed-legs")?.name).toBe("My leg day");
    const again = withPlanRoutines(merged);
    expect(again).toBe(merged);
  });

  it("works out weeks from Monday", () => {
    const sat = new Date(2026, 9, 24); // Saturday 24 Oct 2026
    expect(weekday(sat)).toBe(6);
    expect(weekStart(sat)).toEqual(new Date(2026, 9, 19));
    expect(weekStart(new Date(2026, 9, 19))).toEqual(new Date(2026, 9, 19));
    expect(weekday(new Date(2026, 9, 25))).toBe(7);
    expect(skipKey("hyrox", weekStart(sat), 3)).toBe("hyrox:2026-10-19:3");
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
    expect(repeats).toMatchObject({ name: "400 m repeats", kind: "interval" });
    expect(repeats.target).toContain("10.5 km/h");
    expect(repeats.sets).toHaveLength(5);
    expect(repeats.sets[0]).toEqual({ m: 400, rest: 90, done: false });
  });

  it("prefills from last time but not from a skipped exercise", () => {
    const routine = byId("hyrox-wed-legs");
    const prev = startSession(routine, [], 1);
    prev.endedAt = 2;
    prev.exercises[0].sets[0] = { kg: 70, reps: 6, done: true };
    prev.exercises[3] = { ...prev.exercises[3], skipped: true, sets: [{ kg: 999, reps: 1, done: false }] };
    const next = startSession(routine, [prev], 3);
    expect(next.exercises[0].sets[0]).toEqual({ kg: 70, reps: 6, done: false });
    expect(next.exercises[3].sets[0]).toEqual({ kg: 20, reps: 12, done: false });
    expect(next.exercises[3].skipped).toBeUndefined();
  });

  it("leaves skipped exercises out of the set count", () => {
    const s = startSession(byId("hyrox-wed-legs"), []);
    expect(countSets(s).total).toBe(15);
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
    const tue = session("hyrox-wed-legs");
    expect(restAfter(tue, tue.exercises[0], tue.exercises[0].sets[0], 120)).toBe(120);
    const sat = session("hyrox-sat-conditioning");
    expect(restAfter(sat, sat.exercises[2], sat.exercises[2].sets[0], 90)).toBe(0);
    const mon = session("hyrox-mon-chest");
    expect(restAfter(mon, mon.exercises[0], mon.exercises[0].sets[0], 90)).toBe(0);
  });
});

describe("averageRest", () => {
  it("averages the gaps between ticks", () => {
    const s = startSession(byId("hyrox-wed-legs"), []);
    s.exercises[0].sets[0].doneAt = 0;
    s.exercises[0].sets[1].doneAt = 90_000;
    s.exercises[0].sets[2].doneAt = 210_000;
    expect(averageRest(s)).toBe(105);
    expect(averageRest(startSession(byId("hyrox-mon-chest"), []))).toBeUndefined();
  });
});
