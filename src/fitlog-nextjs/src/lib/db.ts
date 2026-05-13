// Server-side data access helpers. Each function uses RLS-scoped queries — the
// session cookie ensures rows are always filtered to the current user.

import { createClient } from "@/lib/supabase/server";
import type { Movement, Workout, WorkoutEntry } from "@/lib/types";

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function listMovements(): Promise<Movement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getOrCreateTodayWorkout(): Promise<Workout> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing, error: fetchErr } = await supabase
    .from("workouts")
    .select("*")
    .eq("date", today)
    .eq("finished", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("workouts")
    .insert({ date: today, finished: false, notes: null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listEntriesForWorkout(
  workoutId: string
): Promise<WorkoutEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_entries")
    .select("*")
    .eq("workout_id", workoutId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listFinishedWorkouts(limit = 30): Promise<Workout[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("finished", true)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAllEntriesForMovement(
  movementId: string
): Promise<(WorkoutEntry & { workout_date: string })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_entries")
    .select("*, workouts!inner(date, finished)")
    .eq("movement_id", movementId)
    .eq("workouts.finished", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({ ...row, workout_date: row.workouts.date }));
}
