"use client";

import { useAppState } from "@/lib/store";
import { bestSet, formatKg } from "@/lib/workout";

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
  const thisWeek = sessions.filter((s) => s.startedAt >= weekStart);
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
                · {minutes} min
              </span>
            </div>
            <ul className="mt-2 text-sm text-[#c9c9d1]">
              {s.exercises.map((ex) => {
                const best = bestSet(ex);
                if (!best) return null;
                return (
                  <li key={ex.name} className="flex justify-between border-t border-line py-1.5">
                    <span>{ex.name}</span>
                    <span>
                      {formatKg(best.kg)} × {best.reps}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}
