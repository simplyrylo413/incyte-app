"use client";

// Phase 3 — Today screen.
// Visual parity target: src/fitlog-mobile.html mobile351 baseline.
// Engine logic ported from renderTodayV2() (~line 13212) via lib/engine/today.ts.
// Workout Mode navigation (tap a row) is a no-op placeholder until Phase 4.

import { useEffect, useRef, useState, useCallback } from "react";
import {
  listMovements,
  listWorkouts,
  listFinishedTodayWorkouts,
  listPlans,
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Raw data from Supabase
  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [finishedToday, setFinishedToday] = useState<Workout[]>([]);

  // UI state
  const [tab, setTab] = useState<"remaining" | "completed">("remaining");

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

  // ── Derived data ──────────────────────────────────────────────────────────
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

  const hasMovements = remaining.length > 0 || completed.length > 0 || finishedToday.length > 0;
  const headline = hasMovements ? todayHeadline() : "Build today's session.";
  const isCompact = stats.doneSets === 0 && stats.totalSets > 0;
  const visibleItems = tab === "completed" ? completed : remaining;
  const grouped = groupByBodyPart(visibleItems);

  // ── Handlers ──────────────────────────────────────────────────────────────
  // Phase 4 will wire these to actual workout mode navigation.
  function handleMovementTap(_item: TodayItem) {
    // TODO Phase 4: openWorkoutMode(item.mid, item.planId)
  }

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
      ) : remaining.length === 0 && completed.length === 0 ? (
        <EmptyState />
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

          {/* Movement list grouped by body part */}
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
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Add movement FAB ── */}
      {!loading && !err && (
        <button className={s.addCta} aria-label="Add movement">
          <span className={s.addCtaPlus}>+</span>
          Add movement
        </button>
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
      {/* Compact ready strip */}
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

      {/* Expanded 3-stat row */}
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
}: {
  item: TodayItem;
  onTap: (item: TodayItem) => void;
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

  // Close popover when clicking outside
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
    // Ripple
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
    // Navigate after ripple settles (Phase 4 wires real navigation)
    setTimeout(() => onTap(item), 180);
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

      {/* Drag handle — remaining items only */}
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

      {/* Body — tap to open Workout Mode */}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    // Phase 4 will write equipmentType back to the active entry
                    setOpenPop(false);
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </span>
        </div>
      </div>

      {/* Progress chip */}
      <span className={chipClass()}>{chipLabel()}</span>

      {/* Remove button */}
      {!item.fromHistory && (
        <button
          className={s.removeBtn}
          type="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            // Phase 4 will wire removal to the active session
          }}
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

function EmptyState() {
  return (
    <div className={s.emptyState}>
      <div className={s.emptyEb}>No movements planned</div>
      <h3 className={s.emptyTitle}>Build today&apos;s session.</h3>
      <p className={s.emptyBody}>Add a movement to get started.</p>
      <button className={s.emptyCta} type="button">+ Add movement</button>
    </div>
  );
}
