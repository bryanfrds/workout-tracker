"use client";

import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onChange: (n: number) => void;
};

/**
 * Number box that only ever reports finite, non-negative numbers. While you
 * type, half-finished text (empty, "-", "2,") stays local; on blur it snaps
 * back to the last good value.
 */
export default function NumberInput({ value, onChange, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={draft ?? (Number.isFinite(value) ? String(value) : "")}
      onChange={(e) => {
        setDraft(e.target.value);
        // Some iPhone keyboards type "62,5" instead of "62.5".
        const text = e.target.value.trim().replace(",", ".");
        const n = Number(text);
        if (text !== "" && Number.isFinite(n) && n >= 0) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
