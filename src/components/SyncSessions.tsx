"use client";

import { useEffect, useRef } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { SignedOutError, syncNow } from "@/lib/sync-client";

/**
 * Keeps the phone and the server in step. It runs only once the user has signed
 * in at least once, so a signed-out phone never touches the network — the app
 * works exactly as it did before, on localStorage alone.
 */
export default function SyncSessions() {
  const app = useAppState();
  const accountId = app?.account?.id;
  const count = app?.sessions.length ?? 0;
  const running = useRef(false);

  useEffect(() => {
    if (!accountId || running.current) return;
    running.current = true;
    syncNow(getState().sessions)
      .catch((err) => {
        // The session cookie expired or they signed out elsewhere: stop trying
        // until they sign in again. Anything else (offline, server down) is
        // left alone, since the next finished workout will retry.
        if (err instanceof SignedOutError) setState((s) => ({ ...s, account: undefined }));
      })
      .finally(() => {
        running.current = false;
      });
    // `count` is a dependency so finishing a workout pushes it straight up.
  }, [accountId, count]);

  return null;
}
