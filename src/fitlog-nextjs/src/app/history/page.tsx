"use client";

// Phase 7 History screen.
// Visual parity target: src/fitlog-mobile.html #view-history.
// Finished workouts grouped by month, collapsible entry detail per row.

import { useCallback, useEffect, useState } from "react";
import { listWorkouts, listMovements } from "@/lib/db";
import type { Workout, WorkoutEntry, Movement } from "@/lib/types";
import s from "./HistoryPage.module.css";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DOWS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Root page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const load = useCallback(async () => {
    try {
      const [wk, mv] = await Promise.all([
        listWorkouts({ finished: true }),
        listMovements(),
      ]);
      setWorkouts(wk);
      setMovements(mv);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));

  // Group workouts by "Month Year"
  const groups = groupByMonth(workouts);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.subline}>Activity</div>
        <h1 className={s.headline}>History</h1>
      </div>

      {loading ? (
        <div className={s.stateMsg}>Loading…</div>
      ) : err ? (
        <div className={s.stateErr}>{err}</div>
      ) : workouts.length === 0 ? (
        <div className={s.emptyWrap}>
          <p className={s.emptyTitle}>No sessions yet.</p>
          <p className={s.emptySub}>Finish a workout to see it here.</p>
        </div>
      ) : (
        groups.map(({ label, items }) => (
          <div key={label} className={s.monthGroup}>
            <div className={s.monthLabel}>{label}</div>
            {items.map((w) => (
              <WorkoutCard key={w.id} workout={w} mvMap={mvMap} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ─── WorkoutCard ──────────────────────────────────────────────────────────────

function WorkoutCard({
  workout,
  mvMap,
}: {
  workout: Workout;
  mvMap: Map<string, Movement>;
}) {
  const [open, setOpen] = useState(false);

  const d = new Date(workout.date ?? workout.savedAt ?? 0);
  const day = d.getDate();
  const dow = DOWS[d.getDay()];

  const entries = workout.entries ?? [];
  const mvCount = entries.length;
  const doneSets = entries.reduce(
    (acc, e) => acc + (e.sets ?? []).filter((s) => s.done).length,
    0
  );
  const name = workout.name || buildWorkoutName(entries, mvMap);
  const durationLabel = workout.durationMin
    ? `${workout.durationMin}m`
    : estimateDuration(entries);

  return (
    <div className={s.workoutCard}>
      <button
        type="button"
        className={s.workoutHead}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className={s.workoutDateBlock}>
          <span className={s.workoutDay}>{day}</span>
          <span className={s.workoutDow}>{dow}</span>
        </div>

        <div className={s.workoutInfo}>
          <div className={s.workoutName}>{name}</div>
          <div className={s.workoutMeta}>
            {mvCount > 0 && (
              <span className={s.metaChip}>{mvCount} mov</span>
            )}
            {doneSets > 0 && (
              <span className={s.metaChip}>{doneSets} sets</span>
            )}
            {durationLabel && (
              <span className={s.metaChip}>{durationLabel}</span>
            )}
          </div>
        </div>

        <span className={`${s.workoutChev} ${open ? s.workoutChevOpen : ""}`}>›</span>
      </button>

      <div className={`${s.workoutDetail} ${open ? s.workoutDetailOpen : ""}`}>
        <div className={s.workoutDetailInner}>
          <div className={s.detailList}>
            {entries.map((entry, i) => (
              <EntryRow key={i} entry={entry} mvMap={mvMap} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  mvMap,
}: {
  entry: WorkoutEntry;
  mvMap: Map<string, Movement>;
}) {
  const mv = mvMap.get(entry.movementId);
  const name = entry.name ?? mv?.name ?? entry.movementId;
  const sets = entry.sets ?? [];
  const done = sets.filter((s) => s.done).length;
  const total = sets.length;
  const allDone = total > 0 && done === total;

  const setLabel = total > 0
    ? `${done}/${total} sets`
    : "No sets";

  return (
    <div className={s.detailEntry}>
      <span className={s.detailEntryName}>{name}</span>
      <span className={`${s.detailEntryMeta} ${allDone ? s.detailEntryDone : ""}`}>
        {setLabel}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByMonth(
  workouts: Workout[]
): Array<{ label: string; items: Workout[] }> {
  const map = new Map<string, Workout[]>();
  for (const w of workouts) {
    const d = new Date(w.date ?? w.savedAt ?? 0);
    const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

function buildWorkoutName(
  entries: WorkoutEntry[],
  mvMap: Map<string, Movement>
): string {
  const parts = entries.slice(0, 3).map((e) => {
    const mv = mvMap.get(e.movementId);
    return mv?.muscle ?? mv?.bodyPart ?? "";
  }).filter(Boolean);

  const unique = [...new Set(parts)];
  if (unique.length === 0) return "Session";
  return unique.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" / ");
}

/** Rough estimate: 3 min/set work+rest */
function estimateDuration(entries: WorkoutEntry[]): string {
  const sets = entries.reduce((s, e) => s + (e.sets ?? []).filter((x) => x.done).length, 0);
  if (!sets) return "";
  const mins = sets * 3;
  return mins >= 60
    ? `~${Math.floor(mins / 60)}h ${mins % 60}m`
    : `~${mins}m`;
}
