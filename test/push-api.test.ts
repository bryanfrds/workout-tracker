import { beforeEach, describe, expect, it, vi } from "vitest";

const qstash = vi.hoisted(() => ({
  publishJSON: vi.fn(),
  messages: { delete: vi.fn() },
  schedules: { create: vi.fn(), delete: vi.fn(), list: vi.fn() },
}));
const sendNotification = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
const verify = vi.hoisted(() => vi.fn(async ({ signature }: { signature: string }) => signature === "good"));
vi.mock("@upstash/qstash", () => ({ Client: vi.fn(() => qstash), Receiver: vi.fn(() => ({ verify })) }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

import * as push from "@/app/api/push/route";
import * as reminder from "@/app/api/reminder/route";
import * as rest from "@/app/api/rest/route";
import { cancelToken, isSubscription, isTimeZone, readCancelToken } from "@/lib/push-server";

process.env.VAPID_PRIVATE_KEY = "test-secret";

const sub = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "p", auth: "a" } };
const post = (path: string, body: unknown, headers?: HeadersInit) =>
  new Request(`https://app.test${path}`, { method: "POST", body: JSON.stringify(body), headers });
const del = (path: string) => new Request(`https://app.test${path}`, { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  qstash.schedules.list.mockResolvedValue([]);
});

describe("isSubscription", () => {
  it("accepts real push services only", () => {
    expect(isSubscription(sub)).toBe(true);
    expect(isSubscription({ ...sub, endpoint: "https://fcm.googleapis.com/fcm/send/x" })).toBe(true);
    expect(isSubscription({ ...sub, endpoint: "https://db5.notify.windows.com/w/?token=x" })).toBe(true);
    expect(isSubscription({ ...sub, endpoint: "https://evil.example/hook" })).toBe(false);
    expect(isSubscription({ ...sub, endpoint: "https://web.push.apple.com.evil.example/x" })).toBe(false);
    expect(isSubscription({ ...sub, endpoint: "http://web.push.apple.com/x" })).toBe(false);
    expect(isSubscription({ endpoint: sub.endpoint })).toBe(false);
    expect(isSubscription(null)).toBe(false);
  });
});

describe("isTimeZone", () => {
  it("accepts real IANA names and rejects the rest", () => {
    for (const tz of ["Asia/Kuala_Lumpur", "Etc/GMT+5", "America/Argentina/Buenos_Aires", "UTC"]) {
      expect(isTimeZone(tz)).toBe(true);
    }
    for (const tz of ["Foo", "Asia/Kuala_Lumpur * * * * x", "", 5]) expect(isTimeZone(tz)).toBe(false);
  });
});

describe("cancel tokens", () => {
  it("only accept tokens this server signed, with the right prefix", () => {
    expect(readCancelToken(cancelToken("msg_1"), "msg_")).toBe("msg_1");
    expect(readCancelToken(cancelToken("msg_1"), "scd_")).toBeNull();
    expect(readCancelToken("msg_1", "msg_")).toBeNull();
    expect(readCancelToken(`msg_2.${cancelToken("msg_1").split(".")[1]}`, "msg_")).toBeNull();
    expect(readCancelToken(null, "msg_")).toBeNull();
  });
});

describe("/api/rest", () => {
  it("schedules a high-urgency delayed push to /api/push", async () => {
    qstash.publishJSON.mockResolvedValue({ messageId: "msg_1" });
    const res = await rest.POST(post("/api/rest", { subscription: sub, delaySeconds: 89.6, body: "Next: Bench" }));
    expect(await res.json()).toEqual({ id: cancelToken("msg_1") });
    expect(qstash.publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://app.test/api/push",
        delay: 90,
        body: {
          subscription: sub,
          urgency: "high",
          payload: expect.objectContaining({ title: "Rest's over", body: "Next: Bench" }),
        },
      }),
    );
  });

  it("rejects bad delays and subscriptions", async () => {
    for (const body of [
      { subscription: sub, delaySeconds: -1, body: "x" },
      { subscription: sub, delaySeconds: 60 * 60, body: "x" },
      { subscription: sub, delaySeconds: "90", body: "x" },
      { subscription: { ...sub, endpoint: "https://evil.example/x" }, delaySeconds: 90, body: "x" },
    ]) {
      expect((await rest.POST(post("/api/rest", body))).status).toBe(400);
    }
    expect(qstash.publishJSON).not.toHaveBeenCalled();
  });

  it("cancels with a valid token, even if the message is already gone", async () => {
    qstash.messages.delete.mockRejectedValue(new Error("not found"));
    const res = await rest.DELETE(del(`/api/rest?id=${cancelToken("msg_1")}`));
    expect(res.status).toBe(200);
    expect(qstash.messages.delete).toHaveBeenCalledWith("msg_1");
  });

  it("refuses to cancel without a genuine token", async () => {
    for (const q of ["", "?id=msg_1", `?id=${cancelToken("scd_1")}`]) {
      expect((await rest.DELETE(del(`/api/rest${q}`))).status).toBe(400);
    }
    expect(qstash.messages.delete).not.toHaveBeenCalled();
  });
});

describe("/api/reminder", () => {
  it("creates a daily schedule in the phone's time zone", async () => {
    qstash.schedules.create.mockResolvedValue({ scheduleId: "scd_1" });
    const res = await reminder.POST(
      post("/api/reminder", { subscription: sub, time: "07:05", timeZone: "America/Argentina/Buenos_Aires" }),
    );
    expect(await res.json()).toEqual({ id: cancelToken("scd_1") });
    expect(qstash.schedules.create).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "https://app.test/api/push",
        cron: "CRON_TZ=America/Argentina/Buenos_Aires 5 7 * * *",
      }),
    );
  });

  it("rejects bad times and time zones", async () => {
    for (const [time, timeZone] of [
      ["25:00", "Asia/Kuala_Lumpur"],
      ["7:05", "Asia/Kuala_Lumpur"],
      ["07:05", "Foo"],
      ["07:05", "Asia/Kuala_Lumpur * * * * curl"],
    ]) {
      expect((await reminder.POST(post("/api/reminder", { subscription: sub, time, timeZone }))).status).toBe(400);
    }
    expect(qstash.schedules.create).not.toHaveBeenCalled();
  });

  it("caps reminders per phone", async () => {
    const existing = { destination: "https://app.test/api/push", body: JSON.stringify({ subscription: sub }) };
    qstash.schedules.list.mockResolvedValue([existing, existing]);
    const res = await reminder.POST(post("/api/reminder", { subscription: sub, time: "07:05", timeZone: "UTC" }));
    expect(res.status).toBe(429);
    expect(qstash.schedules.create).not.toHaveBeenCalled();
  });

  it("deletes only with a genuine schedule token", async () => {
    expect((await reminder.DELETE(del(`/api/reminder?id=${cancelToken("scd_1")}`))).status).toBe(200);
    expect(qstash.schedules.delete).toHaveBeenCalledWith("scd_1");
    expect((await reminder.DELETE(del(`/api/reminder?id=scd_other_project`))).status).toBe(400);
    expect(qstash.schedules.delete).toHaveBeenCalledTimes(1);
  });

  it("reports a real failure so the app can retry", async () => {
    qstash.schedules.delete.mockRejectedValue(new Error("network down"));
    await expect(reminder.DELETE(del(`/api/reminder?id=${cancelToken("scd_1")}`))).rejects.toThrow("network down");
  });
});

describe("/api/push", () => {
  const payload = { title: "Rest's over", body: "Next: Bench" };
  const signed = (body: unknown, headers: Record<string, string> = {}) =>
    post("/api/push", body, { "Upstash-Signature": "good", ...headers });

  it("refuses requests not signed by QStash", async () => {
    expect((await push.POST(post("/api/push", { subscription: sub, payload }))).status).toBe(401);
    const forged = post("/api/push", { subscription: sub, payload }, { "Upstash-Signature": "forged" });
    expect((await push.POST(forged)).status).toBe(401);
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ url: "https://app.test/api/push" }));
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends the push with the requested urgency", async () => {
    sendNotification.mockResolvedValue({});
    const res = await push.POST(signed({ subscription: sub, payload, urgency: "high" }));
    expect(await res.json()).toEqual({ delivered: true });
    expect(sendNotification).toHaveBeenCalledWith(sub, JSON.stringify(payload), { TTL: 300, urgency: "high" });
  });

  it("returns 200 for a dead subscription and removes its daily schedule", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    qstash.schedules.delete.mockResolvedValue(undefined);
    const res = await push.POST(signed({ subscription: sub, payload }, { "Upstash-Schedule-Id": "scd_9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ delivered: false });
    expect(qstash.schedules.delete).toHaveBeenCalledWith("scd_9");
  });

  it("lets other push errors fail so QStash retries", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("server error"), { statusCode: 500 }));
    await expect(push.POST(signed({ subscription: sub, payload }))).rejects.toThrow("server error");
  });

  it("rejects a bad body", async () => {
    expect((await push.POST(signed({ subscription: sub }))).status).toBe(400);
  });
});
