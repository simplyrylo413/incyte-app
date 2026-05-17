"use client";

// Phase 7 History screen.
// Visual parity target: src/fitlog-mobile.html #view-history.
// Finished workouts grouped by month, collapsible entry detail per row.
// v2: delete with confirmation dialog + inline set editing.

import { useCallback, useEffect, useRef, useState } from "react";
import { listWorkouts, listMovements, deleteWorkout, upsertWorkout } from "@/lib/db";
import type { Workout, WorkoutEntry, SetEntry, Movement } from "@/lib/types";
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

  // Confirmation dialog state
  const [confirmDelete, setConfirmDelete] = useState<Workout | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  const groups = groupByMonth(workouts);

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    setDeleting(true);
    await deleteWorkout(confirmDelete.id);
    setWorkouts((prev) => prev.filter((w) => w.id !== confirmDelete.id));
    setConfirmDelete(null);
    setDeleting(false);
  }

  function handleSaveEntry(workoutId: string, entryMovementId: string, newSets: SetEntry[]) {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workoutId) return w;
        const updated: Workout = {
          ...w,
          entries: w.entries.map((e) =>
            e.movementId === entryMovementId ? { ...e, sets: newSets } : e
          ),
          edited_at: new Date().toISOString(),
        };
        upsertWorkout(updated); // fire-and-forget — optimistic update already applied
        return updated;
      })
    );
  }

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
              <WorkoutCard
                key={w.id}
                workout={w}
                mvMap={mvMap}
                onDelete={() => setConfirmDelete(w)}
                onSaveEntry={handleSaveEntry}
              />
            ))}
          </div>
        ))
      )}

      {/* ── Delete confirmation dialog ── */}
      {confirmDelete && (
        <div className={s.dialogOverlay} onClick={() => !deleting && setConfirmDelete(null)}>
          <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
            <p className={s.dialogTitle}>Delete session?</p>
            <p className={s.dialogBody}>
              <strong>{confirmDelete.name || "This session"}</strong> and all its logged sets will be permanently removed. This cannot be undone.
            </p>
            <div className={s.dialogActions}>
              <button
                className={s.dialogCancel}
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={s.dialogDelete}
                onClick={handleDeleteConfirmed}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WorkoutCard ──────────────────────────────────────────────────────────────

function WorkoutCard({
  workout,
  mvMap,
  onDelete,
  onSaveEntry,
}: {
  workout: Workout;
  mvMap: Map<string, Movement>;
  onDelete: () => void;
  onSaveEntry: (workoutId: string, movementId: string, sets: SetEntry[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Prefer savedAt (full ISO timestamp) over date (plain date string).
  // Plain date strings parse as UTC midnight, which shifts the local calendar
  // date in non-UTC timezones.
  const d = new Date(workout.savedAt ?? workout.completed_at ?? workout.date ?? 0);
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
      <div className={s.workoutHead}>
        {/* Main tap area — toggle detail */}
        <button
          type="button"
          className={s.workoutHeadBtn}
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
              {mvCount > 0 && <span className={s.metaChip}>{mvCount} mov</span>}
              {doneSets > 0 && <span className={s.metaChip}>{doneSets} sets</span>}
              {durationLabel && <span className={s.metaChip}>{durationLabel}</span>}
            </div>
          </div>

          <span className={`${s.workoutChev} ${open ? s.workoutChevOpen : ""}`}>›</span>
        </button>

        {/* ⋯ actions menu */}
        <div className={s.menuWrap} ref={menuRef}>
          <button
            className={s.menuTrigger}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            aria-label="Session options"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className={s.menuDropdown}>
              <button
                className={s.menuItemDelete}
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >
                Delete session
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`${s.workoutDetail} ${open ? s.workoutDetailOpen : ""}`}>
        <div className={s.workoutDetailInner}>
          <div className={s.detailList}>
            {entries.map((entry, i) => (
              <EntryRow
                key={i}
                entry={entry}
                mvMap={mvMap}
                workoutId={workout.id}
                onSave={onSaveEntry}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EntryRow ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  mvMap,
  workoutId,
  onSave,
}: {
  entry: WorkoutEntry;
  mvMap: Map<string, Movement>;
  workoutId: string;
  onSave: (workoutId: string, movementId: string, sets: SetEntry[]) => void;
}) {
  const mv = mvMap.get(entry.movementId);
  const name = entry.name ?? mv?.name ?? entry.movementId;
  const sets = entry.sets ?? [];
  const done = sets.filter((s) => s.done).length;
  const total = sets.length;
  const allDone = total > 0 && done === total;

  // Edit state — one row open at a time per entry
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draftSets, setDraftSets] = useState<SetEntry[]>(sets);

  // Reset draft when entry changes (e.g. parent re-renders)
  useEffect(() => { setDraftSets(entry.sets ?? []); }, [entry]);

  function patchDraft(idx: number, field: keyof SetEntry, value: string) {
    setDraftSets((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, [field]: value === "" ? null : Number(value) } : s
      )
    );
  }

  function saveRow(idx: number) {
    setEditIdx(null);
    onSave(workoutId, entry.movementId, draftSets);
  }

  return (
    <div className={s.entryBlock}>
      {/* Entry header */}
      <div className={s.entryHeader}>
        <span className={s.detailEntryName}>{name}</span>
        <span className={`${s.detailEntryMeta} ${allDone ? s.detailEntryDone : ""}`}>
          {total > 0 ? `${done}/${total} sets` : "No sets"}
        </span>
      </div>

      {/* Set rows */}
      {draftSets.length > 0 && (
        <div className={s.setList}>
          <div className={s.setColRow}>
            <span className={s.setColNum}>#</span>
            <span className={s.setCol}>Weight</span>
            <span className={s.setCol}>Reps</span>
            <span className={s.setCol}>RPE</span>
            <span className={s.setColAct} />
          </div>
          {draftSets.map((set, idx) => (
            <div key={idx} className={s.setRow}>
              {editIdx === idx ? (
                /* Edit mode */
                <div className={s.setEditRow}>
                  <span className={s.setNumCell}>{idx + 1}</span>
                  <input
                    className={s.setInput}
                    type="number"
                    placeholder="lb"
                    value={set.weight ?? ""}
                    onChange={(e) => patchDraft(idx, "weight", e.target.value)}
                  />
                  <input
                    className={s.setInput}
                    type="number"
                    placeholder="reps"
                    value={set.reps ?? ""}
                    onChange={(e) => patchDraft(idx, "reps", e.target.value)}
                  />
                  <input
                    className={s.setInput}
                    type="number"
                    placeholder="rpe"
                    step="0.5"
                    value={set.rpe ?? ""}
                    onChange={(e) => patchDraft(idx, "rpe", e.target.value)}
                  />
                  <button className={s.setSaveBtn} onClick={() => saveRow(idx)}>Save</button>
                </div>
              ) : (
                /* Read mode */
                <>
                  <span className={s.setNumCell}>{idx + 1}</span>
                  <span className={s.setValCell}>
                    {set.weight != null ? `${set.weight}` : "—"}
                    {set.weight != null && <span className={s.setValUnit}>lb</span>}
                  </span>
                  <span className={s.setValCell}>
                    {set.reps != null ? `${set.reps}` : "—"}
                    {set.reps != null && <span className={s.setValUnit}>reps</span>}
                  </span>
                  <span className={s.setValCell}>
                    {set.rpe != null ? `${set.rpe}` : "—"}
                  </span>
                  <button
                    className={s.setEditBtn}
                    onClick={() => setEditIdx(idx)}
                    aria-label={`Edit set ${idx + 1}`}
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByMonth(
  workouts: Workout[]
): Array<{ label: string; items: Workout[] }> {
  const map = new Map<string, Workout[]>();
  for (const w of workouts) {
    const d = new Date(w.savedAt ?? w.completed_at ?? w.date ?? 0);
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

function estimateDuration(entries: WorkoutEntry[]): string {
  const sets = entries.reduce((s, e) => s + (e.sets ?? []).filter((x) => x.done).length, 0);
  if (!sets) return "";
  const mins = sets * 3;
  return mins >= 60
    ? `~${Math.floor(mins / 60)}h ${mins % 60}m`
    : `~${mins}m`;
}
