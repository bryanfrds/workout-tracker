import { Receiver } from "@upstash/qstash";
import { isSubscription, pushUrl, qstash, sendPush, type PushPayload } from "@/lib/push-server";

let receiver: Receiver | undefined;
/** Created on first request so builds without keys (CI, previews) don't fail. */
function getReceiver(): Receiver {
  receiver ??= new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? "",
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
  });
  return receiver;
}

// Called by QStash when a scheduled push is due. The signature check means
// only QStash can trigger it.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("Upstash-Signature");
  const valid =
    signature !== null &&
    (await getReceiver()
      .verify({ signature, body: raw, url: pushUrl(req) })
      .catch(() => false));
  if (!valid) return Response.json({ error: "bad signature" }, { status: 401 });

  const { subscription, payload, urgency } = JSON.parse(raw) as {
    subscription: unknown;
    payload: PushPayload;
    urgency?: unknown;
  };
  if (!isSubscription(subscription) || typeof payload?.title !== "string") {
    return Response.json({ error: "bad body" }, { status: 400 });
  }
  const delivered = await sendPush(subscription, payload, urgency === "high" ? "high" : "normal");

  // The phone is gone: stop a daily reminder from firing at it forever.
  const scheduleId = req.headers.get("Upstash-Schedule-Id");
  if (!delivered && scheduleId) {
    await qstash().schedules.delete(scheduleId).catch(() => {});
  }
  // 200 either way: a dead subscription shouldn't make QStash retry.
  return Response.json({ delivered });
}
