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

/** True if s looks like a standard RFC-4122 UUID. */
function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Default movement library seeded on first use.
const DEFAULT_MOVEMENTS: Array<{
  name: string;
  bodyPart: string;
  equipmentType?: string;
  kind?: "weight" | "cardio";
}> = [
  // Chest
  { name: "Bench Press", bodyPart: "chest", equipmentType: "barbell" },
  { name: "Incline Dumbbell Press", bodyPart: "chest", equipmentType: "dumbbell" },
  { name: "Cable Fly", bodyPart: "chest", equipmentType: "cable" },
  { name: "Dips", bodyPart: "chest", equipmentType: "bodyweight" },
  // Back
  { name: "Deadlift", bodyPart: "back", equipmentType: "barbell" },
  { name: "Pull-Up", bodyPart: "back", equipmentType: "bodyweight" },
  { name: "Barbell Row", bodyPart: "back", equipmentType: "barbell" },
  { name: "Cable Row", bodyPart: "back", equipmentType: "cable" },
  { name: "Lat Pulldown", bodyPart: "back", equipmentType: "cable" },
  // Shoulders
  { name: "Overhead Press", bodyPart: "shoulders", equipmentType: "barbell" },
  { name: "Lateral Raise", bodyPart: "shoulders", equipmentType: "dumbbell" },
  { name: "Face Pull", bodyPart: "shoulders", equipmentType: "cable" },
  // Biceps
  { name: "Barbell Curl", bodyPart: "biceps", equipmentType: "barbell" },
  { name: "Dumbbell Curl", bodyPart: "biceps", equipmentType: "dumbbell" },
  { name: "Cable Curl", bodyPart: "biceps", equipmentType: "cable" },
  // Triceps
  { name: "Tricep Pushdown", bodyPart: "triceps", equipmentType: "cable" },
  { name: "Skull Crusher", bodyPart: "triceps", equipmentType: "barbell" },
  { name: "Overhead Tricep Extension", bodyPart: "triceps", equipmentType: "dumbbell" },
  // Legs
  { name: "Squat", bodyPart: "quads", equipmentType: "barbell" },
  { name: "Leg Press", bodyPart: "quads", equipmentType: "machine" },
  { name: "Romanian Deadlift", bodyPart: "hamstrings", equipmentType: "barbell" },
  { name: "Leg Curl", bodyPart: "hamstrings", equipmentType: "machine" },
  { name: "Hip Thrust", bodyPart: "glutes", equipmentType: "barbell" },
  { name: "Calf Raise", bodyPart: "calves", equipmentType: "machine" },
  // Core
  { name: "Plank", bodyPart: "core", equipmentType: "bodyweight" },
  // Cardio
  { name: "Running", bodyPart: "cardio", kind: "cardio" },
];

/**
 * Seeds the default movement library for a new user.
 * Uses upsert on (user_id, name) so it's safe to call multiple times.
 * user_id is set automatically via auth.uid() default on the DB column.
 */
async function seedDefaultMovements(): Promise<Movement[]> {
  const supabase = createClient();
  const rows = DEFAULT_MOVEMENTS.map((m) => ({
    id: crypto.randomUUID(),
    name: m.name,
    kind: m.kind ?? "weight",
    body_part: m.bodyPart,
    equipment_type: m.equipmentType ?? null,
  }));
  const { data, error } = await supabase
    .from("movements")
    .upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true })
    .select();
  if (error) {
    console.warn("[db] seedDefaultMovements failed:", error);
    return [];
  }
  return (data ?? []).map(rowToMovement);
}

/**
 * Imports exercises from the ExerciseDB edge function and bulk-inserts them
 * into the movements table. Returns the count inserted or -1 on error.
 * Requires the user to be signed in (uses auth.uid() as user_id).
 */
export async function importExercisesFromDB(
  bodyParts?: string[]
): Promise<number> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    console.error("[db] importExercisesFromDB: user not signed in");
    return -1;
  }

  // Edge function fetches from ExerciseDB and inserts server-side (bypasses RLS)
  const { data, error } = await supabase.functions.invoke<{
    inserted: number;
    total: number;
  }>("import-exercises", {
    body: { userId, ...(bodyParts ? { bodyParts } : {}) },
  });

  if (error) {
    console.error("[db] importExercisesFromDB failed:", JSON.stringify(error));
    return -1;
  }
  console.log("[db] importExercisesFromDB result:", JSON.stringify(data));
  return data?.inserted ?? 0;
}

export async function listMovements(): Promise<Movement[]> {
  const supabase = createClient();
  // RLS policy (auth.uid() = user_id) filters rows automatically — no explicit filter needed.
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.warn("[db] listMovements failed:", error);
    return [];
  }
  const existing = (data ?? []).map(rowToMovement);
  // Auto-seed on first use
  if (existing.length === 0) {
    return seedDefaultMovements();
  }
  return existing;
}

export async function upsertMovement(m: Movement): Promise<boolean> {
  const supabase = createClient();
  // Validate kind — DB check constraint only allows 'weight' | 'cardio'
  const kind: "weight" | "cardio" = m.kind === "cardio" ? "cardio" : "weight";

  if (m.id && isUUID(m.id)) {
    // Update existing movement by primary key
    const { error } = await supabase
      .from("movements")
      .update({
        name: m.name,
        kind,
        body_part: m.muscle ?? m.bodyPart ?? null,
        equipment_type: m.equipmentType ?? null,
        notes: m.notes ?? null,
      })
      .eq("id", m.id);
    if (error) {
      console.error("[db] upsertMovement (update) failed:", JSON.stringify(error));
      return false;
    }
  } else {
    // Insert new movement — user_id defaults to auth.uid() via DB column default
    const { error } = await supabase.from("movements").insert({
      id: m.id && isUUID(m.id) ? m.id : crypto.randomUUID(),
      name: m.name,
      kind,
      body_part: m.muscle ?? m.bodyPart ?? null,
      equipment_type: m.equipmentType ?? null,
      notes: m.notes ?? null,
    });
    if (error) {
      console.error("[db] upsertMovement (insert) failed:", JSON.stringify(error));
      return false;
    }
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
  // Schema columns: id, user_id, name, kind, unit, notes, created_at
  // Extended columns (added via migration): body_part, equipment_type
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === "cardio" ? "cardio" : undefined,
    muscle: r.body_part ?? undefined,
    bodyPart: r.body_part ?? undefined,
    unit: r.unit ?? undefined,
    notes: r.notes ?? null,
    equipmentType: r.equipment_type ?? undefined,
    canonicalMovement: r.name,
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
