"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DAY_NAMES } from "@/lib/hyrox";
import { liveDays, setPlanDay } from "@/lib/plans";
import { setState, useAppState } from "@/lib/store";
import type { Plan, Routine } from "@/lib/types";
import { newId } from "@/lib/workout";

const EMPTY_WEEK = (): string[][] => DAY_NAMES.map(() => []);

export default function PlanEditor() {
  const { id } = useParams<{ id: string }>();
  const app = useAppState();
  if (!app) return null;
  const existing = app.plans?.find((p) => p.id === id);
  if (id !== "new" && !existing) return <p className="mt-8 text-muted">Plan not found.</p>;
  return <Editor key={id} existing={existing} routines={app.routines} planCount={app.plans?.length ?? 0} />;
}

function RoutineSelect({
  value,
  routines,
  onChange,
  label,
  allowNone,
}: {
  value: string;
  routines: Routine[];
  onChange: (id: string) => void;
  label: string;
  allowNone: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full rounded-lg bg-card2 p-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent"
    >
      <option value="">{allowNone}</option>
      {routines.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
          {r.plan ? " (HYROX)" : ""}
        </option>
      ))}
    </select>
  );
}

function Editor({ existing, routines, planCount }: { existing?: Plan; routines: Routine[]; planCount: number }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  // Drop ids of routines deleted since the plan was saved.
  const [days, setDays] = useState<string[][]>(existing ? liveDays(existing, routines) : EMPTY_WEEK());

  const setDay = (i: number, slot: number, id: string) => setDays((ds) => setPlanDay(ds, i, slot, id));

  const canSave = name.trim() !== "" && days.some((d) => d.length > 0);

  function save() {
    if (!canSave) return;
    const plan: Plan = { id: existing?.id ?? newId(), name: name.trim(), days };
    setState((s) => {
      const plans = s.plans ?? [];
      return {
        ...s,
        plans: existing ? plans.map((p) => (p.id === plan.id ? plan : p)) : [...plans, plan],
        activePlanId: plan.id,
      };
    });
    router.push("/plan");
  }

  function remove() {
    if (!existing) return;
    router.push("/");
    setState((s) => {
      const plans = (s.plans ?? []).filter((p) => p.id !== existing.id);
      const activePlanId = s.activePlanId === existing.id ? plans[0]?.id : s.activePlanId;
      return { ...s, plans, activePlanId };
    });
  }

  return (
    <>
      <button onClick={() => router.back()} className="mt-2 text-sm text-muted">
        ‹ Back
      </button>
      <h1 className="mt-2 text-3xl font-extrabold">{existing ? "Edit plan" : "New plan"}</h1>
      <p className="mt-1 text-sm text-muted">Pick a workout for each day. Leave a day empty for rest.</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Plan name, e.g. PPL week"
        className="mt-4 w-full rounded-2xl bg-card p-4 text-lg font-bold outline-none placeholder:font-normal placeholder:text-muted focus:ring-2 focus:ring-accent"
      />

      <div className="mt-3 rounded-2xl bg-card p-4">
        {DAY_NAMES.map((dayName, i) => (
          <div key={dayName} className={`py-2.5 ${i > 0 ? "border-t border-line" : ""}`}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{dayName}</div>
            <RoutineSelect
              value={days[i][0] ?? ""}
              routines={routines}
              onChange={(id) => setDay(i, 0, id)}
              label={`${dayName} workout`}
              allowNone="Rest"
            />
            {days[i][0] && (
              <div className="mt-1.5">
                <RoutineSelect
                  value={days[i][1] ?? ""}
                  routines={routines.filter((r) => r.id !== days[i][0])}
                  onChange={(id) => setDay(i, 1, id)}
                  label={`${dayName} alternative`}
                  allowNone="No alternative"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={!canSave}
        className="mt-5 w-full rounded-xl bg-accent p-3.5 text-[15px] font-bold text-accent-ink disabled:opacity-40"
      >
        Save plan
      </button>
      {existing && planCount > 1 && (
        <button onClick={remove} className="mt-3 w-full p-3 text-sm text-red-400">
          Delete plan
        </button>
      )}
    </>
  );
}
