import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { isSubscription, sendPush, type PushPayload } from "@/lib/push-server";

// Called by QStash when a scheduled push is due. The signature check means
// only QStash can trigger it.
export const POST = verifySignatureAppRouter(async (req: Request) => {
  const { subscription, payload } = (await req.json()) as { subscription: unknown; payload: PushPayload };
  if (!isSubscription(subscription) || typeof payload?.title !== "string") {
    return Response.json({ error: "bad body" }, { status: 400 });
  }
  const delivered = await sendPush(subscription, payload);
  // 200 either way: a dead subscription shouldn't make QStash retry.
  return Response.json({ delivered });
});
