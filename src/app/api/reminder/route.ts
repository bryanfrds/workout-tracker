import { isSubscription, pushUrl, qstash } from "@/lib/push-server";

/** Creates a daily "time to train" push. Body: { subscription, time: "18:30", timeZone } */
export async function POST(req: Request) {
  const { subscription, time, timeZone } = (await req.json()) as {
    subscription: unknown;
    time: unknown;
    timeZone: unknown;
  };
  const m = typeof time === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time) : null;
  if (!isSubscription(subscription) || !m || typeof timeZone !== "string" || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(timeZone)) {
    return Response.json({ error: "bad body" }, { status: 400 });
  }

  const { scheduleId } = await qstash.schedules.create({
    destination: pushUrl(req),
    cron: `CRON_TZ=${timeZone} ${Number(m[2])} ${Number(m[1])} * * *`,
    retries: 1,
    body: JSON.stringify({
      subscription,
      payload: { title: "Time to train", body: "Pick a routine and get going 💪", tag: "reminder", url: "/" },
    }),
    headers: { "Content-Type": "application/json" },
  });
  return Response.json({ id: scheduleId });
}

/** Removes the daily reminder: DELETE /api/reminder?id=... */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  try {
    await qstash.schedules.delete(id);
  } catch {
    // Already gone.
  }
  return Response.json({ ok: true });
}
