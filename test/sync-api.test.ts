import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SESSIONS, toSync } from "@/lib/sync";
import type { Session } from "@/lib/types";

vi.mock("server-only", () => ({}));

const authed = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authed }));

/**
 * A stand-in for the neon tagged-template client. Every call records the SQL
 * and the values it was given, so tests can assert on what reached the database
 * rather than trusting the route.
 */
const calls = vi.hoisted(() => [] as { text: string; values: unknown[] }[]);
const rows = vi.hoisted(() => ({ get: [] as unknown[] }));
const dbFn = vi.hoisted(() => {
  const fn = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    calls.push({ text, values });
    if (text.includes("count(*)")) return Promise.resolve([{ n: 0 }]);
    if (text.includes("select data")) return Promise.resolve(rows.get);
    return Promise.resolve([]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn as any).transaction = (qs: unknown[]) => Promise.all(qs);
  return fn;
});
vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, sql: () => dbFn };
});

const { GET, POST } = await import("@/app/api/sync/route");

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

function post(body: unknown): Request {
  return new Request("http://localhost/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const signedIn = { user: { id: "user-a", email: "a@example.com", name: "A" } };

beforeEach(() => {
  calls.length = 0;
  rows.get = [];
  authed.mockReset();
});

describe("signed out", () => {
  it("refuses to read", async () => {
    authed.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("refuses to write, and touches no database", async () => {
    authed.mockResolvedValue(null);
    const res = await POST(post({ sessions: [toSync(session())] }));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("refuses a session with no id on the token", async () => {
    authed.mockResolvedValue({ user: { email: "a@example.com" } });
    expect((await GET()).status).toBe(401);
  });
});

describe("reading", () => {
  it("only ever asks for the signed-in user's rows", async () => {
    authed.mockResolvedValue(signedIn);
    rows.get = [{ data: session() }];
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [session()] });
    const read = calls.find((c) => c.text.includes("select data"))!;
    expect(read.values).toContain("user-a");
    expect(read.text).toContain("where user_id =");
  });
});

describe("writing", () => {
  beforeEach(() => authed.mockResolvedValue(signedIn));

  it("stamps rows with the signed-in user, ignoring any id in the payload", async () => {
    const payload = { ...toSync(session()), userId: "someone-else", user_id: "someone-else" };
    const res = await POST(post({ sessions: [payload] }));
    expect(res.status).toBe(200);

    const insert = calls.find((c) => c.text.includes("insert into workout_sessions"))!;
    expect(insert.values).toContain("user-a");
    expect(insert.values).not.toContain("someone-else");
  });

  it("saves nothing and asks for nothing when the list is empty", async () => {
    const res = await POST(post({ sessions: [] }));
    expect(await res.json()).toEqual({ saved: 0 });
    expect(calls.some((c) => c.text.includes("insert into workout_sessions"))).toBe(false);
  });

  it.each([
    ["a body that isn't JSON", "not json", 400],
    ["no sessions array", { sessions: "all of them" }, 400],
    ["a malformed session", { sessions: [{ startedOn: "nope" }] }, 400],
  ])("rejects %s", async (_label, body, status) => {
    expect((await POST(post(body))).status).toBe(status);
  });

  it("refuses more sessions than it will accept at once", async () => {
    const many = Array.from({ length: MAX_SESSIONS + 1 }, (_, i) => toSync(session({ id: `s${i}` })));
    expect((await POST(post({ sessions: many }))).status).toBe(413);
  });

  it("accepts exactly the maximum", async () => {
    const many = Array.from({ length: MAX_SESSIONS }, (_, i) => toSync(session({ id: `s${i}` })));
    expect((await POST(post({ sessions: many }))).status).toBe(200);
  });

  it.each([
    ["a date beyond what Date can hold", { startedAt: 1e16 }],
    ["an end date beyond what Date can hold", { endedAt: 1e16 }],
    ["a rest day whose exercises are null", { restDay: true, exercises: [null] }],
    ["an exercise with no sets", { exercises: [{ name: "Bench" }] }],
  ])("rejects %s rather than failing mid-batch", async (_label, over) => {
    const bad = { ...toSync(session()), session: { ...session(), ...over } };
    const res = await POST(post({ sessions: [bad] }));
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.text.includes("insert into workout_sessions"))).toBe(false);
  });

  it("rejects an impossible calendar day before it reaches a date column", async () => {
    const bad = { ...toSync(session()), startedOn: "2026-99-99" };
    expect((await POST(post({ sessions: [bad] }))).status).toBe(400);
  });

  it("answers plainly when the database is unreachable", async () => {
    const { NoDatabaseError } = await import("@/lib/db");
    const boom = vi.spyOn(await import("@/lib/db"), "sql").mockImplementation(() => {
      throw new NoDatabaseError("DATABASE_URL is not set.");
    });
    const res = await POST(post({ sessions: [toSync(session())] }));
    expect(res.status).toBe(503);
    boom.mockRestore();
  });
});
