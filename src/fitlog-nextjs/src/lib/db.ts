// Client-side data access against the shared Supabase backend
// (drlmpltseepsxostsqdq) — same project the HTML build at
// src/fitlog-mobile.html uses. All reads/writes here MUST stay
// compatible with the HTML build's schema:
//   - workouts: id, device_id, name, date (iso), finished, entries (jsonb),
//     saved_at, completed_at, edited_at, notes
//   - movements: id, device_id, name, kind, muscle, body_part, unit,
//     equipment_type, variant, canonical_movement, default_sets, ...
//   - plans: id, device_id, mid, dow, sets, reps, rpe, ...
//
// Phase 8: queries use auth.uid() when the user is signed in; fall back to
// device_id otherwise. On first sign-in, adoptDeviceRowsIfNeeded() migrates
// existing rows from the old device_id to the uid, then overwrites
// localStorage fitlog_device_id = uid so future reads are consistent.

"use client";

import { createClient } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/device";
import type {
  Movement,
  PlanItem,
  Workout,
  WorkoutEntry,
} from "@/lib/types";

// ─── Identity resolution ──────────────────────────────────────────────────────

/**
 * Returns auth.uid() when the user is signed in, otherwise falls back to the
 * anonymous device_id. Uses getSession() (local/cookie read — no network hop)
 * so it's fast to call before every query.
 */
async function getIdentifier(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;
  return getDeviceId();
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Sign out the current user and clear any cached session. */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** Current Supabase user, or null if not signed in. */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/**
 * One-time migration: transfers all rows keyed by the old device_id to the
 * user's uid. Called immediately after successful sign-in.
 *
 * Strategy: update device_id → uid across all three tables, then overwrite
 * localStorage's fitlog_device_id with the uid so getDeviceId() returns the
 * uid from this point forward. No schema changes needed.
 *
 * Idempotent — guarded by a localStorage flag keyed to the uid.
 */
const MIGRATED_KEY = "fitlog_migrated_uid";

export async function adoptDeviceRowsIfNeeded(uid: string): Promise<void> {
  if (typeof localStorage === "undefined") return;

  // Already migrated for this uid — skip.
  if (localStorage.getItem(MIGRATED_KEY) === uid) return;

  const deviceId = localStorage.getItem("fitlog_device_id");

  // No old anonymous rows, or device_id already equals the uid.
  if (!deviceId || deviceId === uid) {
    localStorage.setItem("fitlog_device_id", uid);
    localStorage.setItem(MIGRATED_KEY, uid);
    return;
  }

  const supabase = createClient();
  await Promise.all([
    supabase.from("movements").update({ device_id: uid }).eq("device_id", deviceId),
    supabase.from("workouts").update({ device_id: uid }).eq("device_id", deviceId),
    supabase.from("plans").update({ device_id: uid }).eq("device_id", deviceId),
  ]);

  // Point device_id at the uid so all subsequent getDeviceId() calls return it.
  localStorage.setItem("fitlog_device_id", uid);
  localStorage.setItem(MIGRATED_KEY, uid);
}

// ============================================================================
// MOVEMENTS
// ============================================================================

// Default movement library seeded on first use.
// Covers the major compound + isolation patterns across all muscle groups.
const DEFAULT_MOVEMENTS: Array<{
  name: string;
  muscle: string;
  equipmentType?: string;
  kind?: "weight" | "cardio";
}> = [
  // Chest
  { name: "Bench Press", muscle: "chest", equipmentType: "barbell" },
  { name: "Incline Dumbbell Press", muscle: "chest", equipmentType: "dumbbell" },
  { name: "Cable Fly", muscle: "chest", equipmentType: "cable" },
  { name: "Dips", muscle: "chest", equipmentType: "bodyweight" },
  // Back
  { name: "Deadlift", muscle: "back", equipmentType: "barbell" },
  { name: "Pull-Up", muscle: "back", equipmentType: "bodyweight" },
  { name: "Barbell Row", muscle: "back", equipmentType: "barbell" },
  { name: "Cable Row", muscle: "back", equipmentType: "cable" },
  { name: "Lat Pulldown", muscle: "back", equipmentType: "cable" },
  // Shoulders
  { name: "Overhead Press", muscle: "shoulders", equipmentType: "barbell" },
  { name: "Lateral Raise", muscle: "shoulders", equipmentType: "dumbbell" },
  { name: "Face Pull", muscle: "shoulders", equipmentType: "cable" },
  // Biceps
  { name: "Barbell Curl", muscle: "biceps", equipmentType: "barbell" },
  { name: "Dumbbell Curl", muscle: "biceps", equipmentType: "dumbbell" },
  { name: "Cable Curl", muscle: "biceps", equipmentType: "cable" },
  // Triceps
  { name: "Tricep Pushdown", muscle: "triceps", equipmentType: "cable" },
  { name: "Skull Crusher", muscle: "triceps", equipmentType: "barbell" },
  { name: "Overhead Tricep Extension", muscle: "triceps", equipmentType: "dumbbell" },
  // Legs
  { name: "Squat", muscle: "quads", equipmentType: "barbell" },
  { name: "Leg Press", muscle: "quads", equipmentType: "machine" },
  { name: "Romanian Deadlift", muscle: "hamstrings", equipmentType: "barbell" },
  { name: "Leg Curl", muscle: "hamstrings", equipmentType: "machine" },
  { name: "Hip Thrust", muscle: "glutes", equipmentType: "barbell" },
  { name: "Calf Raise", muscle: "calves", equipmentType: "machine" },
  // Core
  { name: "Plank", muscle: "core", equipmentType: "bodyweight" },
  // Cardio
  { name: "Running", muscle: "cardio", kind: "cardio" },
];

async function seedDefaultMovements(deviceId: string): Promise<Movement[]> {
  const supabase = createClient();
  const now = Date.now();
  const rows = DEFAULT_MOVEMENTS.map((m, i) => ({
    id: `mv_seed_${i}_${now}`,
    device_id: deviceId,
    name: m.name,
    muscle: m.muscle,
    body_part: m.muscle,
    kind: m.kind ?? null,
    equipment_type: m.equipmentType ?? null,
    canonical_movement: m.name,
    variant: null,
    unit: null,
    default_sets: null,
    notes: null,
  }));
  const { error } = await supabase.from("movements").insert(rows);
  if (error) {
    console.warn("[db] seedDefaultMovements failed:", error);
    return [];
  }
  return rows.map(rowToMovement);
}

export async function listMovements(): Promise<Movement[]> {
  const supabase = createClient();
  const id = await getIdentifier();
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("device_id", id)
    .order("name", { ascending: true });
  if (error) {
    console.warn("[db] listMovements failed:", error);
    return [];
  }
  const existing = (data ?? []).map(rowToMovement);
  // Auto-seed on first use
  if (existing.length === 0) {
    return seedDefaultMovements(id);
  }
  return existing;
}

export async function upsertMovement(m: Movement): Promise<boolean> {
  const supabase = createClient();
  const id = await getIdentifier();
  const { error } = await supabase.from("movements").upsert({
    id: m.id,
    device_id: id,
    name: m.name,
    kind: m.kind ?? null,
    muscle: m.muscle ?? null,
    body_part: m.bodyPart ?? null,
    unit: m.unit ?? null,
    equipment_type: m.equipmentType ?? null,
    variant: m.variant ?? null,
    canonical_movement: m.canonicalMovement ?? null,
    default_sets: m.defaultSets ?? null,
    notes: m.notes ?? null,
  });
  if (error) {
    console.warn("[db] upsertMovement failed:", error);
    return false;
  }
  return true;
}

export async function deleteMovement(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) {
    console.warn("[db] deleteMovement failed:", error);
    return false;
  }
  return true;
}

// ============================================================================
// WORKOUTS
// ============================================================================

export async function listWorkouts(opts?: {
  finished?: boolean;
  limit?: number;
}): Promise<Workout[]> {
  const supabase = createClient();
  const id = await getIdentifier();
  let q = supabase
    .from("workouts")
    .select("*")
    .eq("device_id", id)
    .order("date", { ascending: false });
  if (opts?.finished !== undefined) q = q.eq("finished", opts.finished);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.warn("[db] listWorkouts failed:", error);
    return [];
  }
  return (data ?? []).map(rowToWorkout);
}

export async function listFinishedTodayWorkouts(): Promise<Workout[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const all = await listWorkouts({ finished: true });
  return all.filter((w) => {
    const ts = new Date(w.date || w.savedAt || 0);
    return (
      ts.getFullYear() === today.getFullYear() &&
      ts.getMonth() === today.getMonth() &&
      ts.getDate() === today.getDate()
    );
  });
}

export async function upsertWorkout(w: Workout): Promise<boolean> {
  const supabase = createClient();
  const id = await getIdentifier();
  const { error } = await supabase.from("workouts").upsert({
    id: w.id,
    device_id: id,
    name: w.name ?? "",
    date: w.date,
    finished: !!w.finished,
    entries: w.entries ?? [],
    saved_at: w.savedAt ?? null,
    completed_at: w.completed_at ?? null,
    edited_at: w.edited_at ?? null,
    notes: w.notes ?? null,
  });
  if (error) {
    console.warn("[db] upsertWorkout failed:", error);
    return false;
  }
  return true;
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) {
    console.warn("[db] deleteWorkout failed:", error);
    return false;
  }
  return true;
}

// ============================================================================
// PLANS
// ============================================================================

export async function listPlans(): Promise<PlanItem[]> {
  const supabase = createClient();
  const id = await getIdentifier();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("device_id", id)
    .order("dow", { ascending: true });
  if (error) {
    console.warn("[db] listPlans failed:", error);
    return [];
  }
  return (data ?? []).map(rowToPlan);
}

export async function upsertPlan(p: PlanItem): Promise<boolean> {
  const supabase = createClient();
  const id = await getIdentifier();
  const { error } = await supabase.from("plans").upsert({
    id: p.id,
    device_id: id,
    mid: p.mid,
    dow: p.dow,
    sets: p.sets ?? null,
    reps: typeof p.reps === "number" ? String(p.reps) : (p.reps as string | null) ?? null,
    rpe: typeof p.rpe === "number" ? String(p.rpe) : (p.rpe as string | null) ?? null,
    tempo: p.tempo ?? null,
    notes: p.notes ?? null,
    target_weight: p.targetWeight ?? null,
    training_type: p.trainingType ?? null,
  });
  if (error) {
    console.warn("[db] upsertPlan failed:", error);
    return false;
  }
  return true;
}

export async function deletePlan(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) {
    console.warn("[db] deletePlan failed:", error);
    return false;
  }
  return true;
}

// ============================================================================
// Row → domain object mappers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMovement(r: any): Movement {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind ?? undefined,
    muscle: r.muscle ?? undefined,
    bodyPart: r.body_part ?? undefined,
    unit: r.unit ?? undefined,
    notes: r.notes ?? null,
    equipmentType: r.equipment_type ?? undefined,
    variant: r.variant ?? undefined,
    canonicalMovement: r.canonical_movement ?? undefined,
    defaultSets: r.default_sets ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWorkout(r: any): Workout {
  return {
    id: r.id,
    device_id: r.device_id ?? undefined,
    name: r.name ?? undefined,
    date: r.date,
    finished: !!r.finished,
    entries: (r.entries ?? []) as WorkoutEntry[],
    savedAt: r.saved_at ?? undefined,
    completed_at: r.completed_at ?? undefined,
    edited_at: r.edited_at ?? undefined,
    notes: r.notes ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPlan(r: any): PlanItem {
  return {
    id: r.id,
    mid: r.mid,
    dow: r.dow,
    sets: r.sets ?? undefined,
    reps: r.reps ?? undefined,
    rpe: r.rpe ?? undefined,
    tempo: r.tempo ?? null,
    notes: r.notes ?? null,
    targetWeight: r.target_weight ?? null,
    trainingType: r.training_type ?? null,
  };
}
