import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SESSIONS } from "@/lib/sync";
import { SignedOutError, syncNow } from "@/lib/sync-client";
import type { Session } from "@/lib/types";

function session(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    routineId: "r1",
    routineName: "Push",
    startedAt: new Date(2026, 9, 26, 9).getTime(),
    exercises: [{ name: "Bench", sets: [{ done: true }] }],
    ...over,
  } as Session;
}

let posts: { sessions: unknown[] }[] = [];
let serverHas: Session[] = [];
let status = 200;

beforeEach(() => {
  posts = [];
  serverHas = [];
  status = 200;
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    if (status !== 200) return new Response("no", { status });
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return Response.json({ saved: 1 });
    }
    return Response.json({ sessions: serverHas });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("syncNow", () => {
  it("pushes what the server is missing", async () => {
    await syncNow([session({ id: "a" })]);
    expect(posts).toHaveLength(1);
    expect(posts[0].sessions).toHaveLength(1);
  });

  it("pushes nothing when the server already has everything", async () => {
    serverHas = [session({ id: "a" })];
    await syncNow([session({ id: "a" })]);
    expect(posts).toHaveLength(0);
  });

  it("pushes a session the server holds an older copy of", async () => {
    serverHas = [session({ id: "a", endedAt: new Date(2026, 9, 26, 10).getTime() })];
    await syncNow([session({ id: "a", endedAt: new Date(2026, 9, 26, 11).getTime() })]);
    expect(posts).toHaveLength(1);
    expect(posts[0].sessions).toHaveLength(1);
  });

  it("leaves a session alone when the server's copy is the newer one", async () => {
    serverHas = [session({ id: "a", endedAt: new Date(2026, 9, 26, 11).getTime() })];
    await syncNow([session({ id: "a", endedAt: new Date(2026, 9, 26, 10).getTime() })]);
    expect(posts).toHaveLength(0);
  });

  it("returns what the phone and server have between them", async () => {
    serverHas = [session({ id: "b" })];
    expect(await syncNow([session({ id: "a" })])).toBe(2);
  });

  it("splits a big first sync into batches the server will accept", async () => {
    const many = Array.from({ length: MAX_SESSIONS + 5 }, (_, i) => session({ id: `s${i}` }));
    await syncNow(many);
    expect(posts).toHaveLength(2);
    expect(posts[0].sessions).toHaveLength(MAX_SESSIONS);
    expect(posts[1].sessions).toHaveLength(5);
  });

  it("reports being signed out separately from any other failure", async () => {
    status = 401;
    await expect(syncNow([session()])).rejects.toBeInstanceOf(SignedOutError);
  });

  it("reports a server failure without claiming to be signed out", async () => {
    status = 500;
    await expect(syncNow([session()])).rejects.not.toBeInstanceOf(SignedOutError);
  });
});
