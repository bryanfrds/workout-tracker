import {
  cancelToken,
  countReminders,
  isSubscription,
  isTimeZone,
  pushUrl,
  qstash,
  readCancelToken,
} from "@/lib/push-server";

const MAX_REMINDERS_PER_PHONE = 2;

/** Creates a daily "time to train" push. Body: { subscription, time: "18:30", timeZone } */
export async function POST(req: Request) {
  const { subscription, time, timeZone } = (await req.json()) as {
    subscription: unknown;
    time: unknown;
    timeZone: unknown;
  };
  const m = typeof time === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time) : null;
  if (!isSubscription(subscription) || !m || !isTimeZone(timeZone)) {
    return Response.json({ error: "bad body" }, { status: 400 });
  }

  const destination = pushUrl(req);
  if ((await countReminders(subscription, destination)) >= MAX_REMINDERS_PER_PHONE) {
    return Response.json({ error: "too many reminders" }, { status: 429 });
  }

  const { scheduleId } = await qstash().schedules.create({
    destination,
    cron: `CRON_TZ=${timeZone} ${Number(m[2])} ${Number(m[1])} * * *`,
    retries: 1,
    body: JSON.stringify({
      subscription,
      payload: { title: "Time to train", body: "Pick a routine and get going 💪", tag: "reminder", url: "/" },
    }),
    headers: { "Content-Type": "application/json" },
  });
  return Response.json({ id: cancelToken(scheduleId) });
}

/** Removes the daily reminder: DELETE /api/reminder?id=<token from POST> */
export async function DELETE(req: Request) {
  const id = readCancelToken(new URL(req.url).searchParams.get("id"), "scd_");
  if (!id) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    await qstash().schedules.delete(id);
  } catch (err) {
    if (!/not found/i.test(String(err))) throw err;
  }
  return Response.json({ ok: true });
}
