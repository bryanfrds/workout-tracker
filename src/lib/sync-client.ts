import { setState } from "@/lib/store";
import { MAX_SESSIONS, mergeSessions, toSync } from "@/lib/sync";
import type { Session } from "@/lib/types";

/** Thrown for a 401, so callers can tell "signed out" from "something broke". */
export class SignedOutError extends Error {}

async function pull(): Promise<Session[]> {
  const res = await fetch("/api/sync");
  if (res.status === 401) throw new SignedOutError("Not signed in.");
  if (!res.ok) throw new Error("Couldn't read your workouts from the server.");
  const body = (await res.json()) as { sessions: Session[] };
  return body.sessions ?? [];
}

async function push(sessions: Session[]): Promise<void> {
  // Oldest first, so an interrupted first sync still leaves a sensible history.
  for (let i = 0; i < sessions.length; i += MAX_SESSIONS) {
    const batch = sessions.slice(i, i + MAX_SESSIONS);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessions: batch.map(toSync) }),
    });
    if (res.status === 401) throw new SignedOutError("Not signed in.");
    if (!res.ok) throw new Error("Couldn't save your workouts to the server.");
  }
}

/** How recent a session is: when it ended, or when it started if it's unfinished. */
const stamp = (s: Session) => s.endedAt ?? s.startedAt;

/**
 * Pulls what the server has, merges it with the phone's own, then pushes the
 * result back. Safe to run repeatedly: sessions upsert by id.
 */
export async function syncNow(mine: Session[]): Promise<number> {
  const theirs = await pull();
  const merged = mergeSessions(mine, theirs);
  // Push what the server is missing, and anything it holds an older copy of.
  // Checking the id alone isn't enough: a session the server already has, where
  // the phone's copy is the newer one, would never be sent.
  const theirsById = new Map(theirs.map((s) => [s.id, s]));
  const unsent = merged.filter((s) => {
    const theirCopy = theirsById.get(s.id);
    return !theirCopy || stamp(s) > stamp(theirCopy);
  });
  if (unsent.length > 0) await push(unsent);
  setState((s) => ({ ...s, sessions: mergeSessions(s.sessions, merged) }));
  return merged.length;
}
