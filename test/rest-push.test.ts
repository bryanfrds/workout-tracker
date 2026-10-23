import { describe, expect, it, vi } from "vitest";
import { createRestPushSync } from "@/lib/rest-push";
import type { AppState } from "@/lib/types";
import { startSession } from "@/lib/workout";

const subscription = { endpoint: "https://web.push.apple.com/x", keys: { p256dh: "p", auth: "a" } };
const routine = { id: "r", name: "Push", exercises: [{ name: "Bench", sets: 2, kg: 60, reps: 8 }] };
const NOW = 1_000_000;

/** A fake app with a controllable scheduler: each schedule() call waits until resolved by hand. */
function setup(initial: Partial<AppState> = {}) {
  let state: AppState = {
    routines: [routine],
    sessions: [],
    restSeconds: 90,
    active: startSession(routine, [], NOW),
    notifications: { subscription },
    ...initial,
  };
  const pending: Array<(id: string) => void> = [];
  const deps = {
    getState: () => state,
    setState: (fn: (s: AppState) => AppState) => (state = fn(state)),
    schedule: vi.fn(() => new Promise<string>((resolve) => pending.push(resolve))),
    cancel: vi.fn(),
    now: () => NOW,
  };
  const sync = createRestPushSync(deps);
  const setRest = (endsAt: number | undefined) => {
    state = { ...state, active: state.active && { ...state.active, restEndsAt: endsAt } };
    sync();
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { deps, sync, setRest, pending, flush, get state() { return state; } };
}

describe("rest push sync", () => {
  it("schedules one push when rest starts, with what's next", async () => {
    const t = setup();
    t.setRest(NOW + 90_000);
    expect(t.deps.schedule).toHaveBeenCalledWith(subscription, 90, "Next: Bench · set 1 of 2 · 60 kg × 8");
    t.pending[0]("tok1");
    await t.flush();
    expect(t.state.restPush).toEqual({ endsAt: NOW + 90_000, id: "tok1" });
  });

  it("does nothing more when nothing changed", async () => {
    const t = setup();
    t.setRest(NOW + 90_000);
    t.pending[0]("tok1");
    await t.flush();
    t.sync();
    expect(t.deps.schedule).toHaveBeenCalledTimes(1);
    expect(t.deps.cancel).not.toHaveBeenCalled();
  });

  it("cancels on skip", async () => {
    const t = setup();
    t.setRest(NOW + 90_000);
    t.pending[0]("tok1");
    await t.flush();
    t.setRest(undefined);
    expect(t.deps.cancel).toHaveBeenCalledWith("tok1");
    expect(t.state.restPush).toBeUndefined();
  });

  it("reschedules on +15s", async () => {
    const t = setup();
    t.setRest(NOW + 90_000);
    t.pending[0]("tok1");
    await t.flush();
    t.setRest(NOW + 105_000);
    expect(t.deps.cancel).toHaveBeenCalledWith("tok1");
    t.pending[1]("tok2");
    await t.flush();
    expect(t.state.restPush).toEqual({ endsAt: NOW + 105_000, id: "tok2" });
  });

  it("never keeps two pushes when +15s then −15s overlap in flight", async () => {
    const t = setup();
    t.setRest(NOW + 90_000); // A
    t.setRest(NOW + 105_000); // B
    t.setRest(NOW + 90_000); // back to A
    // Replies arrive out of order.
    t.pending[2]("tokA2");
    t.pending[0]("tokA1");
    t.pending[1]("tokB");
    await t.flush();
    expect(t.state.restPush).toEqual({ endsAt: NOW + 90_000, id: "tokA2" });
    expect(t.deps.cancel).toHaveBeenCalledWith("tokA1");
    expect(t.deps.cancel).toHaveBeenCalledWith("tokB");
    expect(t.deps.cancel).not.toHaveBeenCalledWith("tokA2");
  });

  it("schedules a running rest when notifications are turned on mid-rest", () => {
    const t = setup({ notifications: undefined });
    t.setRest(NOW + 60_000);
    expect(t.deps.schedule).not.toHaveBeenCalled();
    t.deps.setState((s) => ({ ...s, notifications: { subscription } }));
    t.sync();
    expect(t.deps.schedule).toHaveBeenCalledWith(subscription, 60, expect.any(String));
  });

  it("cancels the pending push when notifications are turned off mid-rest", async () => {
    const t = setup();
    t.setRest(NOW + 90_000);
    t.pending[0]("tok1");
    await t.flush();
    t.deps.setState((s) => ({ ...s, notifications: undefined }));
    t.sync();
    expect(t.deps.cancel).toHaveBeenCalledWith("tok1");
  });

  it("keeps the saved push on a cold launch mid-rest", () => {
    const t = setup({ restPush: { endsAt: NOW + 30_000, id: "tok1" } });
    t.setRest(NOW + 30_000);
    expect(t.deps.schedule).not.toHaveBeenCalled();
    expect(t.deps.cancel).not.toHaveBeenCalled();
  });

  it("ignores a scheduling failure", async () => {
    const t = setup();
    t.deps.schedule.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    t.setRest(NOW + 90_000);
    await t.flush();
    expect(t.state.restPush).toBeUndefined();
  });
});
