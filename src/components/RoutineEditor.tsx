"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getState, setState, useAppState } from "@/lib/store";
import type { ExerciseKind, PlannedExercise } from "@/lib/types";
import NumberInput from "@/components/NumberInput";
import { withoutRoutine } from "@/lib/plans";
import { DURATION_FIELDS, FIELD_LABELS, FIELDS, KIND_LABELS, kindOf, newId, type MetricKey } from "@/lib/workout";

const BLANK: PlannedExercise = { name: "", sets: 3, kg: 20, reps: 10 };

export default function RoutineEditor() {
  const { id } = useParams<{ id: string }>();
  const app = useAppState();
  if (!app) return null;
  const existing = app.routines.find((r) => r.id === id);
  if (id !== "new" && !existing) return <p className="mt-8 text-muted">Routine not found.</p>;
  return <Editor key={id} id={id} />;
}

function NumberField({
  label,
  value,
  onChange,
  duration,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  duration?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted">
      {label}
      <NumberInput
        value={value}
        onChange={onChange}
        duration={duration}
        className="w-full rounded-lg bg-card2 p-2 text-center text-sm normal-case tracking-normal text-text outline-none focus:ring-2 focus:ring-accent"
      />
    </label>
  );
}

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const existing = getState().routines.find((r) => r.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [exercises, setExercises] = useState<PlannedExercise[]>(existing?.exercises ?? [{ ...BLANK }]);

  const update = (i: number, patch: Partial<PlannedExercise>) =>
    setExercises((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const clean = exercises
    .filter((e) => e.name.trim())
    .map((e) => {
      const kind = kindOf(e);
      const out: PlannedExercise = { name: e.name.trim(), sets: Math.max(1, Math.round(e.sets || 1)) };
      if (e.kind) out.kind = e.kind;
      if (e.optional) out.optional = e.optional;
      if (e.target) out.target = e.target;
      // Keep only the numbers this kind uses (switching a lift to a run drops kg/reps).
      for (const key of FIELDS[kind]) if (e[key] !== undefined) out[key] = e[key];
      if (kind === "strength") out.reps = Math.max(1, Math.round(out.reps || 1));
      return out;
    });
  const isPlan = Boolean(existing?.plan);
  const back = isPlan ? "/plan" : "/";
  const canSave = name.trim() !== "" && clean.length > 0;

  function save() {
    if (!canSave) return;
    setState((s) => {
      const routine = { ...existing, id: existing?.id ?? newId(), name: name.trim(), exercises: clean };
      const routines = existing
        ? s.routines.map((r) => (r.id === routine.id ? routine : r))
        : [...s.routines, routine];
      return { ...s, routines };
    });
    router.push(back);
  }

  function remove() {
    if (!existing) return;
    setState((s) => ({
      ...s,
      routines: s.routines.filter((r) => r.id !== existing.id),
      plans: withoutRoutine(s.plans, existing.id),
    }));
    router.push("/");
  }

  return (
    <>
      <button onClick={() => router.push(back)} className="mt-2 text-sm text-muted">
        ‹ {isPlan ? "Plan" : "Routines"}
      </button>
      <h1 className="mt-2 text-3xl font-extrabold">{existing ? "Edit routine" : "New routine"}</h1>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Routine name, e.g. Push day"
        className="mt-4 w-full rounded-2xl bg-card p-4 text-lg font-bold outline-none placeholder:font-normal placeholder:text-muted focus:ring-2 focus:ring-accent"
      />

      {exercises.map((ex, i) => (
        <div key={i} className="mt-3 rounded-2xl bg-card p-4">
          <div className="flex items-center gap-2">
            <input
              value={ex.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Exercise name"
              className="min-w-0 flex-1 rounded-lg bg-card2 p-2 font-semibold outline-none placeholder:font-normal placeholder:text-muted focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}
              aria-label={`Remove ${ex.name || "exercise"}`}
              className="h-9 w-9 rounded-lg text-muted hover:bg-card2"
            >
              ✕
            </button>
          </div>
          <select
            value={kindOf(ex)}
            onChange={(e) => update(i, { kind: e.target.value as ExerciseKind })}
            aria-label={`${ex.name || "Exercise"} type`}
            className="mt-2 w-full rounded-lg bg-card2 p-2 text-sm text-text outline-none focus:ring-2 focus:ring-accent"
          >
            {(Object.keys(KIND_LABELS) as ExerciseKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <NumberField label="Sets" value={ex.sets} onChange={(n) => update(i, { sets: n })} />
            {FIELDS[kindOf(ex)].map((key: MetricKey) => (
              <NumberField
                key={key}
                label={key === "kg" ? "kg (0 = body)" : FIELD_LABELS[key]}
                value={ex[key]}
                duration={DURATION_FIELDS.includes(key)}
                onChange={(n) => update(i, { [key]: n })}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={() => setExercises((xs) => [...xs, { ...BLANK }])}
        className="mt-3 w-full rounded-2xl border-[1.5px] border-dashed border-line p-4 text-muted"
      >
        + Add exercise
      </button>

      <button
        onClick={save}
        disabled={!canSave}
        className="mt-5 w-full rounded-xl bg-accent p-3.5 text-[15px] font-bold text-accent-ink disabled:opacity-40"
      >
        Save routine
      </button>
      {existing && !isPlan && (
        <button onClick={remove} className="mt-3 w-full p-3 text-sm text-red-400">
          Delete routine
        </button>
      )}
    </>
  );
}
