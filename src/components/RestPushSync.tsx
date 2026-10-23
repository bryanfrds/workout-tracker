"use client";

import { useEffect } from "react";
import { cancelRestPush, scheduleRestPush } from "@/lib/push-client";
import { getState, setState, useAppState } from "@/lib/store";
import type { Session } from "@/lib/types";
import { formatKg } from "@/lib/workout";

function nextSetText(s: Session): string {
  for (const ex of s.exercises) {
    const i = ex.sets.findIndex((x) => !x.done);
    if (i >= 0) {
      const set = ex.sets[i];
      return `Next: ${ex.name} · set ${i + 1} of ${ex.sets.length} · ${formatKg(set.kg)} × ${set.reps}`;
    }
  }
  return "Back to it";
}

/**
 * Keeps one server-scheduled "rest's over" push in step with the rest timer,
 * so it arrives even when the phone is locked. Mounted once in the layout.
 */
export default function RestPushSync() {
  const app = useAppState();
  const endsAt = app?.active?.restEndsAt;
  const subscription = app?.notifications?.subscription;

  useEffect(() => {
    const current = getState().restPush;
    if (endsAt && current?.endsAt === endsAt) return;

    if (current) {
      cancelRestPush(current.id);
      setState((s) => ({ ...s, restPush: undefined }));
    }

    const delaySeconds = endsAt ? (endsAt - Date.now()) / 1000 : 0;
    const active = getState().active;
    if (!endsAt || !subscription || !active || delaySeconds < 1) return;

    scheduleRestPush(subscription, delaySeconds, nextSetText(active))
      .then((id) => {
        // The rest may have been skipped or changed while this was in flight.
        if (getState().active?.restEndsAt === endsAt) setState((s) => ({ ...s, restPush: { endsAt, id } }));
        else cancelRestPush(id);
      })
      .catch(() => {
        // Offline or server down: the on-screen timer still works.
      });
  }, [endsAt, subscription]);

  return null;
}
