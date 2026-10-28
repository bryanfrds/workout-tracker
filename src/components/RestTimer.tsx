"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/workout";

type Props = {
  endsAt: number;
  onChange: (endsAt: number | undefined) => void;
};

export default function RestTimer({ endsAt, onChange }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const left = (endsAt - now) / 1000;

  useEffect(() => {
    if (left <= 0) {
      // Don't buzz when reopening the app long after the rest ended.
      if (left > -2) navigator.vibrate?.(300);
      onChange(undefined);
    }
  }, [left, onChange]);

  const btn = "rounded-lg bg-black/10 px-2.5 py-2 text-xs font-semibold";
  return (
    // Sits 11px clear of the tab bar, border included.
    <div className="fixed inset-x-0 bottom-[calc(var(--bar-h)+12px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md px-4">
      <div className="flex items-center justify-between rounded-2xl bg-accent px-4 py-3 text-accent-ink shadow-lg">
        <div>
          <div className="text-xs font-semibold">Rest</div>
          <div className="text-[26px] font-extrabold tabular-nums leading-tight">{formatClock(Math.ceil(left))}</div>
        </div>
        <div className="flex gap-1">
          <button className={btn} onClick={() => onChange(Math.max(now, endsAt - 15000))}>
            −15s
          </button>
          <button className={btn} onClick={() => onChange(endsAt + 15000)}>
            +15s
          </button>
          <button className={btn} onClick={() => onChange(undefined)}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
