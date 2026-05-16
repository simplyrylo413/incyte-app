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

  const [tab, setTab] = useState<"remaining" | "completed">("remaining");
  const [addSheetOpen, setAddSheetOpen] = useState(false);

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

  // ── Derived ───────────────────────────────────────────────────────────────
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const todayPlan = filterTodaysPlan(plans);
  const activeEntries: WorkoutEntry[] = activeWorkout?.entries ?? [];
  const sessionDoneToday = !activeWorkout && finishedToday.length > 0;

  const stats = calcDayStats(todayPlan, activeEntries, mvMap, finishedToday);
  const { remaining, completed } = buildTodayItems({
    planItems: todayPlan,
    activeEntries,
    finishedToday,
    mvMap,
    sessionDoneToday,
  });

  const hasMovements = remaining.length > 0 || completed.length > 0;
  const headline = hasMovements ? todayHeadline() : "Build today's session.";
  const isCompact = stats.doneSets === 0 && stats.totalSets > 0;
  const visibleItems = tab === "completed" ? completed : remaining;
  const grouped = groupByBodyPart(visibleItems);

  // ── Active session mutation helpers ───────────────────────────────────────

  /** Get or create today's active session. Does NOT persist — caller must upsert. */
  function getOrBuildSession(): Workout {
    if (activeWorkout) return activeWorkout;
    const deviceId = tryGetDeviceId();
    return {
      id: `wk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
    if (!activeWorkout) return;
    const entries = activeWorkout.entries.filter((e) => e.planId !== planId);
    const updated = { ...activeWorkout, entries };
    setActiveWorkout(updated);
    await upsertWorkout(updated);
  }, [activeWorkout]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleMovementTap(item: TodayItem) {
    const params = new URLSearchParams({ mid: item.mid, planId: item.planId });
    if (item.sourceWorkoutId) params.set("src", item.sourceWorkoutId);
    router.push(`/today/workout?${params}`);
  }

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

      {/* ── Content ── */}
      {loading ? (
        <div style={{ padding: "24px", color: "#5e6a82", fontSize: 13 }}>Loading…</div>
      ) : err ? (
        <div style={{ padding: "24px", color: "#b08092", fontSize: 13 }}>{err}</div>
      ) : !hasMovements ? (
        <EmptyState onAdd={() => setAddSheetOpen(true)} />
      ) : (
        <>
          {/* Remaining / Completed toggle */}
          <div className={s.tabToggle}>
            <button
              className={`${s.tabBtn} ${tab === "remaining" ? s.tabBtnActive : ""}`}
              onClick={() => setTab("remaining")}
            >
              Remaining{remaining.length > 0 ? ` · ${remaining.length}` : ""}
            </button>
            <button
              className={`${s.tabBtn} ${tab === "completed" ? s.tabBtnActive : ""}`}
              onClick={() => setTab("completed")}
            >
              Completed{completed.length > 0 ? ` · ${completed.length}` : ""}
            </button>
          </div>

          <div style={{ paddingBottom: 8 }}>
            {grouped.length === 0 ? (
              <div style={{ padding: "16px 26px", fontSize: 13, color: "#8893a8" }}>
                {tab === "completed" ? "Nothing completed yet." : "Nothing remaining."}
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
        <AddMovementSheet
          movements={movements}
          activeMids={activeMids}
          onAdd={handleAddMovement}
          onClose={() => setAddSheetOpen(false)}
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

// ─── Add Movement Sheet ───────────────────────────────────────────────────────

function AddMovementSheet({
  movements,
  activeMids,
  onAdd,
  onClose,
}: {
  movements: Movement[];
  activeMids: Set<string>;
  onAdd: (mv: Movement) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const filtered = movements.filter((mv) => {
    if (activeMids.has(mv.id)) return false;
    if (!query.trim()) return true;
    return mv.name.toLowerCase().includes(query.toLowerCase());
  });

  // Group by body part / muscle when no query
  const grouped: Array<{ label: string; items: Movement[] }> = [];
  if (!query.trim()) {
    const map = new Map<string, Movement[]>();
    for (const mv of filtered) {
      const key = (mv.bodyPart ?? mv.muscle ?? "other").toLowerCase();
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(mv);
    }
    const ORDER = [
      "Chest", "Back", "Shoulders", "Biceps", "Bicepts",
      "Triceps", "Tricepts", "Core", "Quads", "Hamstrings",
      "Glutes", "Calves", "Cardio", "Other",
    ];
    for (const label of ORDER) {
      const items = map.get(label);
      if (items?.length) { map.delete(label); grouped.push({ label, items }); }
    }
    for (const [label, items] of map) grouped.push({ label, items });
  }

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Add movement">
        <div className={s.sheetHandle} />
        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>Add to today</span>
          <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={s.sheetSearch}>
          <input
            ref={inputRef}
            type="search"
            className={s.searchInput}
            placeholder="Search movements…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={s.pickerList}>
          {query.trim() ? (
            filtered.length === 0 ? (
              <div className={s.pickerEmpty}>No movements match.</div>
            ) : (
              filtered.map((mv) => (
                <button
                  key={mv.id}
                  type="button"
                  className={s.pickerItem}
                  onClick={() => onAdd(mv)}
                >
                  <span className={s.pickerName}>{mv.name}</span>
                  {mv.equipmentType && (
                    <span className={s.pickerEquip}>{mv.equipmentType}</span>
                  )}
                </button>
              ))
            )
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                <div className={s.pickerGroupLabel}>{group.label}</div>
                {group.items.map((mv) => (
                  <button
                    key={mv.id}
                    type="button"
                    className={s.pickerItem}
                    onClick={() => onAdd(mv)}
                  >
                    <span className={s.pickerName}>{mv.name}</span>
                    {mv.equipmentType && (
                      <span className={s.pickerEquip}>{mv.equipmentType}</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
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
