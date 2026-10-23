import "server-only";
import { Client } from "@upstash/qstash";
import webpush from "web-push";

export type PushPayload = { title: string; body: string; tag?: string; url?: string };

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export const qstash = new Client({ token: process.env.QSTASH_TOKEN ?? "" });

webpush.setVapidDetails(
  "mailto:108498426+bryanfrds@users.noreply.github.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? "",
);

export function isSubscription(x: unknown): x is PushSubscriptionJSON {
  const s = x as PushSubscriptionJSON;
  return (
    typeof s?.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    typeof s.keys?.p256dh === "string" &&
    typeof s.keys?.auth === "string"
  );
}

/** Sends now. Returns false if the subscription is gone (app removed / permission revoked). */
export async function sendPush(sub: PushSubscriptionJSON, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 300 });
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
