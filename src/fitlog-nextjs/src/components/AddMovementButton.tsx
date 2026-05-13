"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Movement } from "@/lib/types";

export default function AddMovementButton({
  movements,
  workoutId,
  nextPosition,
  excludeIds,
}: {
  movements: Movement[];
  workoutId: string;
  nextPosition: number;
  excludeIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const candidates = movements.filter(
    (m) =>
      !excludeIds.includes(m.id) &&
      m.name.toLowerCase().includes(filter.toLowerCase())
  );

  const add = (m: Movement) => {
    startTransition(async () => {
      const supabase = createClient();
      const isCardio = m.kind === "cardio";
      const sets = isCardio
        ? [{ distance: null, time: null, done: false }]
        : [
            { weight: null, reps: null, done: false },
            { weight: null, reps: null, done: false },
            { weight: null, reps: null, done: false },
          ];
      const { error } = await supabase.from("workout_entries").insert({
        workout_id: workoutId,
        movement_id: m.id,
        position: nextPosition,
        training_type: isCardio ? null : "hypertrophy",
        sets,
        planned_reps: null,
      });
      if (!error) {
        setOpen(false);
        setFilter("");
        router.refresh();
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line bg-panel px-3 py-2 text-sm hover:bg-panel2"
      >
        + Add movement
      </button>
    );
  }

  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          placeholder="Search movements"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1"
        />
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-sub hover:text-ink"
        >
          cancel
        </button>
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-sub">
          No matching movements. Add one in Movements.
        </p>
      ) : (
        <ul className="max-h-64 overflow-auto">
          {candidates.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => add(m)}
                disabled={pending}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-panel2"
              >
                <span>{m.name}</span>
                <span className="text-xs text-sub">
                  {m.kind === "cardio" ? `cardio · ${m.unit}` : "weight"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
