"use client";

import { useEffect, useRef } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { SignedOutError, syncNow } from "@/lib/sync-client";
import { useOnline } from "@/lib/use-online";

/**
 * Keeps the phone and the server in step. It runs only once the user has signed
 * in at least once, so a signed-out phone never touches the network — the app
 * works exactly as it did before, on localStorage alone.
 */
export default function SyncSessions() {
  const app = useAppState();
  const online = useOnline();
  const accountId = app?.account?.id;
  const count = app?.sessions.length ?? 0;
  const running = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    if (!accountId || !online) return;
    // A workout finished while a sync was in flight would otherwise be dropped:
    // this run's merge already happened, and nothing else would wake it up.
    if (running.current) {
      again.current = true;
      return;
    }

    let cancelled = false;
    const run = () => {
      running.current = true;
      again.current = false;
      syncNow(getState().sessions)
        .catch((err) => {
          // The cookie expired or they signed out elsewhere: stop trying until
          // they sign in again. Anything else (offline, server down) is left
          // alone, since the next finished workout retries.
          if (err instanceof SignedOutError) setState((s) => ({ ...s, account: undefined }));
          again.current = false;
        })
        .finally(() => {
          running.current = false;
          if (again.current && !cancelled) run();
        });
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [accountId, count, online]);

  return null;
}
