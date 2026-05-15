// Client-side data access against the shared Supabase backend
// (drlmpltseepsxostsqdq) — same project the HTML build at
// src/fitlog-mobile.html uses. All reads/writes here MUST stay
// compatible with the HTML build's schema:
//   - workouts: id, device_id, name, date (iso), finished, entries (jsonb),
//     saved_at, completed_at, edited_at, notes
//   - movements: id, device_id, name, kind, muscle, body_part, unit,
//     equipment_type, variant, canonical_movement, default_sets, ...
//   - plans: id, device_id, mid, dow, sets, reps, rpe, ...
// device_id keying is the build/test convention; auth.uid() takes over in
// Phase 8.
//
// Per pm/nextjs-port-plan.md Phase 0: this is the canonical data layer for
// the Next.js build. Use it from client components ("use client"). Server
// components should hold off until SSR-friendly access patterns are needed
// — for the initial port everything renders client-side from these helpers.

"use client";

import { createClient } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/device";
import type {
  Movement,
  PlanItem,
  Workout,
  WorkoutEntry,
} from "@/lib/types";

// ============================================================================
// MOVEMENTS
// ============================================================================

export async function listMovements(): Promise<Movement[]> {
  const supabase = createClient();
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("device_id", deviceId)
    .order("name", { ascending: true });
  if (error) {
    console.warn("[db] listMovements failed:", error);
    return [];
  }
  return (data ?? []).map(rowToMovement);
}

export async function upsertMovement(m: Movement): Promise<boolean> {
  const supabase = createClient();
  const deviceId = getDeviceId();
  const { error } = await supabase.from("movements").upsert({
    id: m.id,
    device_id: deviceId,
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
  const deviceId = getDeviceId();
  let q = supabase
    .from("workouts")
    .select("*")
    .eq("device_id", deviceId)
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
  const deviceId = getDeviceId();
  const { error } = await supabase.from("workouts").upsert({
    id: w.id,
    device_id: deviceId,
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
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("device_id", deviceId)
    .order("dow", { ascending: true });
  if (error) {
    console.warn("[db] listPlans failed:", error);
    return [];
  }
  return (data ?? []).map(rowToPlan);
}

export async function upsertPlan(p: PlanItem): Promise<boolean> {
  const supabase = createClient();
  const deviceId = getDeviceId();
  const { error } = await supabase.from("plans").upsert({
    id: p.id,
    device_id: deviceId,
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
// Tolerant mapping — Supabase column names use snake_case, app types use
// camelCase. Missing fields default to undefined.

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
