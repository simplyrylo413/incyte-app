// Workout-mode engine — pure set operations.
// Ported from src/fitlog-mobile.html functions logSetV2, addSetV2, etc.
// No DOM, no Supabase calls. All mutations return NEW arrays (immutable style)
// so React state can diff them cleanly.

import type { SetEntry, WorkoutEntry, Workout } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MutableEntry = WorkoutEntry & { sets: SetEntry[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasValue(v: unknown): boolean {
  return v != null && v !== "";
}

/** First undone set index, or -1 if all done. */
export function currentSetIdx(entry: WorkoutEntry): number {
  for (let i = 0; i < (entry.sets ?? []).length; i++) {
    if (!entry.sets[i].done) return i;
  }
  return -1;
}

/** Format decimal minutes as mm:ss string. */
export function fmtMinSec(decimalMin: number | string | null | undefined): string {
  if (decimalMin == null || decimalMin === "") return "—";
  const total = Math.round(Number(decimalMin) * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Previous session reference label for a set row. */
export function prevLabel(s: SetEntry): string {
  if (hasValue(s.prevW) && hasValue(s.prevR)) return `${s.prevW} × ${s.prevR}`;
  return "—";
}

/** Whether any set in the entry has prev data. */
export function hasAnyPrev(entry: WorkoutEntry): boolean {
  return (entry.sets ?? []).some(
    (s) => hasValue(s.prevW) && hasValue(s.prevR)
  );
}

// ─── Default sets seeding ─────────────────────────────────────────────────────

/**
 * Seed initial sets for a movement when entering Workout Mode.
 * Matches defaultSetsFor() in the HTML build (line 14815).
 *
 * Priority:
 * 1. Clone sets from lastEntry with prevW/prevR populated (prior session data)
 * 2. Use planItem.sets count with blank values
 * 3. Fall back to 3 blank working sets
 */
export function defaultSetsFor(opts: {
  planSets?: number | null;
  planReps?: string | number | null;
  defaultSets?: number | null;
  lastEntry?: WorkoutEntry | null;
}): SetEntry[] {
  const { planSets, planReps, defaultSets, lastEntry } = opts;

  // If we have a prior session entry, clone its sets with prev values seeded
  if (lastEntry?.sets?.length) {
    const count =
      (planSets && planSets > 0 ? planSets : null) ??
      lastEntry.sets.length;
    const seed = lastEntry.sets[0];
    const sets: SetEntry[] = Array.from({ length: count }, (_, i) => {
      const src = lastEntry.sets[i] ?? seed;
      return {
        weight: null,
        reps: planReps != null ? planReps : null,
        rpe: null,
        done: false,
        warmup: src.warmup ?? false,
        bw: src.bw ?? false,
        prevW: hasValue(src.weight) ? src.weight : null,
        prevR: hasValue(src.reps) ? src.reps : null,
        prevRpe: hasValue(src.rpe) ? src.rpe : null,
        baseline: true,
      };
    });
    return sets;
  }

  // No prior data — use plan's set count or library default
  const count =
    (planSets && planSets > 0 ? planSets : null) ??
    (defaultSets && defaultSets > 0 ? defaultSets : null) ??
    3;

  return Array.from({ length: count }, () => ({
    weight: null,
    reps: planReps != null ? planReps : null,
    rpe: null,
    done: false,
    warmup: false,
    bw: false,
  }));
}

// ─── Set mutations (return new sets array) ────────────────────────────────────

function cloneSets(sets: SetEntry[]): SetEntry[] {
  return sets.map((s) => ({ ...s }));
}

/** Mark set at idx as done. Returns new sets array. */
export function logSet(sets: SetEntry[], idx: number): SetEntry[] {
  const next = cloneSets(sets);
  next[idx] = { ...next[idx], done: true, baseline: false };
  return next;
}

/** Un-mark set at idx as done. Returns new sets array. */
export function reopenSet(sets: SetEntry[], idx: number): SetEntry[] {
  const next = cloneSets(sets);
  next[idx] = { ...next[idx], done: false };
  return next;
}

/** Toggle warmup ↔ working for set at idx. */
export function toggleSetType(sets: SetEntry[], idx: number): SetEntry[] {
  const next = cloneSets(sets);
  next[idx] = { ...next[idx], warmup: !next[idx].warmup, baseline: false };
  return next;
}

/** Toggle bodyweight flag for set at idx. */
export function toggleBodyweight(sets: SetEntry[], idx: number): SetEntry[] {
  const next = cloneSets(sets);
  next[idx] = { ...next[idx], bw: !next[idx].bw, baseline: false };
  return next;
}

/** Set a field value on set at idx. */
export function patchSet(
  sets: SetEntry[],
  idx: number,
  field: "weight" | "reps" | "rpe" | "time",
  value: number
): SetEntry[] {
  const next = cloneSets(sets);
  next[idx] = { ...next[idx], [field]: value, baseline: false };
  return next;
}

/** Append a new set, copying weight/reps from the last set. */
export function addSet(sets: SetEntry[]): SetEntry[] {
  const last = sets[sets.length - 1];
  return [
    ...sets,
    {
      weight: last?.weight ?? null,
      reps: last?.reps ?? null,
      rpe: null,
      done: false,
      warmup: false,
      bw: false,
    },
  ];
}

/** Remove set at idx. Minimum 1 set enforced by caller. */
export function removeSet(sets: SetEntry[], idx: number): SetEntry[] {
  return sets.filter((_, i) => i !== idx);
}

/** Whether all sets are done. */
export function allSetsDone(sets: SetEntry[]): boolean {
  return sets.length > 0 && sets.every((s) => s.done);
}

// ─── Archive helper ───────────────────────────────────────────────────────────

/**
 * Archive a completed entry to today's finished workout session.
 * Mirrors archiveMovementToTodayV2() in HTML build (line 13823).
 * Returns the updated workouts array + the session that was touched.
 */
export function archiveEntryToToday(
  entry: WorkoutEntry,
  workouts: Workout[]
): { workouts: Workout[]; session: Workout } {
  const nowIso = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's existing finished session
  let session = workouts.find((w) => {
    if (!w.finished) return false;
    const ts = new Date(w.savedAt ?? w.completed_at ?? w.date ?? 0);
    ts.setHours(0, 0, 0, 0);
    return ts.getTime() === today.getTime();
  }) ?? null;

  let updatedWorkouts: Workout[];

  const archived: WorkoutEntry = {
    movementId: entry.movementId,
    canonicalMovement: entry.canonicalMovement,
    equipmentType: entry.equipmentType,
    variant: entry.variant,
    muscle: entry.muscle,
    name: entry.name,
    sets: (entry.sets ?? []).map((s) => ({ ...s })),
    skipped: false,
    archivedAt: nowIso,
  };

  if (!session) {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    session = {
      id: crypto.randomUUID(),
      name: `${DAYS[today.getDay()]} session`,
      date: today.toISOString(),
      entries: [archived],
      finished: true,
      workout_status: "completed",
      completed_at: nowIso,
      savedAt: nowIso,
      autoArchived: true,
    };
    updatedWorkouts = [...workouts, session];
  } else {
    // Merge into existing session
    const existingIdx = session.entries.findIndex(
      (e) => e.movementId === archived.movementId
    );
    let newEntries: WorkoutEntry[];
    if (existingIdx >= 0) {
      const prior = session.entries[existingIdx];
      newEntries = session.entries.map((e, i) =>
        i === existingIdx
          ? { ...prior, ...archived, sets: [...(prior.sets ?? []), ...archived.sets] }
          : e
      );
    } else {
      newEntries = [...session.entries, archived];
    }
    const updatedSession: Workout = {
      ...session,
      entries: newEntries,
      completed_at: nowIso,
      savedAt: nowIso,
      edited_at: nowIso,
    };
    session = updatedSession;
    updatedWorkouts = workouts.map((w) =>
      w.id === session!.id ? session! : w
    );
  }

  return { workouts: updatedWorkouts, session };
}

// ─── Picker config ────────────────────────────────────────────────────────────

export type PickerField = "weight" | "reps" | "rpe";

export const PICKER_CONFIG: Record<
  PickerField,
  {
    title: string;
    unit: string;
    default: number;
    steps: number[];
    presets: (v: number) => number[];
    min: number;
    decimals: number;
  }
> = {
  weight: {
    title: "Weight",
    unit: "LB",
    default: 95,
    steps: [-10, -5, -2.5, 2.5, 5, 10],
    presets: (v) =>
      [Math.max(0, v - 20), Math.max(0, v - 10), Math.max(0, v - 5), v, v + 5, v + 10, v + 20].filter(
        (x, i, arr) => arr.indexOf(x) === i
      ),
    min: 0,
    decimals: 1,
  },
  reps: {
    title: "Reps",
    unit: "REPS",
    default: 10,
    steps: [-2, -1, 1, 2],
    presets: () => [1, 3, 5, 8, 10, 12, 15],
    min: 1,
    decimals: 0,
  },
  rpe: {
    title: "RPE",
    unit: "EFFORT",
    default: 7,
    steps: [-1, -0.5, 0.5, 1],
    presets: () => [6, 7, 7.5, 8, 8.5, 9, 9.5, 10],
    min: 1,
    decimals: 1,
  },
};
