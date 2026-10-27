import { describe, expect, it } from "vitest";
import { countsByDay, currentStreak, dayKey, heatmapColumns, heatmapTotal, monthLabels, WEEKS } from "./heatmap";
import type { Session } from "./types";

function session(date: string, over: Partial<Session> = {}): Session {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: date + Math.random(),
    routineId: "r1",
    routineName: "Push",
    startedAt: new Date(y, m - 1, d, 9).getTime(),
    exercises: [{ name: "Bench", kind: "strength", sets: [{ done: true, kg: 60, reps: 8 }] }],
    ...over,
  } as Session;
}

/** A rest day logged with nothing ticked — shouldn't colour a square. */
function restDay(date: string): Session {
  return session(date, {
    restDay: true,
    routineName: "Rest",
    exercises: [{ name: "Rest", kind: "time", sets: [{ done: false }] }],
  } as Partial<Session>);
}

describe("dayKey", () => {
  it("pads months and days", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses local time, not UTC", () => {
    // 00:30 local would be the previous day in UTC for positive offsets.
    expect(dayKey(new Date(2026, 9, 26, 0, 30))).toBe("2026-10-26");
  });
});

describe("countsByDay", () => {
  it("counts two workouts on the same day", () => {
    const counts = countsByDay([session("2026-10-20"), session("2026-10-20"), session("2026-10-21")]);
    expect(counts.get("2026-10-20")).toBe(2);
    expect(counts.get("2026-10-21")).toBe(1);
  });

  it("ignores plain rest days", () => {
    expect(countsByDay([restDay("2026-10-20")]).size).toBe(0);
  });
});

describe("heatmapColumns", () => {
  const today = new Date(2026, 9, 28); // Wednesday 28 Oct 2026

  it("returns a year of Monday-first columns", () => {
    const cols = heatmapColumns([], today);
    expect(cols).toHaveLength(WEEKS);
    expect(cols.every((c) => c.cells.length === 7)).toBe(true);
  });

  it("ends on today, with the rest of the week blank", () => {
    const cols = heatmapColumns([], today);
    const last = cols[cols.length - 1];
    // Wednesday is index 2, so Mon–Wed are cells and Thu–Sun are null.
    expect(last.cells.slice(0, 3).every((c) => c !== null)).toBe(true);
    expect(last.cells.slice(3).every((c) => c === null)).toBe(true);
    expect(last.cells[2]?.key).toBe("2026-10-28");
  });

  it("places a workout on its own square", () => {
    const cols = heatmapColumns([session("2026-10-26")], today);
    const found = cols.flatMap((c) => c.cells).find((c) => c?.key === "2026-10-26");
    expect(found?.count).toBe(1);
    expect(found?.level).toBe(1);
  });

  it("caps the shade at level 4", () => {
    const six = Array.from({ length: 6 }, () => session("2026-10-26"));
    const cols = heatmapColumns(six, today);
    const found = cols.flatMap((c) => c.cells).find((c) => c?.key === "2026-10-26");
    expect(found?.count).toBe(6);
    expect(found?.level).toBe(4);
  });

  it("drops workouts older than the window", () => {
    const cols = heatmapColumns([session("2020-01-01")], today);
    expect(heatmapTotal(cols)).toBe(0);
  });

  it("survives a spring-forward clock change", () => {
    // Every column must still hold exactly 7 distinct days.
    const cols = heatmapColumns([], new Date(2026, 3, 1));
    for (const col of cols) {
      const keys = col.cells.filter(Boolean).map((c) => c!.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("monthLabels", () => {
  it("labels a column only when the month changes", () => {
    const cols = heatmapColumns([], new Date(2026, 9, 28));
    const labels = monthLabels(cols);
    expect(labels[0]).toBeNull();
    expect(labels.filter(Boolean).length).toBeGreaterThanOrEqual(11);
    expect(labels.filter(Boolean).length).toBeLessThanOrEqual(13);
  });
});

describe("currentStreak", () => {
  const today = new Date(2026, 9, 28);

  it("counts back from today", () => {
    const s = [session("2026-10-28"), session("2026-10-27"), session("2026-10-26")];
    expect(currentStreak(s, today)).toBe(3);
  });

  it("keeps yesterday's streak when today isn't done yet", () => {
    expect(currentStreak([session("2026-10-27"), session("2026-10-26")], today)).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(currentStreak([session("2026-10-28"), session("2026-10-26")], today)).toBe(1);
  });

  it("is zero with no workouts", () => {
    expect(currentStreak([], today)).toBe(0);
  });
});
