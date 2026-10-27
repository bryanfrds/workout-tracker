"use client";

import Heatmap from "@/components/Heatmap";
import { useAppState } from "@/lib/store";
import { isPlainRestDay } from "@/lib/plans";
import type { Session } from "@/lib/types";
import { useToday } from "@/lib/use-today";
import { averageRest, bestSet, describeSet, formatClock, kindOf } from "@/lib/workout";

/** Kilometres covered by runs, rows and intervals that were ticked. */
function totalKm(s: Session): number {
  let km = 0;
  for (const ex of s.exercises) {
    if (ex.skipped) continue;
    for (const set of ex.sets) {
      if (!set.done) continue;
      if (kindOf(ex) === "distance") km += set.km ?? 0;
      if (kindOf(ex) === "interval") km += (set.m ?? 0) / 1000;
    }
  }
  return Math.round(km * 100) / 100;
}

export default function HistoryPage() {
  const app = useAppState();
  const today = useToday();
  if (!app || !today) return null;

  const sessions = [...app.sessions].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <>
      <h1 className="mt-2 text-3xl font-extrabold">History</h1>

      <Heatmap sessions={app.sessions} today={today} />

      {sessions.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">Finished workouts show up here.</p>
      )}

      {sessions.map((s) => {
        const minutes = Math.max(1, Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 60000));
        return (
          <div key={s.id} className="mt-3 rounded-2xl bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">{s.routineName}</h2>
              <span className="text-sm text-muted">
                {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}{" "}
                {!isPlainRestDay(s) && ` · ${minutes} min`}
              </span>
            </div>
            <ul className="mt-2 text-sm text-text2">
              {s.restDay && s.exercises.every((e) => !e.sets.some((x) => x.done)) && (
                <li className="border-t border-line py-1.5 text-muted">Rest day</li>
              )}
              {s.exercises.map((ex) => {
                if (ex.skipped) {
                  return (
                    <li key={ex.name} className="flex justify-between gap-3 border-t border-line py-1.5 text-muted">
                      <span>{ex.name}</span>
                      <span>not available</span>
                    </li>
                  );
                }
                const best = bestSet(ex);
                if (!best) return null;
                const doneSets = ex.sets.filter((x) => x.done).length;
                return (
                  <li key={ex.name} className="flex justify-between gap-3 border-t border-line py-1.5">
                    <span>
                      {ex.name}
                      {doneSets > 1 && <span className="text-muted"> · {doneSets}×</span>}
                    </span>
                    <span className="text-right">
                      {doneSets > 1 && kindOf(ex) !== "strength" && kindOf(ex) !== "carry" ? "best " : ""}
                      {describeSet(kindOf(ex), best)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {(() => {
              const km = totalKm(s);
              const rest = averageRest(s);
              const bits = [
                km > 0 && `${km} km total`,
                rest !== undefined && `avg ${formatClock(rest)} between sets`,
                s.rpe && `effort ${s.rpe}/10`,
              ].filter(Boolean);
              return bits.length > 0 ? <p className="mt-2 text-xs text-muted">{bits.join(" · ")}</p> : null;
            })()}
            {s.notes && <p className="mt-2 rounded-lg bg-card2 p-2 text-sm text-text2">{s.notes}</p>}
          </div>
        );
      })}
    </>
  );
}
