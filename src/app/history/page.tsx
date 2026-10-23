"use client";

import { useAppState } from "@/lib/store";
import { isPlainRestDay } from "@/lib/hyrox";
import type { Session } from "@/lib/types";
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

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfWeek(d = new Date()): number {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}

export default function HistoryPage() {
  const app = useAppState();
  if (!app) return null;

  const sessions = [...app.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const weekStart = startOfWeek();
  const thisWeek = sessions.filter((s) => s.startedAt >= weekStart && !isPlainRestDay(s));
  const trained = new Set(thisWeek.map((s) => (new Date(s.startedAt).getDay() + 6) % 7));

  return (
    <>
      <h1 className="mt-2 text-3xl font-extrabold">History</h1>

      <div className="mt-4 rounded-2xl bg-card p-4">
        <p className="text-sm text-muted">
          This week · {thisWeek.length} workout{thisWeek.length === 1 ? "" : "s"}
        </p>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center">
              <div className={`h-7 rounded-lg ${trained.has(i) ? "bg-accent" : "bg-card2"}`} />
              <div className="mt-1 text-xs text-muted">{d}</div>
            </div>
          ))}
        </div>
      </div>

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
            <ul className="mt-2 text-sm text-[#c9c9d1]">
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
            {s.notes && <p className="mt-2 rounded-lg bg-card2 p-2 text-sm text-[#c9c9d1]">{s.notes}</p>}
          </div>
        );
      })}
    </>
  );
}
