import { beforeEach, describe, expect, it, vi } from "vitest";

const qstash = vi.hoisted(() => ({
  publishJSON: vi.fn(),
  messages: { delete: vi.fn() },
  schedules: { create: vi.fn(), delete: vi.fn() },
}));
const sendNotification = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@upstash/qstash", () => ({ Client: vi.fn(() => qstash) }));
// The real wrapper checks QStash's signature; here we test the handler inside it.
vi.mock("@upstash/qstash/nextjs", () => ({ verifySignatureAppRouter: (h: unknown) => h }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

import * as push from "@/app/api/push/route";
import * as reminder from "@/app/api/reminder/route";
import * as rest from "@/app/api/rest/route";
import { isSubscription } from "@/lib/push-server";

const sub = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "p", auth: "a" } };
const post = (path: string, body: unknown) =>
  new Request(`https://app.test${path}`, { method: "POST", body: JSON.stringify(body) });
const del = (path: string) => new Request(`https://app.test${path}`, { method: "DELETE" });

beforeEach(() => vi.clearAllMocks());

describe("isSubscription", () => {
  it("accepts a real-looking subscription and rejects others", () => {
    expect(isSubscription(sub)).toBe(true);
    expect(isSubscription({ ...sub, endpoint: "http://insecure" })).toBe(false);
    expect(isSubscription({ endpoint: sub.endpoint })).toBe(false);
    expect(isSubscription(null)).toBe(false);
  });
});

describe("/api/rest", () => {
  it("schedules a delayed push to /api/push", async () => {
    qstash.publishJSON.mockResolvedValue({ messageId: "msg_1" });
    const res = await rest.POST(post("/api/rest", { subscription: sub, delaySeconds: 89.6, body: "Next: Bench" }));
    expect(await res.json()).toEqual({ id: "msg_1" });
    expect(qstash.publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://app.test/api/push",
        delay: 90,
        body: { subscription: sub, payload: expect.objectContaining({ title: "Rest's over", body: "Next: Bench" }) },
      }),
    );
  });

  it("rejects bad delays and subscriptions", async () => {
    for (const body of [
      { subscription: sub, delaySeconds: -1, body: "x" },
      { subscription: sub, delaySeconds: 60 * 60, body: "x" },
      { subscription: sub, delaySeconds: "90", body: "x" },
      { subscription: { endpoint: "nope" }, delaySeconds: 90, body: "x" },
    ]) {
      expect((await rest.POST(post("/api/rest", body))).status).toBe(400);
    }
    expect(qstash.publishJSON).not.toHaveBeenCalled();
  });

  it("cancels, and doesn't fail if the message is already gone", async () => {
    qstash.messages.delete.mockRejectedValue(new Error("not found"));
    const res = await rest.DELETE(del("/api/rest?id=msg_1"));
    expect(res.status).toBe(200);
    expect(qstash.messages.delete).toHaveBeenCalledWith("msg_1");
    expect((await rest.DELETE(del("/api/rest"))).status).toBe(400);
  });
});

describe("/api/reminder", () => {
  it("creates a daily schedule in the phone's time zone", async () => {
    qstash.schedules.create.mockResolvedValue({ scheduleId: "scd_1" });
    const res = await reminder.POST(
      post("/api/reminder", { subscription: sub, time: "07:05", timeZone: "Asia/Kuala_Lumpur" }),
    );
    expect(await res.json()).toEqual({ id: "scd_1" });
    expect(qstash.schedules.create).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "https://app.test/api/push", cron: "CRON_TZ=Asia/Kuala_Lumpur 5 7 * * *" }),
    );
  });

  it("rejects bad times and time zones", async () => {
    for (const [time, timeZone] of [
      ["25:00", "Asia/Kuala_Lumpur"],
      ["7:05", "Asia/Kuala_Lumpur"],
      ["07:05", "Asia/Kuala_Lumpur * * * * curl"],
    ]) {
      expect((await reminder.POST(post("/api/reminder", { subscription: sub, time, timeZone }))).status).toBe(400);
    }
    expect(qstash.schedules.create).not.toHaveBeenCalled();
  });
});

describe("/api/push", () => {
  const payload = { title: "Rest's over", body: "Next: Bench" };

  it("sends the push", async () => {
    sendNotification.mockResolvedValue({});
    const res = await push.POST(post("/api/push", { subscription: sub, payload }));
    expect(await res.json()).toEqual({ delivered: true });
    expect(sendNotification).toHaveBeenCalledWith(sub, JSON.stringify(payload), { TTL: 300 });
  });

  it("returns 200 for a dead subscription so QStash doesn't retry", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const res = await push.POST(post("/api/push", { subscription: sub, payload }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ delivered: false });
  });

  it("rejects a bad body", async () => {
    expect((await push.POST(post("/api/push", { subscription: sub }))).status).toBe(400);
  });
});
