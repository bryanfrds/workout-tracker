import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { isSyncSession, MAX_SESSIONS, toRow, type SyncSession } from "@/lib/sync";
import type { Session } from "@/lib/types";

/** Everything this user has on the server. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  const rows = await sql()`
    select data from workout_sessions where user_id = ${userId} order by started_at
  `;
  return Response.json({ sessions: rows.map((r) => r.data as Session) });
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

  const db = sql();
  // The profile has to exist before its sessions can reference it.
  await db`
    insert into profiles (id, email, name, image)
    values (${userId}, ${session.user?.email ?? ""}, ${session.user?.name ?? null}, ${session.user?.image ?? null})
    on conflict (id) do update
      set email = excluded.email, name = excluded.name, image = excluded.image, updated_at = now()
  `;

  const rows = (sessions as SyncSession[]).map((s) => toRow(userId, s));
  if (rows.length > 0) {
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
  }

  return Response.json({ saved: rows.length });
}
