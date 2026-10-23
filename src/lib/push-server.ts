import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Client } from "@upstash/qstash";
import webpush from "web-push";

export type PushPayload = { title: string; body: string; tag?: string; url?: string };

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Real browser push services. Anything else is refused, so the server can't be
// used to send requests to arbitrary URLs.
const PUSH_HOSTS = [
  /^web\.push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

let client: Client | undefined;
/** Created on first use so builds without keys (CI, previews) don't fail. */
export function qstash(): Client {
  client ??= new Client({ token: process.env.QSTASH_TOKEN ?? "" });
  return client;
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    "mailto:108498426+bryanfrds@users.noreply.github.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? "",
  );
  vapidReady = true;
}

export function isSubscription(x: unknown): x is PushSubscriptionJSON {
  const s = x as PushSubscriptionJSON;
  if (typeof s?.endpoint !== "string" || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") {
    return false;
  }
  try {
    const url = new URL(s.endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

/** Sends now. Returns false if the subscription is gone (app removed / permission revoked). */
export async function sendPush(
  sub: PushSubscriptionJSON,
  payload: PushPayload,
  urgency: "normal" | "high" = "normal",
): Promise<boolean> {
  ensureVapid();
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 300, urgency });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    throw err;
  }
}

/** Where QStash should deliver scheduled pushes. */
export function pushUrl(req: Request): string {
  return new URL("/api/push", process.env.APP_URL ?? req.url).toString();
}

/** A real IANA time zone name, e.g. "Asia/Kuala_Lumpur" or "Etc/GMT+5". */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !/^[A-Za-z0-9_+/-]{1,64}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/*
 * Cancel tokens: scheduling returns "<id>.<signature>", and cancelling needs the
 * whole token, so callers can only cancel what this app scheduled for them.
 */
function sign(id: string): string {
  return createHmac("sha256", process.env.VAPID_PRIVATE_KEY ?? "")
    .update(`cancel:${id}`)
    .digest("base64url");
}

export function cancelToken(id: string): string {
  return `${id}.${sign(id)}`;
}

/** Returns the QStash id if the token is genuine and has the expected prefix. */
export function readCancelToken(token: string | null, prefix: "msg_" | "scd_"): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (dot < 0 || !id.startsWith(prefix) || given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? id : null;
}

/** How many daily reminders already point at this subscription. */
export async function countReminders(sub: PushSubscriptionJSON, destination: string): Promise<number> {
  const schedules = await qstash().schedules.list();
  return schedules.filter((s) => s.destination === destination && s.body?.includes(sub.endpoint)).length;
}
