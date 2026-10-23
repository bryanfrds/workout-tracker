"use client";

import { useState } from "react";
import { formatClock, parseClock } from "@/lib/workout";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | undefined;
  onChange: (n: number) => void;
  /** Enter and show the value as a time ("1:45") instead of a plain number. */
  duration?: boolean;
};

function parseNumber(text: string): number | undefined {
  // Some iPhone keyboards type "62,5" instead of "62.5".
  const t = text.trim().replace(",", ".");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Number box that only ever reports finite, non-negative numbers. While you
 * type, half-finished text (empty, "-", "2,", "1:") stays local; on blur it
 * snaps back to the last good value.
 */
export default function NumberInput({ value, onChange, duration, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value !== undefined && Number.isFinite(value) ? (duration ? formatClock(value) : String(value)) : "";

  return (
    <input
      {...rest}
      type="text"
      inputMode={duration ? "numeric" : "decimal"}
      placeholder={rest.placeholder ?? (duration ? "m:ss" : undefined)}
      value={draft ?? shown}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = duration ? parseClock(e.target.value) : parseNumber(e.target.value);
        if (n !== undefined) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
