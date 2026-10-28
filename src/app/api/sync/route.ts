import { auth } from "@/auth";
import { NoDatabaseError, sql } from "@/lib/db";
import { isSyncSession, MAX_SESSIONS, toRow, type SyncSession } from "@/lib/sync";
import type { Session } from "@/lib/types";

/** Most sessions one account may keep. Generous: a decade of daily training. */
const MAX_ROWS_PER_USER = 5000;

/** Turns a thrown error into a response, so a bad row can't leak a stack trace. */
function failed(err: unknown): Response {
  if (err instanceof NoDatabaseError) {
    return Response.json({ error: "Syncing isn't set up on this server." }, { status: 503 });
  }
  console.error("sync failed", err);
  return Response.json({ error: "Couldn't sync right now." }, { status: 500 });
}

/** Everything this user has on the server. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  try {
    const rows = await sql()`
      select data from workout_sessions where user_id = ${userId} order by started_at
    `;
    return Response.json({ sessions: rows.map((r) => r.data as Session) });
  } catch (err) {
    return failed(err);
  }
}

/** Push sessions up. Re-pushing the same session updates it rather than duplicating. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  const sessions = (body as { sessions?: unknown })?.sessions;
  if (!Array.isArray(sessions)) {
    return Response.json({ error: "Expected a sessions array." }, { status: 400 });
  }
  if (sessions.length > MAX_SESSIONS) {
    return Response.json({ error: `At most ${MAX_SESSIONS} sessions per request.` }, { status: 413 });
  }
  if (!sessions.every(isSyncSession)) {
    return Response.json({ error: "A session was malformed." }, { status: 400 });
  }

  try {
    const db = sql();
    // The profile has to exist before its sessions can reference it.
    await db`
      insert into profiles (id, email, name, image)
      values (${userId}, ${session.user?.email ?? ""}, ${session.user?.name ?? null}, ${session.user?.image ?? null})
      on conflict (id) do update
        set email = excluded.email, name = excluded.name, image = excluded.image, updated_at = now()
    `;

    const rows = (sessions as SyncSession[]).map((s) => toRow(userId, s));
    if (rows.length === 0) return Response.json({ saved: 0 });

    // Stops an account growing without bound. Updates to rows that already exist
    // are always allowed; only genuinely new ones can tip it over.
    const [{ n: existing }] = await db`
      select count(*)::int as n from workout_sessions where user_id = ${userId}
    `;
    if (existing + rows.length > MAX_ROWS_PER_USER) {
      const [{ n: known }] = await db`
        select count(*)::int as n from workout_sessions
        where user_id = ${userId} and id = any(${rows.map((r) => r.id)})
      `;
      if (existing + rows.length - known > MAX_ROWS_PER_USER) {
        return Response.json({ error: "That's more workouts than we can store." }, { status: 413 });
      }
    }

    await db.transaction(
      rows.map(
        (r) => db`
          insert into workout_sessions
            (id, user_id, started_at, started_on, started_offset_minutes, ended_at,
             routine_name, plain_rest_day, data)
          values
            (${r.id}, ${r.userId}, ${r.startedAt}, ${r.startedOn}, ${r.offsetMinutes}, ${r.endedAt},
             ${r.routineName}, ${r.plainRestDay}, ${r.data}::jsonb)
          on conflict (user_id, id) do update set
            started_at = excluded.started_at,
            started_on = excluded.started_on,
            started_offset_minutes = excluded.started_offset_minutes,
            ended_at = excluded.ended_at,
            routine_name = excluded.routine_name,
            plain_rest_day = excluded.plain_rest_day,
            data = excluded.data,
            updated_at = now()
        `,
      ),
    );

    return Response.json({ saved: rows.length });
  } catch (err) {
    return failed(err);
  }
}
