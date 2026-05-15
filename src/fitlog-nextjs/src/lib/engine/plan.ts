// Plan-screen engine — pure helpers.
// Ported from src/fitlog-mobile.html:
//   calcEtaMins()   — line 12338
//   dowName()       — line 10656
//   renderPlan()    — line 16833
// No DOM, no Supabase.

import type { Workout, Movement, PlanItem } from "@/lib/types";

// ─── Utilities ────────────────────────────────────────────────────────────────

export const DOW_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Weekday name for a dow 0–6. HTML build line 10656. */
export function dowName(d: number): string {
  return DOW_NAMES[d] ?? "—";
}

/**
 * Estimate session duration in minutes.
 * 1 min per set (work) + 2 min per set (rest) + 1 min per movement transition.
 * HTML build line 12338.
 */
export function calcEtaMins(totalSets: number, totalMovements: number): number {
  if (!totalSets) return 0;
  const work = totalSets * 1;
  const rest = totalSets * 2;
  const transitions = Math.max(0, totalMovements - 1) * 1;
  return work + rest + transitions;
}

/** Format decimal minutes as "~Xm" or "~Xh Ym". */
export function fmtEta(mins: number): string {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `~${h}h ${m}m` : `~${mins}m`;
}

// ─── Week-state helpers ───────────────────────────────────────────────────────

/** Start of the current ISO week (Monday midnight local). */
function weekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const diffToMon = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Set of movementIds that have at least one done set in the current week.
 * HTML build line 16862.
 */
export function doneMidsThisWeek(workouts: Workout[]): Set<string> {
  const { start, end } = weekBounds();
  const done = new Set<string>();
  for (const w of workouts) {
    const d = new Date(w.date ?? w.savedAt ?? 0);
    if (d < start || d > end) continue;
    for (const e of w.entries ?? []) {
      if (e.movementId && (e.sets ?? []).some((s) => s.done)) {
        done.add(e.movementId);
      }
    }
  }
  return done;
}

/** Per-dow stats for the week strip. */
export type DowStats = {
  dow: number;
  letter: string;
  name: string;
  isToday: boolean;
  mvCount: number;
  doneCount: number;
  isRest: boolean;
  allDone: boolean;
  partial: boolean;
};

export function buildDowStats(
  plans: PlanItem[],
  movements: Movement[],
  workouts: Workout[]
): DowStats[] {
  const todayDow = new Date().getDay();
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const done = doneMidsThisWeek(workouts);

  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const items = plans.filter((p) => p.dow === dow && mvMap.has(p.mid));
    const mvCount = items.length;
    const doneCount = items.filter((p) => done.has(p.mid)).length;
    const isRest = mvCount === 0;
    const allDone = mvCount > 0 && doneCount === mvCount;
    const partial = mvCount > 0 && doneCount > 0 && doneCount < mvCount;
    return {
      dow,
      letter: DOW_LETTERS[dow],
      name: DOW_NAMES[dow],
      isToday: dow === todayDow,
      mvCount,
      doneCount,
      isRest,
      allDone,
      partial,
    };
  });
}

/** Day order: today first, then rotating. HTML build line 16840. */
export function rotatedDowOrder(): number[] {
  const todayDow = new Date().getDay();
  return [0, 1, 2, 3, 4, 5, 6].map((i) => (todayDow + i) % 7);
}

/** Estimated sets for a plan item — plan.sets or fallback 3. */
export function planItemSets(p: PlanItem): number {
  return Number(p.sets) > 0 ? Number(p.sets) : 3;
}

/** Group PlanItems by muscle key for a given dow. */
export function groupPlanByMuscle(
  plans: PlanItem[],
  movements: Movement[],
  dow: number
): Array<{ muscle: string; label: string; items: Array<{ plan: PlanItem; mv: Movement }> }> {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const dayPlans = plans
    .filter((p) => p.dow === dow)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const muscleMap = new Map<string, Array<{ plan: PlanItem; mv: Movement }>>();
  for (const p of dayPlans) {
    const mv = mvMap.get(p.mid);
    if (!mv) continue;
    const key = (mv.muscle ?? mv.category ?? "other").toLowerCase();
    if (!muscleMap.has(key)) muscleMap.set(key, []);
    muscleMap.get(key)!.push({ plan: p, mv });
  }

  const MUSCLE_ORDER = [
    "chest", "back", "shoulders", "bicepts", "biceps", "tricepts", "triceps",
    "core", "quads", "hamstrings", "glutes", "calves", "cardio", "other",
  ];

  const result: Array<{ muscle: string; label: string; items: Array<{ plan: PlanItem; mv: Movement }> }> = [];
  for (const key of MUSCLE_ORDER) {
    const group = muscleMap.get(key);
    if (group?.length) {
      muscleMap.delete(key);
      result.push({ muscle: key, label: key.charAt(0).toUpperCase() + key.slice(1), items: group });
    }
  }
  for (const [key, group] of muscleMap) {
    result.push({ muscle: key, label: key.charAt(0).toUpperCase() + key.slice(1), items: group });
  }
  return result;
}
