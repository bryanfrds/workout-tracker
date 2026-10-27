"use client";

import { useCallback } from "react";
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
  const columns = heatmapColumns(sessions, today);
  const total = heatmapTotal(columns);
  const months = monthLabels(columns);
  const streak = currentStreak(sessions, today);

  // The newest weeks are on the right, so start scrolled to the end.
  const toEnd = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <section className="mt-4 rounded-2xl bg-card p-4">
      <p className="text-sm text-muted">
        {total} workout{total === 1 ? "" : "s"} in the last year
        {streak > 1 && ` · ${streak} day streak`}
      </p>

      <div ref={toEnd} className="-mx-1 mt-3 overflow-x-auto px-1 [scrollbar-width:none]">
        <div className="w-max">
          <div className="flex gap-[3px]">
            {months.map((m, i) => (
              <span key={i} className="w-[11px] text-[9px] text-muted">
                {m}
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-[3px]">
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.cells.map((cell, d) =>
                  cell ? (
                    <span
                      key={cell.key}
                      title={`${cell.count} workout${cell.count === 1 ? "" : "s"} · ${cell.label}`}
                      className={`h-[11px] w-[11px] rounded-[2px] ${SHADE[cell.level]}`}
                    />
                  ) : (
                    <span key={d} className="h-[11px] w-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        Less
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={`h-[9px] w-[9px] rounded-[2px] ${SHADE[l]}`} />
        ))}
        More
      </div>
    </section>
  );
}
