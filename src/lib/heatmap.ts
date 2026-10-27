import { isPlainRestDay } from "@/lib/plans";
import type { Session } from "@/lib/types";

/** One square: a date, and how many workouts were finished on it. */
export type Cell = { key: string; label: string; count: number; level: 0 | 1 | 2 | 3 | 4 };

/** One column of the grid: Monday first, Sunday last. Future days are null. */
export type Column = { month: number; cells: (Cell | null)[] };

export const WEEKS = 53;

/** Local YYYY-MM-DD, so days group by the phone's clock rather than UTC. */
export function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Built once: formatting ~370 dates per render is slow on an old phone. */
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/** 0–4, matching the five shades in the legend. */
function levelOf(count: number): Cell["level"] {
  if (count <= 0) return 0;
  return Math.min(4, count) as Cell["level"];
}

/** Counts workouts per day. Rest days logged with nothing ticked don't count. */
export function countsByDay(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (isPlainRestDay(s)) continue;
    const key = dayKey(new Date(s.startedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * The last `WEEKS` Monday-to-Sunday columns ending with the week `today` is in.
 * Days after today are null so the grid stops rather than showing empty squares.
 */
export function heatmapColumns(sessions: Session[], today: Date): Column[] {
  const counts = countsByDay(sessions);
  const todayKey = dayKey(today);

  // Monday of the first column shown.
  const mondayOffset = (today.getDay() + 6) % 7;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (WEEKS - 1) * 7);

  const columns: Column[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const month = cursor.getMonth();
    const cells: (Cell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      if (key > todayKey) {
        cells.push(null);
      } else {
        const count = counts.get(key) ?? 0;
        cells.push({
          key,
          label: DATE_FORMAT.format(cursor),
          count,
          level: levelOf(count),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push({ month, cells });
  }
  return columns;
}

/**
 * Total workouts in the last 365 days. The grid starts on a Monday, so its
 * first column can reach up to six days further back — those don't count.
 */
export function heatmapTotal(columns: Column[], today: Date): number {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364);
  const fromKey = dayKey(from);
  let total = 0;
  for (const col of columns) {
    for (const cell of col.cells) {
      if (cell && cell.key >= fromKey) total += cell.count;
    }
  }
  return total;
}

/** Label a column with its month name only when the month changes. */
export function monthLabels(columns: Column[]): (string | null)[] {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return columns.map((col, i) => {
    if (i === 0) return null; // The first column is usually a stub of the month before.
    return col.month === columns[i - 1].month ? null : names[col.month];
  });
}

/** Longest run of consecutive days with a workout, ending on or before today. */
export function currentStreak(sessions: Session[], today: Date): number {
  const counts = countsByDay(sessions);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Today not being done yet shouldn't break yesterday's streak.
  if (!counts.get(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (counts.get(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
