"use client";

import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onChange: (n: number) => void;
};

/**
 * Number box that only ever reports finite, non-negative numbers. While you
 * type, half-finished text (empty, "-", "2.") stays local; on blur it snaps
 * back to the last good value.
 */
export default function NumberInput({ value, onChange, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      min={0}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
