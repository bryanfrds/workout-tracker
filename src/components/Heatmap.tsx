"use client";

import { useCallback, useMemo } from "react";
import { currentStreak, heatmapColumns, heatmapTotal, monthLabels, type Cell } from "@/lib/heatmap";
import type { Session } from "@/lib/types";

/** Five shades, lightest for one workout. Level 0 is an empty day. */
const SHADE: Record<Cell["level"], string> = {
  0: "bg-card2",
  1: "bg-accent/35",
  2: "bg-accent/55",
  3: "bg-accent/75",
  4: "bg-accent",
};

export default function Heatmap({ sessions, today }: { sessions: Session[]; today: Date }) {
  const { columns, total, months, streak } = useMemo(() => {
    const columns = heatmapColumns(sessions, today);
    return {
      columns,
      total: heatmapTotal(columns, today),
      months: monthLabels(columns),
      streak: currentStreak(sessions, today),
    };
  }, [sessions, today]);

  // The newest weeks are on the right, so start scrolled to the end.
  const toEnd = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <section className="mt-4 rounded-2xl bg-card p-4">
      <p className="text-sm text-muted">
        {total} workout{total === 1 ? "" : "s"} in the last year
        {/* One day isn't a streak worth naming. */}
        {streak > 1 && ` · ${streak} day streak`}
      </p>

      {/* Scrollable and focusable, so a keyboard can reach the older weeks. */}
      <div
        ref={toEnd}
        tabIndex={0}
        role="group"
        aria-label="Workouts per day over the last year"
        className="-mx-1 mt-3 overflow-x-auto px-1 [scrollbar-width:none]"
      >
        <div className="w-max">
          <div className="flex gap-[3px]">
            {months.map((m, i) => (
              <span key={m ?? `blank-${i}`} aria-hidden className="w-[11px] text-[9px] text-muted">
                {m}
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-[3px]">
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.cells.map((cell, d) => {
                  if (!cell) return <span key={`${i}-${d}`} aria-hidden className="h-[11px] w-[11px]" />;
                  // title is desktop-only, so the same text goes in aria-label for phones and screen readers.
                  const text = `${cell.count} workout${cell.count === 1 ? "" : "s"} · ${cell.label}`;
                  return (
                    <span
                      key={`${i}-${d}`}
                      role="img"
                      aria-label={text}
                      title={text}
                      className={`h-[11px] w-[11px] rounded-[2px] ${SHADE[cell.level]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        Less
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} aria-hidden className={`h-[9px] w-[9px] rounded-[2px] ${SHADE[l]}`} />
        ))}
        More
      </div>
    </section>
  );
}
