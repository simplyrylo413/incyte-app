// Engine helpers for the Today screen.
// Pure functions — no DOM, no Supabase calls.
// Source behavior from src/fitlog-mobile.html renderTodayV2() ~ line 13212.

import type { Movement, Workout, WorkoutEntry, SetEntry, PlanItem } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const EQUIPMENT_OPTIONS = [
  "unspecified",
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
] as const;

export type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

// TODAY_HEADLINES_V2 pool — stable-per-day hash selects one.
// Source: fitlog-mobile.html line 13187.
const HEADLINES = [
  "Let's work.",
  "Time to lift.",
  "Earn it.",
  "Run it back.",
  "Stack the day.",
  "Move with intent.",
  "Stay sharp.",
  "Set the bar.",
  "Train hard.",
  "Lift heavy.",
  "Add a plate.",
  "Beat last week.",
  "Outwork yesterday.",
  "Lock in.",
  "Under the bar.",
  "Build the week.",
];

// ─── Headline ────────────────────────────────────────────────────────────────

/** Stable-per-calendar-day headline. Matches todayHeadlineV2() in HTML build. */
export function todayHeadline(): string {
  const key = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h * 31) + key.charCodeAt(i)) | 0;
  return HEADLINES[Math.abs(h) % HEADLINES.length];
}

// ─── Date label ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function todayDateLabel(split?: string | null): string {
  const d = new Date();
  const base = `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return split ? `${base} · ${split}` : base;
}

// ─── Today's plan filter ─────────────────────────────────────────────────────

/** Filter plan items to today's day-of-week (0=Sun…6=Sat). */
export function filterTodaysPlan(plans: PlanItem[]): PlanItem[] {
  const dow = new Date().getDay();
  return plans.filter((p) => p.dow === dow);
}

// ─── Today's finished workouts ───────────────────────────────────────────────

/**
 * Return workouts that were finished/saved today (local date, not UTC).
 * Matches finishedTodayWorkouts() logic in HTML build.
 */
export function filterFinishedToday(workouts: Workout[]): Workout[] {
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return workouts.filter((w) => {
    if (!w.finished) return false;
    const ts = w.savedAt || w.completed_at || w.date;
    if (!ts) return false;
    const wd = new Date(ts);
    const wKey = `${wd.getFullYear()}-${wd.getMonth()}-${wd.getDate()}`;
    return wKey === todayKey;
  });
}

// ─── Stats calculation ───────────────────────────────────────────────────────

export type DayStats = {
  totalSets: number;
  doneSets: number;
  totalVolume: number;
  avgRpe: number | null;
  completePct: number;
  volumeByPart: Record<string, number>;
  planMinutes: number;
  totalMovements: number;
};

function hasValue(v: unknown): boolean {
  return v != null && v !== "";
}

function displayGroup(muscle?: string | null, bodyPart?: string | null): string {
  const m = String(muscle || "").toLowerCase();
  if (m === "glute" || m === "glutes") return "Glutes";
  if (m === "hamstring" || m === "hamstrings") return "Hamstrings";
  if (m === "quad" || m === "quads" || m === "quadriceps") return "Quads";
  if (m === "calf" || m === "calves") return "Calves";
  return (bodyPart || muscle || "—").toString();
}

function collectEntry(
  entry: WorkoutEntry | null,
  mv: Movement | null,
  fallbackSets: number,
  state: { total: number; done: number; volume: number; rpeSum: number; rpeCount: number; byPart: Record<string, number> }
) {
  const sets: SetEntry[] = (entry?.sets) ?? [];
  const isStrength = !mv || (mv.category !== "cardio" && mv.category !== "mobility");

  if (sets.length === 0) {
    if (fallbackSets > 0 && isStrength) state.total += fallbackSets;
    return;
  }

  state.total += sets.length;
  for (const s of sets) {
    if (!s.done) continue;
    state.done++;
    if (isStrength && hasValue(s.weight) && hasValue(s.reps)) {
      const v = Number(s.weight) * Number(s.reps);
      if (!isNaN(v)) {
        state.volume += v;
        const muscle = entry?.muscle ?? mv?.muscle ?? null;
        const bp = displayGroup(muscle, mv?.bodyPart ?? mv?.category ?? null);
        state.byPart[bp.toUpperCase()] = (state.byPart[bp.toUpperCase()] ?? 0) + v;
      }
      if (hasValue(s.rpe) && !isNaN(Number(s.rpe))) {
        state.rpeSum += Number(s.rpe);
        state.rpeCount++;
      }
    }
  }
}

/**
 * Compute session stats from active entries, plan items, and finished-today workouts.
 * Matches the stat calculation block in renderTodayV2() HTML build line ~13292.
 */
export function calcDayStats(
  planItems: PlanItem[],
  entries: WorkoutEntry[],
  mvMap: Map<string, Movement>,
  finishedToday: Workout[]
): DayStats {
  const s = { total: 0, done: 0, volume: 0, rpeSum: 0, rpeCount: 0, byPart: {} as Record<string, number> };
  const countedMovements = new Set<string>();

  // Plan items
  for (const p of planItems) {
    const mv = mvMap.get(p.mid) ?? null;
    const entry = entries.find((e) => e.planId === p.id) ?? null;
    const fallback = (() => {
      const ex = Number(p.sets);
      if (isFinite(ex) && ex > 0) return ex;
      const lib = Number(mv?.defaultSets);
      if (isFinite(lib) && lib > 0) return lib;
      return 0;
    })();
    collectEntry(entry, mv, fallback, s);
    if (p.mid) countedMovements.add(p.mid);
  }

  // Adhoc entries (no planId or planId not in today's plan)
  const planIds = new Set(planItems.map((p) => p.id));
  const adhocEntries = entries.filter((e) => !e.planId || !planIds.has(e.planId));
  for (const e of adhocEntries) {
    const mv = mvMap.get(e.movementId) ?? null;
    const fallback = (() => {
      const lib = Number(mv?.defaultSets);
      return isFinite(lib) && lib > 0 ? lib : 0;
    })();
    collectEntry(e, mv, fallback, s);
    if (e.movementId) countedMovements.add(e.movementId);
  }

  // Already-finished sessions today
  for (const w of finishedToday) {
    for (const e of w.entries ?? []) {
      const mv = mvMap.get(e.movementId) ?? null;
      collectEntry(e, mv, 0, s);
      if (e.movementId) countedMovements.add(e.movementId);
    }
  }

  const totalMovements = countedMovements.size;
  const avgRpe = s.rpeCount > 0 ? s.rpeSum / s.rpeCount : null;
  const completePct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;

  // Realistic estimate: 5 min warm-up + 3 min/set (1 work + 2 rest) + 2 min/movement transition
  // e.g. 6 sets, 2 movements → 5 + 18 + 2 = 25 min (vs old formula giving 8 min)
  const planMinutes = s.total > 0
    ? 5 + s.total * 3 + Math.max(0, totalMovements - 1) * 2
    : 0;

  return {
    totalSets: s.total,
    doneSets: s.done,
    totalVolume: s.volume,
    avgRpe,
    completePct,
    volumeByPart: s.byPart,
    planMinutes,
    totalMovements,
  };
}

// ─── Movement list item ───────────────────────────────────────────────────────

export type TodayItem = {
  planId: string;         // p.id
  mid: string;
  mv: Movement | null;
  entry: WorkoutEntry | null;
  fromHistory: boolean;
  sourceWorkoutId?: string;
  skipped?: boolean;
};

/**
 * Build the flat list of today's movements split into remaining vs completed.
 * Matches the allItems / remainingItems / completedItems logic in renderTodayV2().
 */
export function buildTodayItems(opts: {
  planItems: PlanItem[];
  activeEntries: WorkoutEntry[];
  finishedToday: Workout[];
  mvMap: Map<string, Movement>;
  hiddenPlanIds?: Set<string>;
  sessionDoneToday: boolean;
}): { remaining: TodayItem[]; completed: TodayItem[] } {
  const { planItems, activeEntries, finishedToday, mvMap, hiddenPlanIds = new Set(), sessionDoneToday } = opts;

  // IDs of movements already in a finished session today
  const finishedMids = new Set<string>();
  for (const w of finishedToday) {
    for (const e of w.entries ?? []) {
      if (e.movementId && (e.sets ?? []).some((s) => s.done)) {
        finishedMids.add(e.movementId);
      }
    }
  }

  const planIds = new Set(planItems.map((p) => p.id));

  const allItems: TodayItem[] = [
    // Plan items (filtered)
    ...planItems
      .filter((p) => !finishedMids.has(p.mid) && !hiddenPlanIds.has(p.id))
      .map((p) => ({
        planId: p.id,
        mid: p.mid,
        mv: mvMap.get(p.mid) ?? null,
        entry: activeEntries.find((e) => e.planId === p.id) ?? null,
        fromHistory: false,
      })),
    // Adhoc entries
    ...activeEntries
      .filter((e) => (!e.planId || !planIds.has(e.planId)) && !finishedMids.has(e.movementId))
      .map((e) => ({
        planId: e.planId || `adhoc-${e.movementId}`,
        mid: e.movementId,
        mv: mvMap.get(e.movementId) ?? null,
        entry: e,
        fromHistory: false,
      })),
  ];

  const remaining: TodayItem[] = [];
  const completed: TodayItem[] = [];
  const seenCompletedMids = new Set<string>();

  for (const item of allItems) {
    const sets = item.entry?.sets ?? [];
    const done = sets.filter((s) => s.done).length;
    const total = sets.length;
    if (total > 0 && done === total) {
      completed.push(item);
      seenCompletedMids.add(item.mid);
    } else if (sessionDoneToday && done === 0) {
      completed.push({ ...item, skipped: true });
      seenCompletedMids.add(item.mid);
    } else {
      remaining.push(item);
    }
  }

  // Pull in history-sourced completed movements
  for (const w of finishedToday) {
    for (const e of w.entries ?? []) {
      if (!e.movementId || seenCompletedMids.has(e.movementId)) continue;
      const sets = e.sets ?? [];
      if (!sets.length || !sets.some((s) => s.done)) continue;
      completed.push({
        planId: `hist-${w.id}-${e.movementId}`,
        mid: e.movementId,
        mv: mvMap.get(e.movementId) ?? null,
        entry: e,
        fromHistory: true,
        sourceWorkoutId: w.id,
      });
      seenCompletedMids.add(e.movementId);
    }
  }

  return { remaining, completed };
}

// ─── Grouping ────────────────────────────────────────────────────────────────

/** Group items by body part for eyebrow-separated rendering. */
export function groupByBodyPart(items: TodayItem[]): [string, TodayItem[]][] {
  const order: string[] = [];
  const groups: Record<string, TodayItem[]> = {};
  for (const item of items) {
    const bp = (
      item.mv?.bodyPart || item.mv?.muscle || item.mv?.category || "Other"
    ).toString();
    if (!groups[bp]) { groups[bp] = []; order.push(bp); }
    groups[bp].push(item);
  }
  return order.map((bp) => [bp, groups[bp]]);
}

/** Set progress for a movement item. */
export function itemProgress(item: TodayItem): { done: number; total: number } {
  const sets = item.entry?.sets ?? [];
  return {
    done: sets.filter((s) => s.done).length,
    total: sets.length,
  };
}
