"use client";

import { useRouter } from "next/navigation";
import ProgressChart, { type ProgressPoint } from "./ProgressChart";
import type { Movement } from "@/lib/types";

export default function ProgressView({
  movements,
  selectedId,
  points,
  yLabel,
}: {
  movements: Movement[];
  selectedId: string;
  points: ProgressPoint[];
  yLabel: string;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Progress</h1>
          <p className="text-sm text-sub">
            Top-set weight over time (or distance for cardio).
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => router.push(`/progress?mid=${e.target.value}`)}
        >
          {movements.length === 0 ? (
            <option value="">No movements yet</option>
          ) : (
            movements.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))
          )}
        </select>
      </header>
      <div className="rounded-md border border-line bg-panel p-3">
        <ProgressChart data={points} yLabel={yLabel} />
      </div>
    </div>
  );
}
