import { listFinishedWorkouts, listMovements } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import type { Movement, SetEntry, WeightSet, WorkoutEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const isWeight = (s: SetEntry): s is WeightSet => "weight" in s && "reps" in s;

export default async function HistoryPage() {
  const workouts = await listFinishedWorkouts(60);
  const movements = await listMovements();
  const movementById = new Map<string, Movement>(movements.map((m) => [m.id, m]));

  const supabase = createClient();
  const ids = workouts.map((w) => w.id);
  const { data: entriesData } = ids.length
    ? await supabase
        .from("workout_entries")
        .select("*")
        .in("workout_id", ids)
        .order("position", { ascending: true })
    : { data: [] as WorkoutEntry[] };

  const entriesByWorkout = new Map<string, WorkoutEntry[]>();
  for (const e of entriesData ?? []) {
    const arr = entriesByWorkout.get(e.workout_id) ?? [];
    arr.push(e);
    entriesByWorkout.set(e.workout_id, arr);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">History</h1>
        <p className="text-sm text-sub">
          Last 60 finished sessions. Volume is sets × reps × weight.
        </p>
      </header>
      {workouts.length === 0 ? (
        <p className="text-sm text-sub">No finished workouts yet.</p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => {
            const entries = entriesByWorkout.get(w.id) ?? [];
            const volume = entries.reduce((acc, e) => {
              for (const s of e.sets) {
                if (isWeight(s) && s.weight && s.reps) acc += s.weight * s.reps;
              }
              return acc;
            }, 0);
            return (
              <li
                key={w.id}
                className="rounded-md border border-line bg-panel px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{w.date}</span>
                  <span className="text-xs text-sub">
                    {entries.length} movements · vol {volume.toLocaleString()}
                  </span>
                </div>
                <ul className="mt-1 text-xs text-sub">
                  {entries.map((e) => {
                    const m = movementById.get(e.movement_id);
                    return (
                      <li key={e.id}>
                        {m?.name ?? "(deleted movement)"} —{" "}
                        {e.sets.length} {m?.kind === "cardio" ? "intervals" : "sets"}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
