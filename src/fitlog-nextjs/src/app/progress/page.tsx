import { listMovements, listAllEntriesForMovement } from "@/lib/db";
import ProgressView from "@/components/ProgressView";
import type { CardioSet, SetEntry, WeightSet } from "@/lib/types";

export const dynamic = "force-dynamic";

const isWeight = (s: SetEntry): s is WeightSet => "weight" in s && "reps" in s;
const isCardio = (s: SetEntry): s is CardioSet => "distance" in s && "time" in s;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: { mid?: string };
}) {
  const movements = await listMovements();
  const selectedId = searchParams.mid ?? movements[0]?.id ?? "";
  const movement = movements.find((m) => m.id === selectedId);

  const entries = movement ? await listAllEntriesForMovement(movement.id) : [];
  const points = entries.map((e) => {
    if (movement?.kind === "cardio") {
      const cs = e.sets.filter(isCardio);
      return {
        date: e.workout_date,
        value: cs.reduce((a, s) => a + (s.distance ?? 0), 0),
      };
    }
    const ws = e.sets.filter(isWeight);
    const top = ws.reduce(
      (best, s) =>
        (s.weight ?? 0) > (best?.weight ?? -1) ? s : best,
      null as WeightSet | null
    );
    return { date: e.workout_date, value: top?.weight ?? 0 };
  });

  return (
    <ProgressView
      movements={movements}
      selectedId={selectedId}
      points={points}
      yLabel={
        movement?.kind === "cardio"
          ? `Distance (${movement.unit})`
          : "Top set weight"
      }
    />
  );
}
