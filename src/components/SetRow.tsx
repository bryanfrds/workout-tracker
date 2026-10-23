"use client";

import NumberInput from "@/components/NumberInput";
import type { LoggedExercise, LoggedSet } from "@/lib/types";
import { DURATION_FIELDS, FIELD_LABELS, FIELDS, kindOf } from "@/lib/workout";

type Props = {
  ex: LoggedExercise;
  set: LoggedSet;
  /** Left column, e.g. the set number. */
  label: string;
  /** Used in accessible names, e.g. "Bench press set 2". */
  name: string;
  onEdit: (patch: Partial<LoggedSet>) => void;
  onToggle: () => void;
};

/** Column template: label, one column per field, tick box. */
export function setGrid(ex: LoggedExercise): React.CSSProperties {
  return { gridTemplateColumns: `26px repeat(${FIELDS[kindOf(ex)].length}, minmax(0, 1fr)) 44px` };
}

export function SetHeader({ ex, first = "Set" }: { ex: LoggedExercise; first?: string }) {
  return (
    <div className="grid gap-2 text-[11px] uppercase tracking-wide text-muted" style={setGrid(ex)}>
      <span>{first}</span>
      {FIELDS[kindOf(ex)].map((key) => (
        <span key={key} className="text-center">
          {FIELD_LABELS[key]}
        </span>
      ))}
      <span />
    </div>
  );
}

export default function SetRow({ ex, set, label, name, onEdit, onToggle }: Props) {
  return (
    <div className="grid items-center gap-2 py-1.5 text-sm" style={setGrid(ex)}>
      <span className="font-semibold text-muted">{label}</span>
      {FIELDS[kindOf(ex)].map((key) => (
        <NumberInput
          key={key}
          aria-label={`${name} ${FIELD_LABELS[key]}`}
          value={set[key]}
          duration={DURATION_FIELDS.includes(key)}
          onChange={(n) => onEdit({ [key]: n })}
          className={`w-full rounded-[10px] bg-card2 p-2 text-center outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-accent ${set.done ? "opacity-50" : ""}`}
        />
      ))}
      <button
        onClick={onToggle}
        aria-label={`${set.done ? "Untick" : "Tick"} ${name}`}
        aria-pressed={set.done}
        className={`h-10 w-10 rounded-xl border-2 text-xl font-extrabold transition ${
          set.done ? "border-accent bg-accent text-accent-ink" : "border-line text-transparent"
        }`}
      >
        ✓
      </button>
    </div>
  );
}
