"use client";

import { useEffect, useState } from "react";
import { cancelRestPush, scheduleRestPush } from "@/lib/push-client";
import { createRestPushSync } from "@/lib/rest-push";
import { getState, setState, useAppState } from "@/lib/store";

/**
 * Keeps the server-scheduled "rest's over" push in step with the rest timer,
 * so it arrives even when the phone is locked. Mounted once in the layout.
 */
export default function RestPushSync() {
  const app = useAppState();
  const [sync] = useState(() =>
    createRestPushSync({ getState, setState, schedule: scheduleRestPush, cancel: cancelRestPush, now: Date.now }),
  );
  const loaded = app !== null;
  const endsAt = app?.active?.restEndsAt;
  const subscription = app?.notifications?.subscription;

  useEffect(() => {
    // The first render has no saved state yet; syncing then would cancel a real push.
    if (loaded) sync();
  }, [loaded, endsAt, subscription, sync]);

  return null;
}
