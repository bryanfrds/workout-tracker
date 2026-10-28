"use client";

import { useEffect, useRef } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { SignedOutError, syncNow } from "@/lib/sync-client";
import { createSyncRunner } from "@/lib/sync-runner";
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

  // One runner for the component's whole life. Stopping it belongs to unmount,
  // not to a change of account or session count — those are what ask it to run.
  const runner = useRef<ReturnType<typeof createSyncRunner>>(null);
  runner.current ??= createSyncRunner(() =>
    syncNow(getState().sessions).catch((err) => {
      // The cookie expired or they signed out elsewhere: stop trying until they
      // sign in again. Anything else (offline, server down) is left alone.
      if (err instanceof SignedOutError) setState((s) => ({ ...s, account: undefined }));
      throw err;
    }),
  );

  useEffect(() => () => runner.current?.stop(), []);

  useEffect(() => {
    if (!accountId || !online) return;
    runner.current?.request();
  }, [accountId, count, online]);

  return null;
}
