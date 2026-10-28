import { describe, expect, it } from "vitest";
import { isSyncSession, mergeSessions, toRow, toSync } from "@/lib/sync";
import type { Session } from "@/lib/types";

function session(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    routineId: "r1",
    routineName: "Push",
    startedAt: new Date(2026, 9, 26, 9).getTime(),
    exercises: [{ name: "Bench", sets: [{ done: true, kg: 60, reps: 8 }] }],
    ...over,
  } as Session;
}

describe("toSync", () => {
  it("records the calendar day the phone showed, not the UTC one", () => {
    // 00:30 local is the previous day in UTC east of Greenwich.
    const s = toSync(session({ startedAt: new Date(2026, 9, 26, 0, 30).getTime() }));
    expect(s.startedOn).toBe("2026-10-26");
  });

  it("reports the offset as minutes east of UTC", () => {
    const s = toSync(session());
    expect(s.offsetMinutes).toBe(-new Date(s.session.startedAt).getTimezoneOffset());
  });
});

describe("isSyncSession", () => {
  const good = toSync(session());

  it("accepts what toSync produces", () => {
    expect(isSyncSession(good)).toBe(true);
  });

  it.each([
    ["no session", { ...good, session: undefined }],
    ["a malformed day", { ...good, startedOn: "26/10/2026" }],
    ["an impossible offset", { ...good, offsetMinutes: 99999 }],
    ["a non-numeric start", { ...good, session: { ...good.session, startedAt: "nine" } }],
    ["an empty id", { ...good, session: { ...good.session, id: "" } }],
    ["exercises that aren't a list", { ...good, session: { ...good.session, exercises: {} } }],
    ["nothing at all", null],
    ["a string", "sessions"],
  ])("rejects %s", (_label, value) => {
    expect(isSyncSession(value)).toBe(false);
  });

  it("rejects an id long enough to be an attack", () => {
    expect(isSyncSession({ ...good, session: { ...good.session, id: "x".repeat(129) } })).toBe(false);
  });
});

describe("toRow", () => {
  it("marks a rest day with nothing ticked so it won't count", () => {
    const rest = session({
      restDay: true,
      routineName: "Rest",
      exercises: [{ name: "Rest", sets: [{ done: false }] }],
    } as Partial<Session>);
    expect(toRow("u1", toSync(rest)).plainRestDay).toBe(true);
  });

  it("does not take the client's word for a rest day", () => {
    // restDay is set, but a set was ticked, so it counts as a real workout.
    const worked = session({ restDay: true } as Partial<Session>);
    expect(toRow("u1", toSync(worked)).plainRestDay).toBe(false);
  });

  it("stamps the row with the signed-in user, not anything from the payload", () => {
    const row = toRow("u1", toSync(session()));
    expect(row.userId).toBe("u1");
  });

  it("leaves ended_at null for a session still running", () => {
    expect(toRow("u1", toSync(session({ endedAt: undefined }))).endedAt).toBeNull();
  });
});

describe("mergeSessions", () => {
  it("keeps both sides when the ids differ", () => {
    const merged = mergeSessions([session({ id: "a" })], [session({ id: "b" })]);
    expect(merged.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("never duplicates the same session", () => {
    const s = session({ id: "a" });
    expect(mergeSessions([s], [s])).toHaveLength(1);
  });

  it("prefers the version finished later", () => {
    const old = session({ id: "a", endedAt: 1000, rpe: 5 } as Partial<Session>);
    const fresh = session({ id: "a", endedAt: 2000, rpe: 9 } as Partial<Session>);
    expect(mergeSessions([old], [fresh])[0].rpe).toBe(9);
    expect(mergeSessions([fresh], [old])[0].rpe).toBe(9);
  });

  it("returns them oldest first", () => {
    const merged = mergeSessions(
      [session({ id: "b", startedAt: 2000 })],
      [session({ id: "a", startedAt: 1000 })],
    );
    expect(merged.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
