import { dayKey } from "@/lib/heatmap";
import { isPlainRestDay } from "@/lib/plans";
import type { Session } from "@/lib/types";

/**
 * One session on its way to the server. `startedOn` and `offsetMinutes` are
 * computed on the phone: only it knows which calendar day the user actually saw,
 * and that's what the heatmap counts by.
 */
export type SyncSession = {
  session: Session;
  startedOn: string;
  offsetMinutes: number;
};

/** Most sessions one request may carry. A year of hard training is ~400. */
export const MAX_SESSIONS = 1000;

export function toSync(session: Session): SyncSession {
  const started = new Date(session.startedAt);
  return {
    session,
    startedOn: dayKey(started),
    // Minutes east of UTC, so Malaysia is +480 rather than -480.
    offsetMinutes: -started.getTimezoneOffset(),
  };
}

export function isSyncSession(x: unknown): x is SyncSession {
  if (!x || typeof x !== "object") return false;
  const v = x as SyncSession;
  return (
    typeof v.startedOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.startedOn) &&
    typeof v.offsetMinutes === "number" &&
    Number.isFinite(v.offsetMinutes) &&
    Math.abs(v.offsetMinutes) <= 16 * 60 &&
    !!v.session &&
    typeof v.session === "object" &&
    typeof v.session.id === "string" &&
    v.session.id.length > 0 &&
    v.session.id.length <= 128 &&
    typeof v.session.routineName === "string" &&
    typeof v.session.startedAt === "number" &&
    Number.isFinite(v.session.startedAt) &&
    Array.isArray(v.session.exercises)
  );
}

/** The row the server writes. Rest days are recomputed here, never trusted. */
export function toRow(userId: string, s: SyncSession) {
  return {
    id: s.session.id,
    userId,
    startedAt: new Date(s.session.startedAt).toISOString(),
    startedOn: s.startedOn,
    offsetMinutes: Math.round(s.offsetMinutes),
    endedAt: s.session.endedAt ? new Date(s.session.endedAt).toISOString() : null,
    routineName: s.session.routineName,
    plainRestDay: isPlainRestDay(s.session),
    data: JSON.stringify(s.session),
  };
}

/** Newest wins when the same session exists on both sides. */
export function mergeSessions(mine: Session[], theirs: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const s of [...theirs, ...mine]) {
    const existing = byId.get(s.id);
    if (!existing || (s.endedAt ?? s.startedAt) >= (existing.endedAt ?? existing.startedAt)) {
      byId.set(s.id, s);
    }
  }
  return [...byId.values()].sort((a, b) => a.startedAt - b.startedAt);
}
