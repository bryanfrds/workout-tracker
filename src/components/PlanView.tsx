"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PlanDropdown from "@/components/PlanDropdown";
import { DayCard } from "@/components/TodayCard";
import { weekStart, weekday } from "@/lib/hyrox";
import { activePlan, dayFromParam, planWeek, type DayStatus } from "@/lib/plans";
import { setState, useAppState } from "@/lib/store";
import type { Routine } from "@/lib/types";
import { useToday } from "@/lib/use-today";
import { describeSet, kindOf } from "@/lib/workout";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.05em] text-muted";

const PILL: Record<DayStatus, [string, string]> = {
  done: ["Done", "bg-accent text-accent-ink"],
  today: ["Today", "bg-accent text-accent-ink"],
  upcoming: ["To do", "bg-card2 text-muted"],
  missed: ["Missed", "bg-card2 text-muted"],
  skipped: ["Skipped", "bg-card2 text-muted"],
  rest: ["Rest", "bg-card2 text-muted"],
};

function Dot({ status }: { status: DayStatus }) {
  const base = "mx-auto mt-1.5 grid h-[22px] w-[22px] place-items-center rounded-full text-xs font-extrabold";
  if (status === "done") return <span className={`${base} bg-accent text-accent-ink`}>✓</span>;
  if (status === "today") return <span className={`${base} border-2 border-accent`} />;
  if (status === "rest") return <span className={`${base} text-muted`}>–</span>;
  if (status === "skipped") return <span className={`${base} bg-card2 text-muted`}>×</span>;
  return <span className={`${base} bg-card2`} />;
}

function Ring({ value }: { value: number }) {
  const c = 2 * Math.PI * 15.5;
  return (
    <svg viewBox="0 0 36 36" className="h-16 w-16 shrink-0" aria-hidden>
      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--card2)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${Math.min(1, value) * c} ${c}`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

function setRounds(routine: Routine, rounds: number) {
  setState((s) => ({
    ...s,
    routines: s.routines.map((r) =>
      r.id === routine.id ? { ...r, exercises: r.exercises.map((e) => ({ ...e, sets: rounds })) } : r,
    ),
  }));
}

export default function PlanView() {
  const app = useAppState();
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  if (!app || !today) return null;

  const plan = activePlan(app);
  if (!plan) {
    return (
      <>
        <h1 className="mt-2 text-3xl font-extrabold">Plan</h1>
        <Link href="/plans/new" className="mt-4 block rounded-xl bg-accent p-3.5 text-center font-bold text-accent-ink">
          Make a weekly plan
        </Link>
      </>
    );
  }

  const { days, doneCount, trainingDays, recent } = planWeek(app, plan, today);
  // The URL holds the selected day, so "Coming up" links and the strip can't disagree.
  const sel = dayFromParam(params.get("day"), weekday(today));
  const day = days[sel - 1];
  const [label, pillClass] = PILL[day.status];

  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <span className={eyebrow}>
          Week of {weekStart(today).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </span>
        <Link
          href={`/plans/${plan.id}`}
          aria-label="Edit plan"
          className="grid h-[38px] w-[38px] place-items-center rounded-full bg-card text-muted"
        >
          ✎
        </Link>
      </div>
      <PlanDropdown plans={app.plans ?? []} active={plan} />

      <section className="mt-3.5 flex items-center gap-4 rounded-[20px] bg-card p-4">
        <Ring value={trainingDays ? doneCount / trainingDays : 0} />
        <div>
          <div className="text-xl font-bold">
            {doneCount} of {trainingDays}
          </div>
          <div className="text-[13px] text-muted">workouts done this week</div>
          <div className="mt-1 text-xs text-muted">
            Last 4 weeks:{" "}
            {recent.map((w, i) => (
              <span key={w.weeksAgo} className={w.weeksAgo === 0 ? "font-bold text-text" : ""}>
                {i > 0 && " · "}
                {w.done}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-3.5 grid grid-cols-7 gap-1.5" role="group" aria-label="Days">
        {days.map((d) => (
          <button
            key={d.day}
            aria-pressed={d.day === sel}
            aria-label={`${d.name}: ${PILL[d.status][0]}`}
            onClick={() => router.replace(`/plan?day=${d.day}`, { scroll: false })}
            className={`rounded-[14px] border-2 bg-card pb-2.5 pt-2 text-center ${d.day === sel ? "border-accent" : "border-transparent"}`}
          >
            <span className="block text-[11px] font-semibold text-muted">{d.name[0]}</span>
            <Dot status={d.status} />
          </button>
        ))}
      </div>

      <div className="mt-3">
        <DayCard
          key={`${plan.id}-${sel}`}
          app={app}
          plan={plan}
          today={today}
          day={day}
          eyebrow={
            <div className="flex items-baseline justify-between">
              <span className={eyebrow}>{day.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pillClass}`}>{label}</span>
            </div>
          }
          details={(r) => (
            <>
              <ul className="mt-3 text-sm">
                {r.exercises.map((e) => (
                  <li key={e.name} className="flex justify-between gap-3 border-t border-line py-2.5">
                    <span>
                      {e.name}
                      {e.optional && <span className="text-muted"> (optional)</span>}
                    </span>
                    <span className="text-right text-muted">
                      {r.circuit ? "" : `${e.sets} × `}
                      {e.target ?? describeSet(kindOf(e), e)}
                    </span>
                  </li>
                ))}
              </ul>
              {r.circuit && (
                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
                  Rounds
                  {[3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRounds(r, n)}
                      aria-pressed={r.exercises[0]?.sets === n}
                      className={`rounded-lg px-3 py-1.5 font-bold ${r.exercises[0]?.sets === n ? "bg-accent text-accent-ink" : "bg-card2 text-text"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <Link href={`/routine/${r.id}`} className="mt-2 inline-block text-[13px] text-muted underline-offset-2 hover:underline">
                Edit this workout
              </Link>
            </>
          )}
        />
      </div>
    </>
  );
}
