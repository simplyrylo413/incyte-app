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

// ─── Helpers: persist "hidden for today" plan IDs in localStorage ────────────

const todayKey = () => `hiddenPlanIds_${new Date().toISOString().slice(0, 10)}`;

function getHiddenForToday(): Set<string> {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function addHiddenForToday(planId: string) {
  try {
    const ids = getHiddenForToday();
    ids.add(planId);
    localStorage.setItem(todayKey(), JSON.stringify([...ids]));
    // Clean up yesterday's key (optional housekeeping)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    localStorage.removeItem(`hiddenPlanIds_${yesterday}`);
  } catch { /* ignore */ }
}

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

  // Theme — persisted in localStorage; defaults to dark
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("incyte-theme") as "dark" | "light" | null;
    const initial = stored ?? "dark";
    setTheme(initial);
    document.body.classList.toggle("theme-dark", initial === "dark");
    document.body.classList.toggle("theme-light", initial === "light");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("incyte-theme", next);
      document.body.classList.toggle("theme-dark", next === "dark");
      document.body.classList.toggle("theme-light", next === "light");
      return next;
    });
  }

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
      // Only treat an unfinished workout as "active" if it was started today.
      // An unfinished session from a previous day is stale — ignore it so
      // Today always rebuilds from the current day's plan.
      const todayStr = new Date().toISOString().slice(0, 10);
      const candidate = wkts[0] ?? null;
      const isFromToday = !!candidate?.date && candidate.date.slice(0, 10) === todayStr;
      setMovements(mv);
      setPlans(pl);
      setActiveWorkout(isFromToday ? candidate : null);
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
  const hiddenPlanIds = getHiddenForToday();
  const todayPlan = filterTodaysPlan(plans).filter((p) => !hiddenPlanIds.has(p.id));
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
    // Otherwise it's a plan-only item (not yet started) — hide for today.
    // Stored in localStorage keyed by date so it survives refresh but auto-clears tomorrow.
    addHiddenForToday(planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }, [activeWorkout]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleMovementTap(item: TodayItem) {
    const mv = item.mv;
    const planItem = plans.find((p) => p.id === item.planId);
    const lastSet = item.entry?.sets?.[item.entry.sets.length - 1];
    const params = new URLSearchParams();
    params.set("mid", item.mid);
    params.set("planId", item.planId);
    params.set("name", mv?.name ?? "Movement");
    if (mv?.bodyPart || mv?.muscle) params.set("bodypart", String(mv.bodyPart ?? mv.muscle));
    if (lastSet?.weight != null && lastSet.weight !== "") params.set("weight", String(lastSet.weight));
    if (lastSet?.reps != null && lastSet.reps !== "") params.set("reps", String(lastSet.reps));
    if (lastSet?.rpe != null && lastSet.rpe !== "") params.set("rpe", String(lastSet.rpe));
    const setsCount = planItem?.sets ?? item.entry?.sets?.length;
    if (setsCount) params.set("sets", String(setsCount));
    params.set("rest", "90");
    window.location.href = `/workout-alt.html?${params}`;
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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <h1 className={s.headline}>{headline}</h1>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "none",
              border: "1.2px solid rgba(128,120,110,0.35)",
              borderRadius: 6,
              padding: "5px 8px",
              cursor: "pointer",
              color: theme === "dark" ? "rgba(255,255,255,0.45)" : "rgba(40,35,30,0.55)",
              fontSize: 13,
              flexShrink: 0,
              marginTop: 2,
              transition: "color 160ms, border-color 160ms",
              lineHeight: 1,
            }}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
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
        <div style={{ padding: "24px", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>Loading…</div>
      ) : err ? (
        <div style={{ padding: "24px", color: "#b08092", fontSize: 13 }}>{err}</div>
      ) : !hasMovements ? (
        <EmptyState onAdd={() => setAddSheetOpen(true)} />
      ) : (
        <>
          <div style={{ paddingBottom: 8 }}>
            {grouped.length === 0 ? (
              <div style={{ padding: "16px 26px", fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
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
}: {
  stats: ReturnType<typeof calcDayStats>;
  isCompact: boolean;
}) {
  return (
    <div className={s.statsRow}>
      {/* VOLUME */}
      <div className={s.statPanel}>
        <div className={s.panelRivet} data-pos="tl" />
        <div className={s.panelRivet} data-pos="tr" />
        <div className={s.panelRivet} data-pos="bl" />
        <div className={s.panelRivet} data-pos="br" />
        <div className={s.statLabel}><span className={s.ledYellow} />VOLUME</div>
        <div className={s.statValue}>{stats.totalVolume.toLocaleString()}</div>
        <div className={s.statUnit}>LB</div>
      </div>

      {/* AVG RPE */}
      <div className={s.statPanel}>
        <div className={s.panelRivet} data-pos="tl" />
        <div className={s.panelRivet} data-pos="tr" />
        <div className={s.panelRivet} data-pos="bl" />
        <div className={s.panelRivet} data-pos="br" />
        <div className={s.statLabel}><span className={s.ledGreen} />AVG RPE</div>
        <div className={s.statValue}>{stats.avgRpe != null ? stats.avgRpe.toFixed(1) : "—"}</div>
        <div className={s.statUnit}>/ 10</div>
      </div>

      {/* COMPLETE */}
      <div className={s.statPanel}>
        <div className={s.panelRivet} data-pos="tl" />
        <div className={s.panelRivet} data-pos="tr" />
        <div className={s.panelRivet} data-pos="bl" />
        <div className={s.panelRivet} data-pos="br" />
        <div className={s.statLabel}><span className={s.ledRed} />DONE</div>
        <div className={s.statValue}>{stats.completePct}</div>
        <div className={s.statUnit}>%</div>
        <div className={s.miniBar}>
          <div className={s.miniBarFill} style={{ width: `${stats.completePct}%` }} />
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  const hasLoggedSets = (item.entry?.sets ?? []).some((s) => s.done);

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasLoggedSets) {
      setConfirmRemove(true);
    } else {
      onRemove(item.planId);
    }
  }

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

      <div className={s.mvBody} onClick={handleBodyClick}>
        <div className={s.row1}>
          <span className={s.mvName}>{name}</span>
        </div>
      </div>

      <span className={chipClass()}>{chipLabel()}</span>

      {!item.fromHistory && (
        <button
          className={s.removeBtn}
          type="button"
          aria-label="Remove"
          onClick={handleRemoveClick}
        >
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Confirm remove overlay — shown when entry has logged sets */}
      {confirmRemove && (
        <div className={s.removeConfirm} onClick={(e) => e.stopPropagation()}>
          <span className={s.removeConfirmMsg}>Sets logged — remove anyway?</span>
          <button type="button" className={s.removeConfirmCancel}
            onClick={() => setConfirmRemove(false)}>
            Keep
          </button>
          <button type="button" className={s.removeConfirmOk}
            onClick={() => { setConfirmRemove(false); onRemove(item.planId); }}>
            Remove
          </button>
        </div>
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
                    : <span style={{ color: "rgba(255,255,255,0.38)" }}>—</span>
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
