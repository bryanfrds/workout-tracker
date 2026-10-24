"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PlanDropdown from "@/components/PlanDropdown";
import { DayCard } from "@/components/TodayCard";
import { weekday } from "@/lib/hyrox";
import { startRoutine } from "@/lib/plan-actions";
import { activePlan, planWeek } from "@/lib/plans";
import { useAppState } from "@/lib/store";
import { useToday } from "@/lib/use-today";
import { countSets, lastSessionOf } from "@/lib/workout";

const DAY = 24 * 60 * 60 * 1000;

function lastDone(ts?: number): string {
  if (!ts) return "not done yet";
  const days = Math.floor((Date.now() - ts) / DAY);
  if (days === 0) return "last done today";
  if (days < 7) return `last ${new Date(ts).toLocaleDateString(undefined, { weekday: "short" })}`;
  return `last ${days} days ago`;
}

const eyebrow = "text-xs font-semibold uppercase tracking-[0.05em] text-muted";

export default function HomePage() {
  const app = useAppState();
  const today = useToday();
  const router = useRouter();
  if (!app || !today) return null;

  const active = app.active;
  const plan = activePlan(app);
  const week = plan && planWeek(app, plan, today);
  const todayNum = weekday(today);
  const upNext = week ? [1, 2, 3].map((k) => week.days[(todayNum - 1 + k) % 7]) : [];
  const others = app.routines.filter((r) => !r.plan);

  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <span className={eyebrow}>
          {today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
        </span>
        <Link href="/settings" aria-label="Settings" className="grid h-[38px] w-[38px] place-items-center rounded-full bg-card text-muted">
          ⚙
        </Link>
      </div>

      <PlanDropdown plans={app.plans ?? []} active={plan} />
      {week && (
        <p className="mt-0.5 text-[13px] text-muted">
          {week.doneCount} of {week.trainingDays} done this week
        </p>
      )}

      {active && (
        <Link href="/workout" className="mt-4 block rounded-2xl bg-accent p-4 text-accent-ink">
          <div className="text-xs font-semibold">In progress</div>
          <div className="text-lg font-bold">{active.routineName}</div>
          <div className="text-sm">
            {countSets(active).done} of {countSets(active).total} sets · tap to resume
          </div>
        </Link>
      )}

      {plan && week && (
        <div className="mt-4">
          <DayCard
            key={`${plan.id}-${todayNum}`}
            app={app}
            plan={plan}
            today={today}
            day={week.days[todayNum - 1]}
            eyebrow={<span className={`${eyebrow} !text-accent`}>Today</span>}
          />
        </div>
      )}

      {upNext.length > 0 && (
        <>
          <div className="mx-0.5 mb-2 mt-6 flex items-baseline justify-between">
            <span className={eyebrow}>Coming up</span>
            <Link href="/plan" className="text-[13px] text-muted">
              Full week ›
            </Link>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {upNext.map((d) => (
              <Link
                key={d.day}
                href={`/plan?day=${d.day}`}
                className="min-w-24 shrink-0 rounded-[14px] bg-card px-3 py-2.5"
              >
                <span className="block text-[11px] text-muted">{d.name.slice(0, 3)}</span>
                <span className="block text-[13px] font-bold">
                  {d.routines.length ? d.routines.map((r) => r.name).join(" or ") : "Rest"}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mx-0.5 mb-2 mt-6 flex items-baseline justify-between">
        <span className={eyebrow}>Other workouts</span>
        <Link href="/routine/new" className="text-[13px] text-muted">
          + New
        </Link>
      </div>
      <div className="overflow-hidden rounded-[18px] bg-card">
        {others.length === 0 && <p className="p-4 text-sm text-muted">No other workouts yet.</p>}
        {others.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-3.5 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <Link href={`/routine/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Edit ${r.name}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-card2 text-sm font-bold text-accent">
                {r.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold">{r.name}</span>
                <span className="block text-xs text-muted">
                  {r.exercises.length} exercises · {lastDone(lastSessionOf(app.sessions, r.id)?.startedAt)}
                </span>
              </span>
            </Link>
            {!active && (
              <button
                onClick={() => {
                  startRoutine(r);
                  router.push("/workout");
                }}
                aria-label={`Start ${r.name}`}
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-accent-ink"
              >
                ▶
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
