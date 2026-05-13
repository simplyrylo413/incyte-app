import { listMovements } from "@/lib/db";
import MovementsManager from "@/components/MovementsManager";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const movements = await listMovements();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Movements</h1>
        <p className="text-sm text-sub">
          Your library of lifts and cardio. Cardio uses distance + time; lifts
          use weight + reps.
        </p>
      </header>
      <MovementsManager initial={movements} />
    </div>
  );
}
