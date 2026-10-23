import type { AppState } from "./types";
import { nextSetText } from "./workout";

export type RestPushDeps = {
  getState: () => AppState;
  setState: (update: (s: AppState) => AppState) => void;
  schedule: (subscription: PushSubscriptionJSON, delaySeconds: number, body: string) => Promise<string>;
  cancel: (id: string) => void;
  now: () => number;
};

/**
 * Keeps exactly one server-scheduled "rest's over" push in step with the rest
 * timer. Call `sync()` whenever the rest end time or subscription may have
 * changed. Each call supersedes any still in flight, so a late reply from an
 * older call is cancelled instead of stored.
 */
export function createRestPushSync(deps: RestPushDeps) {
  let latest = 0;

  return function sync(): void {
    const run = ++latest;
    const state = deps.getState();
    const endsAt = state.active?.restEndsAt;
    const subscription = state.notifications?.subscription;
    const current = state.restPush;

    const wanted = endsAt && subscription && state.active && (endsAt - deps.now()) / 1000 >= 1;
    if (wanted && current?.endsAt === endsAt) return;

    if (current) {
      deps.cancel(current.id);
      deps.setState((s) => ({ ...s, restPush: undefined }));
    }
    if (!wanted) return;

    deps
      .schedule(subscription, (endsAt - deps.now()) / 1000, nextSetText(state.active!))
      .then((id) => {
        const stillWanted = run === latest && deps.getState().active?.restEndsAt === endsAt;
        if (stillWanted) deps.setState((s) => ({ ...s, restPush: { endsAt, id } }));
        else deps.cancel(id);
      })
      .catch(() => {
        // Offline or server down: the on-screen timer still works.
      });
  };
}
