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
    expect(dayRoutines(hyrox, 7, routines).map((r) => r.name)).toEqual(["Easy run", "Basketball"]);
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

describe("planWeek (HYROX)", () => {
  it("marks done, skipped, missed, today and upcoming", () => {
    const r = planWeek(
      app([finished("hyrox-mon-run", at(2026, 9, 19)), finished("hyrox-thu-intervals", at(2026, 9, 22))], ["hyrox:2026-10-19:2"]),
      hyrox,
      SAT,
    );
    expect(status(r)).toEqual(["done", "skipped", "missed", "done", "missed", "today", "upcoming"]);
    expect(r.doneCount).toBe(2);
    expect(r.trainingDays).toBe(7);
  });

  it("counts either Sunday option, and done beats skipped", () => {
    const r = planWeek(app([finished("hyrox-sun-basketball", at(2026, 9, 24))], ["hyrox:2026-10-19:7"]), hyrox, SAT);
    expect(r.days[6]).toMatchObject({ status: "done", session: { routineId: "hyrox-sun-basketball" } });
  });

  it("counts a logged rest day as done for Friday", () => {
    const r = planWeek(app([finished("hyrox-fri-rest", at(2026, 9, 23), { restDay: true })]), hyrox, SAT);
    expect(r.days[4].status).toBe("done");
  });

  it("ignores unfinished sessions, last week's sessions and routines not in the plan", () => {
    const r = planWeek(
      app([
        { ...finished("hyrox-mon-run", at(2026, 9, 19)), endedAt: undefined },
        finished("hyrox-tue-lower", at(2026, 9, 18, 23)),
        finished("push", at(2026, 9, 20)),
      ]),
      hyrox,
      SAT,
    );
    expect(r.doneCount).toBe(0);
  });

  it("puts sessions in the right week across a daylight-saving change", () => {
    const sunNight = new Date(2026, 2, 29, 23, 30).getTime(); // Sun 29 Mar 2026 (EU DST change)
    expect(planWeek(app([finished("hyrox-sun-run", sunNight)]), hyrox, new Date(2026, 2, 29, 23, 45)).days[6].status).toBe("done");
    const next = planWeek(app([finished("hyrox-sun-run", sunNight)]), hyrox, new Date(2026, 2, 30, 0, 15));
    expect(next.days[6].status).toBe("upcoming");
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
    const fri = startSession(HYROX_ROUTINES.find((r) => r.id === "hyrox-fri-rest")!, []);
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
