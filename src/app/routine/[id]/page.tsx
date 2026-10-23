"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { getState, setState, useAppState } from "@/lib/store";
import type { PlannedExercise } from "@/lib/types";
import { newId } from "@/lib/workout";

const BLANK: PlannedExercise = { name: "", sets: 3, kg: 20, reps: 10 };

export default function EditRoutinePage({ params }: PageProps<"/routine/[id]">) {
  const { id } = use(params);
  const app = useAppState();
  if (!app) return null;
  const existing = app.routines.find((r) => r.id === id);
  if (id !== "new" && !existing) return <p className="mt-8 text-muted">Routine not found.</p>;
  return <Editor key={id} id={id} />;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.valueAsNumber)}
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
    .map((e) => ({
      name: e.name.trim(),
      sets: Math.max(1, Math.round(e.sets || 1)),
      kg: Math.max(0, e.kg || 0),
      reps: Math.max(1, Math.round(e.reps || 1)),
    }));
  const canSave = name.trim() !== "" && clean.length > 0;

  function save() {
    if (!canSave) return;
    setState((s) => {
      const routine = { id: existing?.id ?? newId(), name: name.trim(), exercises: clean };
      const routines = existing
        ? s.routines.map((r) => (r.id === routine.id ? routine : r))
        : [...s.routines, routine];
      return { ...s, routines };
    });
    router.push("/");
  }

  function remove() {
    if (!existing) return;
    setState((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== existing.id) }));
    router.push("/");
  }

  return (
    <>
      <button onClick={() => router.push("/")} className="mt-2 text-sm text-muted">
        ‹ Routines
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
          <div className="mt-3 grid grid-cols-3 gap-2">
            <NumberField label="Sets" value={ex.sets} onChange={(n) => update(i, { sets: n })} />
            <NumberField label="kg (0 = body)" value={ex.kg} onChange={(n) => update(i, { kg: n })} />
            <NumberField label="Reps" value={ex.reps} onChange={(n) => update(i, { reps: n })} />
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
      {existing && (
        <button onClick={remove} className="mt-3 w-full p-3 text-sm text-red-400">
          Delete routine
        </button>
      )}
    </>
  );
}
