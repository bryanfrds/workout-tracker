"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Today's date, read on the client only so server and client render the same. */
export function useToday(): Date | null {
  const day = useSyncExternalStore(noop, () => new Date().toDateString(), () => null);
  return day ? new Date(day) : null;
}
