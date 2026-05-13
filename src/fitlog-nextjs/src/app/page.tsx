import {
  getOrCreateTodayWorkout,
  listEntriesForWorkout,
  listMovements,
} from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import MovementCard from "@/components/MovementCard";
import AddMovementButton from "@/components/AddMovementButton";
import FinishWorkoutButton from "@/components/FinishWorkoutButton";
import type {
  Movement,
  SetEntry,
  WeightSet,
  WorkoutEntry,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type LastForMovement = {
  date: string;
  sets: SetEntry[];
};

async function lastFinishedEntries(
  movementIds: string[]
): Promise<Record<string, LastForMovement>> {
  if (movementIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("workout_entries")
    .select("movement_id, sets, workouts!inner(date, finished)")
    .in("movement_id", movementIds)
    .eq("workouts.finished", true)
    .order("created_at", { ascending: false });

  const out: Record<string, LastForMovement> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (!out[row.movement_id]) {
      out[row.movement_id] = { date: row.workouts.date, sets: row.sets };
    }
  }
  return out;
}

const isWeightSet = (s: SetEntry): s is WeightSet =>
  "weight" in s && "reps" in s;

function topSet(sets: SetEntry[]): { weight: number; reps: number } | null {
  let best: WeightSet | null = null;
  for (const s of sets) {
    if (!isWeightSet(s)) continue;
    if ((s.weight ?? 0) > (best?.weight ?? -1)) best = s;
  }
  return best && best.weight != null && best.reps != null
    ? { weight: best.weight, reps: best.reps }
    : null;
}

export default async function TodayPage() {
  const movements = await listMovements();
  const movementById = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const workout = await getOrCreateTodayWorkout();
  const entries: WorkoutEntry[] = await listEntriesForWorkout(workout.id);
  const lastByMv = await lastFinishedEntries(entries.map((e) => e.movement_id));

  return (
    // pb-24 keeps content clear of the sticky Finish Workout footer
    <div className="space-y-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Today</h1>
          <p className="text-sm text-sub">{workout.date}</p>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-md border border-line bg-panel p-4 text-sm text-sub">
          No movements yet. Add one to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e, i) => {
            const m = movementById.get(e.movement_id);
            if (!m) return null;
            const last = lastByMv[m.id];
            // Auto-expand the most recently added movement card
            const isLast = i === entries.length - 1;
            return (
              <li key={e.id}>
                <MovementCard
                  movement={m}
                  entry={e}
                  defaultExpanded={isLast}
                  lastEntryAt={last?.date ?? null}
                  lastSets={last?.sets ?? null}
                  lastTopSet={last ? topSet(last.sets) : null}
                />
              </li>
            );
          })}
        </ul>
      )}

      <AddMovementButton
        movements={movements}
        workoutId={workout.id}
        nextPosition={entries.length}
        excludeIds={entries.map((e) => e.movement_id)}
      />

      {/* Sticky footer — fixed position, outside normal flow */}
      <FinishWorkoutButton
        workoutId={workout.id}
        entryCount={entries.length}
      />
    </div>
  );
}
