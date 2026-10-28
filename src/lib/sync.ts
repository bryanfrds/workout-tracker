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

/** The largest value `new Date()` can hold; beyond it toISOString throws. */
const MAX_TIME = 8.64e15;

const MAX_NAME = 200;
const MAX_EXERCISES = 200;
/** A long session is a few KB; past this it isn't a workout any more. */
const MAX_BYTES = 64 * 1024;

function isTime(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= MAX_TIME;
}

/** A real calendar day, so "2026-99-99" can't reach a date column. */
function isDay(x: unknown): x is string {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

function isExercise(x: unknown): boolean {
  return !!x && typeof x === "object" && Array.isArray((x as { sets?: unknown }).sets);
}

export function toSync(session: Session): SyncSession {
  const started = new Date(session.startedAt);
  return {
    session,
    startedOn: dayKey(started),
    // Minutes east of UTC, so Malaysia is +480 rather than -480.
    offsetMinutes: -started.getTimezoneOffset(),
  };
}

/**
 * Checked deeply, not just shaped: everything here either reaches a typed column
 * or gets turned into a Date, and one bad session would otherwise fail the whole
 * batch it travelled in.
 */
export function isSyncSession(x: unknown): x is SyncSession {
  if (!x || typeof x !== "object") return false;
  const v = x as SyncSession;
  if (!isDay(v.startedOn)) return false;
  if (typeof v.offsetMinutes !== "number" || !Number.isFinite(v.offsetMinutes)) return false;
  if (Math.abs(v.offsetMinutes) > 16 * 60) return false;

  const s = v.session;
  if (!s || typeof s !== "object") return false;
  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 128) return false;
  if (typeof s.routineName !== "string" || s.routineName.length > MAX_NAME) return false;
  if (!isTime(s.startedAt)) return false;
  if (s.endedAt !== undefined && !isTime(s.endedAt)) return false;
  if (!Array.isArray(s.exercises) || s.exercises.length > MAX_EXERCISES) return false;
  if (!s.exercises.every(isExercise)) return false;

  // Whatever else the client puts on the session is stored as-is, so bound it.
  return JSON.stringify(s).length <= MAX_BYTES;
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

/**
 * How recent a session is: when it ended, or when it started if it never did.
 * Shared so the merge and the push filter can't drift apart.
 */
export const stamp = (s: Session) => s.endedAt ?? s.startedAt;

/** Newest wins when the same session exists on both sides. */
export function mergeSessions(mine: Session[], theirs: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const s of [...theirs, ...mine]) {
    const existing = byId.get(s.id);
    if (!existing || stamp(s) >= stamp(existing)) {
      byId.set(s.id, s);
    }
  }
  return [...byId.values()].sort((a, b) => a.startedAt - b.startedAt);
}
