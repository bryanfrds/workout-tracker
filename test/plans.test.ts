import { describe, expect, it } from "vitest";
import { HYROX_ROUTINES } from "@/lib/hyrox";
import {
  SEED_PLANS,
  activePlan,
  dayRoutines,
  isPlainRestDay,
  liveDays,
  planWeek,
  setPlanDay,
  withCurrentPlan,
  withPlans,
  withoutRoutine,
} from "@/lib/plans";
import { SEED } from "@/lib/store";
import type { AppState, Plan, Session } from "@/lib/types";
import { startSession } from "@/lib/workout";

const hyrox = SEED_PLANS.find((p) => p.id === "hyrox")!;
const ppl = SEED_PLANS.find((p) => p.id === "ppl")!;
const routines = SEED.routines;

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
const app = (sessions: Session[], planSkips: string[] = []) => ({ routines, sessions, planSkips });
const status = (r: ReturnType<typeof planWeek>) => r.days.map((d) => d.status);

describe("seed plans", () => {
  it("HYROX matches the plan routines' days; PPL rests on Sunday", () => {
    expect(dayRoutines(hyrox, 7, routines)).toEqual([]);
    expect(dayRoutines(hyrox, 1, routines).map((r) => r.name)).toEqual(["Chest + triceps + easy run"]);
    expect(dayRoutines(hyrox, 5, routines)[0].restDay).toBe(true);
    expect(ppl.days.map((d) => d[0] ?? "rest")).toEqual(["push", "pull", "legs", "push", "pull", "legs", "rest"]);
  });

  it("adds plans to old saves, and skips PPL if its routines were deleted", () => {
    const base: AppState = { routines, sessions: [], restSeconds: 90 };
    expect(withPlans(base)).toMatchObject({ activePlanId: "hyrox", plans: SEED_PLANS });
    const noPush = withPlans({ ...base, routines: routines.filter((r) => r.id !== "push") });
    expect(noPush.plans?.map((p) => p.id)).toEqual(["hyrox"]);
  });

  it("moves skips saved before plans existed onto HYROX", () => {
    const s = withPlans({ routines, sessions: [], restSeconds: 90, planSkips: ["2026-10-19:3"] });
    expect(s.planSkips).toEqual(["hyrox:2026-10-19:3"]);
    expect(planWeek(s, hyrox, SAT).days[2].status).toBe("skipped");
  });

  it("keeps saved plans and repairs a missing active plan", () => {
    const mine: Plan = { id: "mine", name: "Mine", days: [["push"], [], [], [], [], [], []] };
    const s = withPlans({ routines, sessions: [], restSeconds: 90, plans: [mine] });
    expect(s.plans).toEqual([mine]);
    expect(activePlan(s)?.id).toBe("mine");
    expect(activePlan({ plans: [mine], activePlanId: "gone" })?.id).toBe("mine");
  });
});

describe("withCurrentPlan", () => {
  /** A save made against the plan's first version. */
  const old = (): AppState => ({
    restSeconds: 90,
    sessions: [
      { id: "s1", routineId: "hyrox-tue-lower", routineName: "Lower body + sled", startedAt: 1, endedAt: 2, exercises: [] },
    ],
    activePlanId: "hyrox",
    plans: [
      { id: "hyrox", name: "HYROX week", days: [["hyrox-mon-run"], ["hyrox-tue-lower"], [], [], [], [], ["hyrox-sun-run"]] },
      { id: "ppl", name: "PPL week", days: [["push"], ["pull"], ["legs"], [], [], [], []] },
    ],
    routines: [
      { id: "push", name: "Push day", exercises: [] },
      { id: "hyrox-mon-run", name: "Easy run", plan: "hyrox", day: 1, exercises: [] },
      { id: "hyrox-tue-lower", name: "Lower body + sled", plan: "hyrox", day: 2, exercises: [] },
      { id: "hyrox-sun-run", name: "Easy run", plan: "hyrox", day: 7, exercises: [] },
      { id: "hyrox-sun-basketball", name: "Basketball", plan: "hyrox", day: 7, exercises: [] },
    ],
  });

  it("points the week at the current routines, Sunday included", () => {
    const next = withCurrentPlan(old());
    const days = next.plans!.find((p) => p.id === "hyrox")!.days;
    expect(days[0]).toEqual(["hyrox-mon-chest"]);
    expect(days[6]).toEqual([]);
    expect(days.flat()).toEqual(HYROX_ROUTINES.map((r) => r.id));
  });

  it("drops the routines the new week replaced and refreshes the ones it kept", () => {
    const ids = withCurrentPlan(old()).routines.map((r) => r.id);
    expect(ids).not.toContain("hyrox-tue-lower");
    expect(ids).not.toContain("hyrox-sun-run");
    expect(ids).toContain("push");
  });

  it("keeps the easy run and basketball for one-off logging, off the plan", () => {
    const spare = withCurrentPlan(old()).routines.filter((r) => r.id.startsWith("hyrox-sun-basketball") || r.name === "Easy run");
    expect(spare.map((r) => r.name)).toEqual(["Easy run", "Basketball"]);
    for (const r of spare) expect(r.plan).toBeUndefined();
  });

  it("leaves other plans and finished sessions alone", () => {
    const next = withCurrentPlan(old());
    expect(next.plans!.find((p) => p.id === "ppl")).toEqual(old().plans![1]);
    expect(next.sessions).toEqual(old().sessions);
  });

  it("does nothing to a save that's already current", () => {
    const once = withCurrentPlan(old());
    expect(withCurrentPlan(once)).toBe(once);
    expect(withCurrentPlan(SEED)).toBe(SEED);
  });
});

describe("planWeek (HYROX)", () => {
  it("marks done, skipped, missed, today and upcoming", () => {
    const r = planWeek(
      app([finished("hyrox-mon-chest", at(2026, 9, 19)), finished("hyrox-thu-intervals", at(2026, 9, 22))], ["hyrox:2026-10-19:2"]),
      hyrox,
      SAT,
    );
    expect(status(r)).toEqual(["done", "skipped", "missed", "done", "missed", "today", "rest"]);
    expect(r.doneCount).toBe(2);
    expect(r.trainingDays).toBe(6);
  });

  it("leaves Sunday a rest day whatever was logged on it", () => {
    const r = planWeek(app([finished("hyrox-sun-basketball", at(2026, 9, 25))], ["hyrox:2026-10-19:7"]), hyrox, SAT);
    expect(r.days[6]).toMatchObject({ status: "rest", routines: [] });
  });

  it("counts a logged rest day as done for Friday", () => {
    const r = planWeek(app([finished("hyrox-fri-recovery", at(2026, 9, 23), { restDay: true })]), hyrox, SAT);
    expect(r.days[4].status).toBe("done");
  });

  it("ignores unfinished sessions, last week's sessions and routines not in the plan", () => {
    const r = planWeek(
      app([
        { ...finished("hyrox-mon-chest", at(2026, 9, 19)), endedAt: undefined },
        finished("hyrox-wed-legs", at(2026, 9, 18, 23)),
        finished("push", at(2026, 9, 20)),
      ]),
      hyrox,
      SAT,
    );
    expect(r.doneCount).toBe(0);
  });

  it("puts sessions in the right week across a daylight-saving change", () => {
    const satNight = new Date(2026, 2, 28, 23, 30).getTime(); // Sat 28 Mar 2026, the weekend the clocks go forward
    const done = planWeek(app([finished("hyrox-sat-conditioning", satNight)]), hyrox, new Date(2026, 2, 28, 23, 45));
    expect(done.days[5].status).toBe("done");
    const next = planWeek(app([finished("hyrox-sat-conditioning", satNight)]), hyrox, new Date(2026, 2, 30, 0, 15));
    expect(next.days[5].status).toBe("upcoming");
    expect(next.recent.at(-2)?.done).toBe(1);
  });

  it("only counts skips for this plan", () => {
    const r = planWeek(app([], ["ppl:2026-10-19:2"]), hyrox, SAT);
    expect(r.days[1].status).toBe("missed");
  });
});

describe("planWeek (PPL, same workout twice a week)", () => {
  it("Monday's push doesn't tick Thursday's push", () => {
    const r = planWeek(app([finished("push", at(2026, 9, 19))]), ppl, SAT);
    expect(status(r)).toEqual(["done", "missed", "missed", "missed", "missed", "today", "rest"]);
    expect(r.trainingDays).toBe(6);
  });

  it("a push done on Thursday fills Thursday, and a second one fills Monday", () => {
    expect(planWeek(app([finished("push", at(2026, 9, 22))]), ppl, SAT).days.map((d) => d.status)[3]).toBe("done");
    const both = planWeek(app([finished("push", at(2026, 9, 22)), finished("push", at(2026, 9, 22, 18))]), ppl, SAT);
    expect([both.days[0].status, both.days[3].status]).toEqual(["done", "done"]);
  });

  it("a push done on a non-push day fills the earliest open push day", () => {
    const r = planWeek(app([finished("push", at(2026, 9, 21))]), ppl, SAT); // Wednesday
    expect(r.days[0].status).toBe("done");
    expect(r.days[3].status).toBe("missed");
  });

  it("counts plan days done per week, not sessions", () => {
    const r = planWeek(
      app([finished("push", at(2026, 9, 12)), finished("push", at(2026, 9, 13)), finished("push", at(2026, 9, 14))]),
      ppl,
      SAT,
    );
    expect(r.recent.at(-2)?.done).toBe(2); // only two push days in a week
  });

  it("treats a deleted routine's day as rest", () => {
    const r = planWeek({ routines: routines.filter((x) => x.id !== "legs"), sessions: [] }, ppl, SAT);
    expect(r.days[2].status).toBe("rest");
    expect(r.trainingDays).toBe(4);
  });
});

describe("isPlainRestDay", () => {
  it("is true only for a rest day with nothing ticked", () => {
    const fri = startSession(HYROX_ROUTINES.find((r) => r.id === "hyrox-fri-recovery")!, []);
    expect(isPlainRestDay(fri)).toBe(true);
    fri.exercises[0].sets[0].done = true;
    expect(isPlainRestDay(fri)).toBe(false);
  });
});

describe("deleted routines", () => {
  const noPush = routines.filter((r) => r.id !== "push");

  it("are removed from every plan when deleted", () => {
    const plans = withoutRoutine(SEED_PLANS, "push")!;
    expect(plans.find((p) => p.id === "ppl")!.days.map((d) => d[0] ?? "rest")).toEqual([
      "rest", "pull", "legs", "rest", "pull", "legs", "rest",
    ]);
    expect(plans.find((p) => p.id === "hyrox")).toEqual(hyrox);
  });

  it("are dropped when an old plan is opened in the editor", () => {
    expect(liveDays(ppl, noPush)[0]).toEqual([]);
  });

  it("don't mark a day done from an old session of that routine", () => {
    const r = planWeek({ routines: noPush, sessions: [finished("push", at(2026, 9, 19))] }, ppl, SAT);
    expect(r.days[0].status).toBe("rest");
    expect(r.doneCount).toBe(0);
    expect(r.trainingDays).toBe(4);
  });
});

describe("day matching with alternatives", () => {
  it("moves an earlier match to fit a later session in", () => {
    // Mon = push or pull, Wed = push. Push Monday then pull Tuesday should fill both days.
    const plan: Plan = { id: "x", name: "x", days: [["push", "pull"], [], ["push"], [], [], [], []] };
    const r = planWeek(app([finished("push", at(2026, 9, 19)), finished("pull", at(2026, 9, 20))]), plan, SAT);
    expect(r.doneCount).toBe(2);
    expect(r.days[0].session?.routineId).toBe("pull");
    expect(r.days[2].session?.routineId).toBe("push");
  });
});

describe("setPlanDay", () => {
  const week = () => [["push", "pull"], [], [], [], [], [], []];

  it("sets, clears and dedupes choices", () => {
    expect(setPlanDay(week(), 1, 0, "legs")[1]).toEqual(["legs"]);
    expect(setPlanDay(week(), 0, 1, "")[0]).toEqual(["push"]);
    expect(setPlanDay(week(), 0, 0, "")[0]).toEqual([]);
    expect(setPlanDay(week(), 0, 0, "pull")[0]).toEqual(["pull"]);
  });
});
