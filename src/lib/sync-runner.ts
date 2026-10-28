/**
 * Runs one sync at a time, and remembers if another was asked for while one was
 * in flight. Without that, a workout finished mid-sync is dropped: the running
 * sync already read the sessions, and nothing else wakes it up.
 *
 * Plain object rather than hooks so the ordering can actually be tested.
 */
export type SyncRunner = {
  /** Sync now, or once the current sync finishes. */
  request: () => void;
  /** Stop for good. Used when the component unmounts. */
  stop: () => void;
};

export function createSyncRunner(sync: () => Promise<unknown>): SyncRunner {
  let running = false;
  let again = false;
  let stopped = false;

  const run = () => {
    running = true;
    again = false;
    // Started off a resolved promise so that a synchronous throw lands in the
    // catch below rather than leaving `running` stuck true for good.
    Promise.resolve()
      .then(sync)
      // A failure (offline, server down) drops the pending re-run rather than
      // retrying straight away — the next finished workout asks again.
      .catch(() => {
        again = false;
      })
      .finally(() => {
        running = false;
        if (again && !stopped) run();
      });
  };

  return {
    request() {
      if (stopped) return;
      if (running) {
        again = true;
        return;
      }
      run();
    },
    stop() {
      stopped = true;
    },
  };
}
