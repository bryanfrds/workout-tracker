import { cancelToken, isSubscription, pushUrl, qstash, readCancelToken } from "@/lib/push-server";

const MAX_DELAY_SECONDS = 15 * 60;

/** Schedules the "rest's over" push. Body: { subscription, delaySeconds, body } */
export async function POST(req: Request) {
  const { subscription, delaySeconds, body } = (await req.json()) as {
    subscription: unknown;
    delaySeconds: unknown;
    body: unknown;
  };
  if (
    !isSubscription(subscription) ||
    typeof delaySeconds !== "number" ||
    !(delaySeconds >= 0 && delaySeconds <= MAX_DELAY_SECONDS) ||
    typeof body !== "string"
  ) {
    return Response.json({ error: "bad body" }, { status: 400 });
  }

  const { messageId } = await qstash().publishJSON({
    url: pushUrl(req),
    delay: Math.round(delaySeconds),
    retries: 1,
    body: {
      subscription,
      urgency: "high",
      payload: { title: "Rest's over", body: body.slice(0, 200), tag: "rest", url: "/workout" },
    },
  });
  return Response.json({ id: cancelToken(messageId) });
}

/** Cancels a scheduled rest push: DELETE /api/rest?id=<token from POST> */
export async function DELETE(req: Request) {
  const id = readCancelToken(new URL(req.url).searchParams.get("id"), "msg_");
  if (!id) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    await qstash().messages.delete(id);
  } catch {
    // Already delivered or gone: nothing to cancel.
  }
  return Response.json({ ok: true });
}
