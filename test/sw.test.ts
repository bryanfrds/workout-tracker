import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import manifest from "../src/app/manifest";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

/** Loads public/sw.js against a fake service-worker global and returns its listeners. */
function loadWorker(windows: unknown[] = []) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = {
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn(() => Promise.resolve(windows)),
      openWindow: vi.fn(() => Promise.resolve(null)),
    },
    skipWaiting: vi.fn(),
  };
  runInNewContext(source, { self });
  return { self, listeners };
}

/** Fires an event and waits for whatever it passed to waitUntil. */
async function fire(listener: (e: unknown) => void, event: object) {
  let pending: Promise<unknown> = Promise.resolve();
  listener({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
  await pending;
}

describe("push", () => {
  it("shows the JSON payload", async () => {
    const { self, listeners } = loadWorker();
    const data = { json: () => ({ title: "Rest's over", body: "Next: Bench", tag: "rest", url: "/workout" }) };
    await fire(listeners.push, { data });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "Rest's over",
      expect.objectContaining({ body: "Next: Bench", tag: "rest", data: { url: "/workout" } }),
    );
  });

  it("still shows a notification for a non-JSON payload", async () => {
    const { self, listeners } = loadWorker();
    const data = {
      json: () => {
        throw new SyntaxError("bad json");
      },
      text: () => "plain text",
    };
    await fire(listeners.push, { data });
    expect(self.registration.showNotification).toHaveBeenCalledWith("Workout", expect.objectContaining({ body: "plain text" }));
  });
});

describe("notificationclick", () => {
  const notification = () => ({ close: vi.fn(), data: { url: "/workout" } });

  it("focuses an open window and navigates it", async () => {
    const win = { focus: vi.fn(), navigate: vi.fn(() => Promise.resolve()) };
    win.focus.mockResolvedValue(win);
    const { self, listeners } = loadWorker([win]);
    await fire(listeners.notificationclick, { notification: notification() });
    expect(win.navigate).toHaveBeenCalledWith("/workout");
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when navigating the open one fails", async () => {
    const win = { focus: vi.fn(), navigate: vi.fn(() => Promise.reject(new TypeError("not controlled"))) };
    win.focus.mockResolvedValue(win);
    const { self, listeners } = loadWorker([win]);
    await fire(listeners.notificationclick, { notification: notification() });
    expect(self.clients.openWindow).toHaveBeenCalledWith("/workout");
  });

  it("opens a new window when none is open", async () => {
    const { self, listeners } = loadWorker([]);
    const n = notification();
    await fire(listeners.notificationclick, { notification: n });
    expect(n.close).toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith("/workout");
  });
});

describe("manifest", () => {
  it("opens standalone and has both icon sizes", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.id).toBe("/");
    expect(m.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
  });
});
