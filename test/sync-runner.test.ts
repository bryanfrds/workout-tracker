import { describe, expect, it } from "vitest";
import { createSyncRunner } from "@/lib/sync-runner";

/** A sync whose completion the test controls, one call at a time. */
function controllable() {
  const finish: ((ok: boolean) => void)[] = [];
  const sync = () =>
    new Promise<void>((resolve, reject) => {
      finish.push((ok) => (ok ? resolve() : reject(new Error("nope"))));
    });
  return {
    sync,
    finish,
    get calls() {
      return finish.length;
    },
  };
}

/** Lets every already-queued promise callback run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("createSyncRunner", () => {
  it("syncs once when asked once", async () => {
    const c = controllable();
    createSyncRunner(c.sync).request();
    await settle();
    expect(c.calls).toBe(1);
  });

  it("doesn't start a second sync on top of a running one", async () => {
    const c = controllable();
    const runner = createSyncRunner(c.sync);
    runner.request();
    runner.request();
    await settle();
    expect(c.calls).toBe(1);
  });

  it("syncs again after one that was asked for mid-flight", async () => {
    const c = controllable();
    const runner = createSyncRunner(c.sync);
    runner.request();
    await settle();
    runner.request(); // the workout finished while the first sync was in flight
    c.finish[0](true);
    await settle();
    expect(c.calls).toBe(2);
  });

  it("asking twice mid-flight only syncs once more", async () => {
    const c = controllable();
    const runner = createSyncRunner(c.sync);
    runner.request();
    await settle();
    runner.request();
    runner.request();
    c.finish[0](true);
    await settle();
    expect(c.calls).toBe(2);
    c.finish[1](true);
    await settle();
    expect(c.calls).toBe(2);
  });

  it("doesn't retry straight after a failure", async () => {
    const c = controllable();
    const runner = createSyncRunner(c.sync);
    runner.request();
    await settle();
    runner.request();
    c.finish[0](false);
    await settle();
    expect(c.calls).toBe(1);
  });

  it("keeps working after a failure", async () => {
    const c = controllable();
    const runner = createSyncRunner(c.sync);
    runner.request();
    await settle();
    c.finish[0](false);
    await settle();
    runner.request();
    await settle();
    expect(c.calls).toBe(2);
  });

  it("survives a sync that throws instead of returning a promise", async () => {
    let calls = 0;
    const runner = createSyncRunner(() => {
      calls++;
      throw new Error("nope");
    });
    runner.request();
    await settle();
    runner.request();
    await settle();
    expect(calls).toBe(2);
  });

  it("stops for good once stopped", async () => {
    const c = controllable();
    const runner = createSyncRunner(c.sync);
    runner.request();
    await settle();
    runner.request();
    runner.stop();
    c.finish[0](true);
    await settle();
    expect(c.calls).toBe(1);
    runner.request();
    await settle();
    expect(c.calls).toBe(1);
  });

  // The component makes a fresh runner on every mount, because Strict Mode
  // mounts twice and a stopped runner never runs again.
  it("stopping one runner leaves a later one working", async () => {
    const c = controllable();
    const first = createSyncRunner(c.sync);
    first.request();
    await settle();
    first.stop();

    const second = createSyncRunner(c.sync);
    second.request();
    await settle();
    expect(c.calls).toBe(2);
  });
});
