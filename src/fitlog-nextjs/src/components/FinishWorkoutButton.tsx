"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FinishWorkoutButton({
  workoutId,
  entryCount = 0,
}: {
  workoutId: string;
  entryCount?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const finish = () =>
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workouts")
        .update({ finished: true })
        .eq("id", workoutId);
      if (!error) router.refresh();
    });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-line bg-panel shadow-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm text-sub">
          {entryCount > 0
            ? `${entryCount} movement${entryCount !== 1 ? "s" : ""} logged`
            : "Session in progress"}
        </span>

        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-sub">Finish session?</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md border border-line px-3 py-2 text-sm text-sub hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={finish}
              disabled={pending}
              className="rounded-md bg-good px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-md bg-good px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
          >
            Finish workout
          </button>
        )}
      </div>
    </div>
  );
}
