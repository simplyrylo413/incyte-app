"use client";

// Phase 3 Today screen + Phase 4 navigation wiring.
// Today-gaps wired in Phase 6 follow-up:
//   - Add movement FAB / EmptyState CTA → AddMovementSheet → upsertWorkout
//   - Equipment popover write-back → updateActiveEntry
//   - Remove button → removeActiveEntry
// Tap a movement row → /today/workout?mid=xxx&planId=yyy
// Visual parity target: src/fitlog-mobile.html mobile351 baseline.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  listMovements,
  listWorkouts,
  listFinishedTodayWorkouts,
  listPlans,
  upsertWorkout,
} from "@/lib/db";
import { tryGetDeviceId } from "@/lib/device";
import type { Movement, Workout, WorkoutEntry, PlanItem } from "@/lib/types";
import { getDailyHeadline } from "@/lib/engine/aiHeadline";
import MovementPickerSheet from "@/components/MovementPickerSheet/MovementPickerSheet";
import {
  todayHeadline,
  todayDateLabel,
  filterTodaysPlan,
  filterFinishedToday,
  calcDayStats,
  buildTodayItems,
  groupByBodyPart,
  itemProgress,
  EQUIPMENT_OPTIONS,
  type TodayItem,
} from "@/lib/engine/today";
import s from "./TodayPage.module.css";

// ─── Root page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [finishedToday, setFinishedToday] = useState<Workout[]>([]);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<{ entry: WorkoutEntry; workout: Workout } | null>(null);
  const [aiHeadline, setAiHeadline] = useState<string | null>(null);

  // Fetch AI headline once per day (cached in localStorage)
  useEffect(() => {
    getDailyHeadline(todayHeadline()).then(setAiHeadline);
  }, []);

  const load = useCallback(async () => {
    try {
      const [mv, pl, wkts, ft] = await Promise.all([
        listMovements(),
        listPlans(),
        listWorkouts({ finished: false, limit: 1 }),
        listFinishedTodayWorkouts(),
      ]);
      setMovements(mv);
      setPlans(pl);
      setActiveWorkout(wkts[0] ?? null);
      setFinishedToday(filterFinishedToday(ft));
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when the tab/window regains focus (covers browser back-button return)
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const todayPlan = filterTodaysPlan(plans);
  const activeEntries: WorkoutEntry[] = activeWorkout?.entries ?? [];
  const sessionDoneToday = !activeWorkout && finishedToday.length > 0;

  // Flat list of all completed entries from today's finished workouts
  const completedEntries: Array<{ entry: WorkoutEntry; workout: Workout }> = [];
  for (const wk of finishedToday) {
    for (const e of wk.entries ?? []) {
      completedEntries.push({ entry: e, workout: wk });
    }
  }

  const stats = calcDayStats(todayPlan, activeEntries, mvMap, finishedToday);
  const { remaining, completed } = buildTodayItems({
    planItems: todayPlan,
    activeEntries,
    finishedToday,
    mvMap,
    sessionDoneToday,
  });

  // Completed movements live only in the logged strip — exclude them from the list
  const completedMids = new Set(completedEntries.map((c) => c.entry.movementId));
  const remainingFiltered = remaining.filter((item) => !completedMids.has(item.mid));

  const hasMovements = remainingFiltered.length > 0 || completedEntries.length > 0;
  // AI headline updates once per day; falls back to static pool until loaded
  const headline = hasMovements
    ? (aiHeadline ?? todayHeadline())
    : "Build today's session.";
  const isCompact = stats.doneSets === 0 && stats.totalSets > 0;
  const grouped = groupByBodyPart(remainingFiltered);

  // ── Active session mutation helpers ───────────────────────────────────────

  /** Get or create today's active session. Does NOT persist — caller must upsert. */
  function getOrBuildSession(): Workout {
    if (activeWorkout) return activeWorkout;
    const deviceId = tryGetDeviceId();
    return {
      id: crypto.randomUUID(),
      device_id: deviceId ?? undefined,
      date: new Date().toISOString(),
      finished: false,
      entries: [],
    };
  }

  const handleAddMovement = useCallback(async (mv: Movement) => {
    const session = getOrBuildSession();
    const planId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const defaultSetCount = mv.defaultSets ?? 3;
    const newEntry: WorkoutEntry = {
      movementId: mv.id,
      planId,
      name: mv.name,
      muscle: mv.muscle ?? mv.bodyPart ?? "",
      equipmentType: mv.equipmentType ?? "unspecified",
      canonicalMovement: mv.canonicalMovement ?? mv.name,
      sets: Array.from({ length: defaultSetCount }, () => ({ done: false })),
    };
    const updated: Workout = { ...session, entries: [...session.entries, newEntry] };
    setActiveWorkout(updated);
    setAddSheetOpen(false);
    await upsertWorkout(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkout]);

  const handleEquipChange = useCallback(async (planId: string, equip: string) => {
    if (!activeWorkout) return;
    const entries = activeWorkout.entries.map((e) =>
      e.planId === planId ? { ...e, equipmentType: equip } : e
    );
    const updated = { ...activeWorkout, entries };
    setActiveWorkout(updated);
    await upsertWorkout(updated);
  }, [activeWorkout]);

  const handleRemoveEntry = useCallback(async (planId: string) => {
    // If the active workout has an entry for this planId, remove it there
    if (activeWorkout) {
      const hasEntry = activeWorkout.entries.some((e) => e.planId === planId);
      if (hasEntry) {
        const entries = activeWorkout.entries.filter((e) => e.planId !== planId);
        const updated = { ...activeWorkout, entries };
        setActiveWorkout(updated);
        await upsertWorkout(updated);
        return;
      }
    }
    // Otherwise it's a plan-only item (not yet started) — hide from today's view locally.
    // Not persisted to DB so it returns tomorrow as expected.
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }, [activeWorkout]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleMovementTap(item: TodayItem) {
    const params = new URLSearchParams({ mid: item.mid, planId: item.planId });
    if (item.sourceWorkoutId) params.set("src", item.sourceWorkoutId);
    router.push(`/today/workout?${params}`);
  }

  // Save edited sets back to Supabase
  const handleSaveEditedSets = useCallback(async (
    workout: Workout,
    entryMovementId: string,
    newSets: WorkoutEntry["sets"]
  ) => {
    const updatedEntries = workout.entries.map((e) =>
      e.movementId === entryMovementId ? { ...e, sets: newSets } : e
    );
    const updated: Workout = { ...workout, entries: updatedEntries };
    setFinishedToday((prev) =>
      prev.map((w) => w.id === workout.id ? updated : w)
    );
    if (detailEntry?.workout.id === workout.id) {
      const updatedEntry = updated.entries.find((e) => e.movementId === entryMovementId);
      if (updatedEntry) setDetailEntry({ entry: updatedEntry, workout: updated });
    }
    await upsertWorkout(updated);
  }, [detailEntry]);

  // IDs already in active session — filter these out of the add sheet
  const activeMids = new Set(activeEntries.map((e) => e.movementId));

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.head}>
        <h1 className={s.headline}>{headline}</h1>
        <div className={s.dateLine}>{todayDateLabel()}</div>
      </div>

      {/* ── Session-stats glass panel ── */}
      <SessionStats stats={stats} isCompact={isCompact} />

      {/* ── Logged strip — only when movements have been completed today ── */}
      {completedEntries.length > 0 && (
        <LoggedStrip
          entries={completedEntries}
          onChipTap={(item) => setDetailEntry(item)}
        />
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ padding: "24px", color: "#5e6a82", fontSize: 13 }}>Loading…</div>
      ) : err ? (
        <div style={{ padding: "24px", color: "#b08092", fontSize: 13 }}>{err}</div>
      ) : !hasMovements ? (
        <EmptyState onAdd={() => setAddSheetOpen(true)} />
      ) : (
        <>
          <div style={{ paddingBottom: 8 }}>
            {grouped.length === 0 ? (
              <div style={{ padding: "16px 26px", fontSize: 13, color: "#8893a8" }}>
                {completedEntries.length > 0 ? "All movements done for today." : "Nothing remaining."}
              </div>
            ) : (
              grouped.map(([bp, items]) => (
                <div key={bp}>
                  <div className={s.eyebrow}>{bp.toUpperCase()}</div>
                  {items.map((item) => (
                    <MovementRow
                      key={item.planId}
                      item={item}
                      onTap={handleMovementTap}
                      onEquipChange={handleEquipChange}
                      onRemove={handleRemoveEntry}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Add movement FAB — only visible when movements already exist ── */}
      {!loading && !err && hasMovements && (
        <button
          className={s.addCta}
          aria-label="Add movement"
          onClick={() => setAddSheetOpen(true)}
        >
          <span className={s.addCtaPlus}>+</span>
          Add movement
        </button>
      )}

      {/* ── Add Movement Sheet ── */}
      {addSheetOpen && (
        <MovementPickerSheet
          title="Add to today"
          movements={movements}
          excludeMids={activeMids}
          onAdd={(mv) => { handleAddMovement(mv); setAddSheetOpen(false); }}
          onClose={() => setAddSheetOpen(false)}
          onFavoriteToggled={(id, next) =>
            setMovements((prev) => prev.map((m) => m.id === id ? { ...m, favorite: next } : m))
          }
        />
      )}

      {/* ── Logged Detail Sheet ── */}
      {detailEntry && (
        <LoggedDetailSheet
          entry={detailEntry.entry}
          workout={detailEntry.workout}
          onClose={() => setDetailEntry(null)}
          onSave={handleSaveEditedSets}
        />
      )}
    </div>
  );
}

// ─── SessionStats panel ───────────────────────────────────────────────────────

function SessionStats({
  stats,
  isCompact,
}: {
  stats: ReturnType<typeof calcDayStats>;
  isCompact: boolean;
}) {
  const parts = Object.entries(stats.volumeByPart);

  return (
    <div className={`${s.progress} ${isCompact ? s.progressCompact : ""}`}>
      <div className={s.readyStrip}>
        <div className={s.planned}>
          <span className={s.plannedNum}>{stats.totalSets}</span>
          <span className={s.plannedUnit}>Sets</span>
          <span className={s.plannedSep}>·</span>
          <span className={s.plannedNum}>{stats.planMinutes}</span>
          <span className={s.plannedUnit}>Min est.</span>
        </div>
        <span className={s.readyLabel}>Ready</span>
      </div>

      <div className={s.statsRow}>
        <div className={s.stat}>
          <div className={s.statLabel}>Volume</div>
          <div className={s.statValue}>
            {stats.totalVolume.toLocaleString()}
            <span className={s.statUnit}>lb</span>
          </div>
          {parts.length > 0 && (
            <div className={s.volParts}>
              {parts.map(([k, v]) => (
                <span key={k}>
                  <em>{k}</em>
                  {v.toLocaleString()}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={s.stat}>
          <div className={s.statLabel}>Avg RPE</div>
          <div className={s.statValue}>
            {stats.avgRpe != null ? stats.avgRpe.toFixed(1) : "—"}
          </div>
        </div>

        <div className={s.stat}>
          <div className={s.statLabel}>Complete</div>
          <div className={s.statValue}>
            {stats.completePct}
            <span className={s.statUnit}>%</span>
          </div>
          <div className={s.miniBar}>
            <div className={s.miniBarFill} style={{ width: `${stats.completePct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MovementRow ──────────────────────────────────────────────────────────────

function MovementRow({
  item,
  onTap,
  onEquipChange,
  onRemove,
}: {
  item: TodayItem;
  onTap: (item: TodayItem) => void;
  onEquipChange: (planId: string, equip: string) => void;
  onRemove: (planId: string) => void;
}) {
  const { done, total } = itemProgress(item);
  const isComplete = total > 0 && done === total;
  const isSkipped = !!item.skipped;
  const name = item.mv?.name ?? item.entry?.name ?? "—";
  const equip = (
    item.entry?.equipmentType ??
    item.mv?.equipmentType ??
    "unspecified"
  ).toLowerCase();

  const [openPop, setOpenPop] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!openPop) return;
    function close(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setOpenPop(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openPop]);

  function handleBodyClick(e: React.MouseEvent<HTMLDivElement>) {
    const layer = rippleRef.current;
    if (layer && cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = s.rippleMark;
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      layer.appendChild(dot);
      setTimeout(() => dot.remove(), 540);
    }
    setTimeout(() => onTap(item), 180);
  }

  function handleEquipTap(e: React.MouseEvent, opt: string) {
    e.stopPropagation();
    setOpenPop(false);
    if (opt !== equip) {
      onEquipChange(item.planId, opt);
    }
  }

  function chipClass() {
    if (isComplete) return `${s.progressChip} ${s.progressChipDone}`;
    if (isSkipped) return `${s.progressChip} ${s.progressChipSkipped}`;
    if (done > 0 && done < total) return `${s.progressChip} ${s.progressChipPartial}`;
    return s.progressChip;
  }

  function chipLabel() {
    if (isComplete) return "DONE";
    if (isSkipped) return "SKIP";
    return `${done}/${total || "?"}`;
  }

  return (
    <div
      ref={cardRef}
      className={`${s.mv} ${isComplete ? s.mvComplete : ""}`}
      style={{ zIndex: openPop ? 50 : undefined }}
    >
      <span ref={rippleRef} className={s.rippleLayer} aria-hidden="true" />

      {!item.fromHistory && (
        <span className={s.dragHandle} aria-hidden="true">
          <svg viewBox="0 0 10 14" fill="none">
            <circle cx="2" cy="2"  r="1.2" fill="currentColor" />
            <circle cx="8" cy="2"  r="1.2" fill="currentColor" />
            <circle cx="2" cy="7"  r="1.2" fill="currentColor" />
            <circle cx="8" cy="7"  r="1.2" fill="currentColor" />
            <circle cx="2" cy="12" r="1.2" fill="currentColor" />
            <circle cx="8" cy="12" r="1.2" fill="currentColor" />
          </svg>
        </span>
      )}

      <div className={s.mvBody} onClick={handleBodyClick}>
        <div className={s.row1}>
          <span className={s.mvName}>{name}</span>
          <span className={s.equipWrap}>
            <button
              className={s.equip}
              onClick={(e) => { e.stopPropagation(); setOpenPop((v) => !v); }}
              aria-label={`Equipment: ${equip}`}
              type="button"
            >
              {equip.toUpperCase()}
            </button>
            <div className={`${s.equipPop} ${openPop ? s.equipPopOpen : ""}`}>
              {EQUIPMENT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  className={`${s.equipChip} ${opt === equip ? s.equipChipActive : ""}`}
                  type="button"
                  onClick={(e) => handleEquipTap(e, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </span>
        </div>
      </div>

      <span className={chipClass()}>{chipLabel()}</span>

      {!item.fromHistory && (
        <button
          className={s.removeBtn}
          type="button"
          aria-label="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove(item.planId); }}
        >
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className={s.emptyState}>
      <div className={s.emptyEb}>No movements planned</div>
      <h3 className={s.emptyTitle}>Build today&apos;s session.</h3>
      <p className={s.emptyBody}>Add a movement to get started.</p>
      <button className={s.emptyCta} type="button" onClick={onAdd}>
        + Add movement
      </button>
    </div>
  );
}

// ─── Logged Strip ─────────────────────────────────────────────────────────────

function LoggedStrip({
  entries,
  onChipTap,
}: {
  entries: Array<{ entry: WorkoutEntry; workout: Workout }>;
  onChipTap: (item: { entry: WorkoutEntry; workout: Workout }) => void;
}) {
  return (
    <div className={s.loggedStrip}>
      <span className={s.loggedEyebrow}>Done</span>
      <span className={s.loggedCount}>{entries.length}</span>
      <div className={s.loggedChipRail}>
        {entries.map((item, i) => (
          <button
            key={`${item.workout.id}-${item.entry.movementId}-${i}`}
            type="button"
            className={s.loggedChip}
            onClick={() => onChipTap(item)}
          >
            <span className={s.loggedChipCheck}>✓</span>
            {item.entry.name ?? item.entry.movementId}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Logged Detail Sheet ──────────────────────────────────────────────────────

type EditingSet = {
  idx: number;
  weight: string;
  reps: string;
  rpe: string;
};

function LoggedDetailSheet({
  entry,
  workout,
  onClose,
  onSave,
}: {
  entry: WorkoutEntry;
  workout: Workout;
  onClose: () => void;
  onSave: (workout: Workout, entryMovementId: string, sets: WorkoutEntry["sets"]) => Promise<void>;
}) {
  const sets = entry.sets ?? [];
  const doneSets = sets.filter((s) => s.done);
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [saving, setSaving] = useState(false);

  function rpeClass(rpe: number | null | undefined) {
    if (rpe == null) return "";
    if (rpe <= 7) return s.rpeOk;
    if (rpe <= 8) return s.rpeMed;
    return s.rpeHard;
  }

  function startEdit(idx: number) {
    const set = sets[idx];
    setEditingSet({
      idx,
      weight: set.weight != null ? String(set.weight) : "",
      reps:   set.reps   != null ? String(set.reps)   : "",
      rpe:    set.rpe    != null ? String(set.rpe)     : "",
    });
  }

  async function commitEdit() {
    if (!editingSet) return;
    setSaving(true);
    const newSets = sets.map((set, i) => {
      if (i !== editingSet.idx) return set;
      return {
        ...set,
        weight: editingSet.weight !== "" ? Number(editingSet.weight) : null,
        reps:   editingSet.reps   !== "" ? Number(editingSet.reps)   : null,
        rpe:    editingSet.rpe    !== "" ? Number(editingSet.rpe)     : null,
      };
    });
    await onSave(workout, entry.movementId, newSets);
    setEditingSet(null);
    setSaving(false);
  }

  const displaySets = doneSets.length > 0 ? doneSets : sets;

  return (
    <>
      <div className={s.detailOverlay} onClick={onClose} aria-hidden="true" />
      <div className={s.detailSheet} role="dialog" aria-modal="true">
        <div className={s.detailHandle} />

        <div className={s.detailHead}>
          <div className={s.detailTitleWrap}>
            <div className={s.detailTitle}>{entry.name ?? entry.movementId}</div>
            <div className={s.detailMeta}>
              {entry.equipmentType && (
                <span className={s.detailEquip}>{entry.equipmentType}</span>
              )}
              <span>{displaySets.length} sets logged</span>
            </div>
          </div>
          <button type="button" className={s.detailClose} onClick={onClose}>
            Done
          </button>
        </div>

        <div className={s.detailBody}>
          {/* Column headers */}
          <div className={s.setTableColHeaders}>
            <span className={s.setColHead}>#</span>
            <span className={s.setColHead}>Weight</span>
            <span className={s.setColHead}>Reps</span>
            <span className={s.setColHead}>RPE</span>
            <span className={s.setColHead}></span>
          </div>

          {/* Set rows */}
          {sets.map((set, i) => {
            if (!set.done) return null;
            const isEditing = editingSet?.idx === i;

            if (isEditing) {
              return (
                <div key={i} className={s.setEditRow}>
                  <span className={s.setNumCell}>S{i + 1}</span>
                  <div className={s.setEditInputs}>
                    <div className={s.setInputGroup}>
                      <span className={s.setInputLabel}>lb</span>
                      <input
                        className={s.setInput}
                        type="number"
                        inputMode="decimal"
                        value={editingSet.weight}
                        onChange={(e) => setEditingSet((v) => v ? { ...v, weight: e.target.value } : v)}
                      />
                    </div>
                    <div className={s.setInputGroup}>
                      <span className={s.setInputLabel}>reps</span>
                      <input
                        className={s.setInput}
                        type="number"
                        inputMode="numeric"
                        value={editingSet.reps}
                        onChange={(e) => setEditingSet((v) => v ? { ...v, reps: e.target.value } : v)}
                      />
                    </div>
                    <div className={s.setInputGroup}>
                      <span className={s.setInputLabel}>RPE</span>
                      <input
                        className={s.setInput}
                        type="number"
                        inputMode="decimal"
                        min="1" max="10" step="0.5"
                        value={editingSet.rpe}
                        onChange={(e) => setEditingSet((v) => v ? { ...v, rpe: e.target.value } : v)}
                      />
                    </div>
                  </div>
                  <div className={s.setEditActions}>
                    <button
                      type="button"
                      className={s.setSaveBtn}
                      onClick={commitEdit}
                      disabled={saving}
                    >
                      {saving ? "…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className={s.setCancelBtn}
                      onClick={() => setEditingSet(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className={s.setDataRow}>
                <span className={s.setNumCell}>
                  {set.warmup ? <span className={s.setWarmupBadge}>W</span> : `S${i + 1}`}
                </span>
                <span className={s.setValCell}>
                  {set.weight != null ? <>{set.weight}<span className={s.setValUnit}> lb</span></> : "—"}
                </span>
                <span className={s.setValCell}>
                  {set.reps != null ? <>{set.reps}<span className={s.setValUnit}> reps</span></> : "—"}
                </span>
                <span className={s.setValCell}>
                  {set.rpe != null
                    ? <span className={`${s.setRpeChip} ${rpeClass(Number(set.rpe))}`}>@{set.rpe}</span>
                    : <span style={{ color: "#8893a8" }}>—</span>
                  }
                </span>
                <div className={s.setActionsCell}>
                  <button
                    type="button"
                    className={s.setEditBtn}
                    onClick={() => startEdit(i)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
