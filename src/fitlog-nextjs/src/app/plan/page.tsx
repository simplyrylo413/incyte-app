"use client";

// Plan — v3 (Option 1 + 3 hybrid, no gamification)
// - Recent performance card: PRs + weight gains across all movements
// - Ring week strip (Option 1): SVG progress rings per day
// - Muscle balance bars (Option 3): push/pull/legs/core frequency
// - Single-day view: tap a ring to see that day, movements have left
//   accent stripe + PR/↑ badge from workout history
// - Data-sync: visibilitychange reloads on return from movements page

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listMovements, listPlans, listWorkouts, upsertPlan, deletePlan } from "@/lib/db";
import type { Movement, PlanItem, Workout } from "@/lib/types";
import {
  buildDowStats, calcEtaMins, fmtEta, planItemSets,
  DOW_NAMES, DOW_LETTERS, type DowStats,
} from "@/lib/engine/plan";
import s from "./PlanPage.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddSheet  = { dow: number } | null;
type EditSheet = { plan: PlanItem; mv: Movement } | null;

type ProgBadge =
  | { kind: "pr"; weight: number }
  | { kind: "up"; lbs: number }
  | null;

type WinItem = {
  mid: string;
  name: string;
  kind: "pr" | "up";
  detail: string;
  badge: string;
};

// ─── Per-movement history ─────────────────────────────────────────────────────

type MvHistory = {
  sessions: Array<{ topWeight: number; date: Date }>;
};

function buildMvHistory(workouts: Workout[]): Map<string, MvHistory> {
  const map = new Map<string, MvHistory>();
  for (const w of workouts) {
    if (!w.finished) continue;
    const wDate = new Date(w.date || w.savedAt || 0);
    for (const e of w.entries) {
      if (!e.movementId) continue;
      const done    = (e.sets ?? []).filter((s) => s.done && !s.warmup);
      const weights = done.map((s) => Number(s.weight) || 0).filter((n) => n > 0);
      if (!weights.length) continue;
      const top = Math.max(...weights);
      if (!map.has(e.movementId)) map.set(e.movementId, { sessions: [] });
      map.get(e.movementId)!.sessions.push({ topWeight: top, date: wDate });
    }
  }
  // Sort sessions newest-first per movement
  for (const h of map.values()) {
    h.sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  return map;
}

function deriveProgBadge(mid: string, history: Map<string, MvHistory>): ProgBadge {
  const h = history.get(mid);
  if (!h || h.sessions.length < 2) return null;
  const allTime = Math.max(...h.sessions.map((s) => s.topWeight));
  const latest  = h.sessions[0].topWeight;
  const prev    = h.sessions[1].topWeight;
  if (latest >= allTime && latest > prev) return { kind: "pr", weight: latest };
  if (latest > prev) return { kind: "up", lbs: latest - prev };
  return null;
}

/** Recent PRs and gains across all movements — up to 3 items. */
function buildRecentWins(
  plans: PlanItem[],
  movements: Movement[],
  history: Map<string, MvHistory>,
): WinItem[] {
  const mvMap = new Map(movements.map((m) => [m.id, m]));
  // Only show wins for movements that appear anywhere in the plan
  const plannedMids = new Set(plans.map((p) => p.mid));
  const wins: WinItem[] = [];

  for (const [mid, h] of history) {
    if (!plannedMids.has(mid)) continue;
    const mv = mvMap.get(mid);
    if (!mv || h.sessions.length < 2) continue;
    const badge = deriveProgBadge(mid, history);
    if (!badge) continue;
    wins.push({
      mid,
      name: mv.name,
      kind: badge.kind,
      detail: badge.kind === "pr"
        ? `${badge.weight} lbs · all-time best`
        : `Up ${badge.lbs} lbs from last session`,
      badge: badge.kind === "pr" ? "★ PR" : `↑ +${badge.lbs} lbs`,
    });
  }

  // PRs first, then gains; cap at 3
  wins.sort((a, b) => (a.kind === "pr" ? -1 : 1) - (b.kind === "pr" ? -1 : 1));
  return wins.slice(0, 3);
}

/** Weekly muscle frequency — counts distinct days each muscle group is hit. */
function buildMuscleBalance(
  plans: PlanItem[],
  movements: Movement[],
): Array<{ label: string; count: number; pct: number }> {
  const mvMap = new Map(movements.map((m) => [m.id, m]));
  const groups: Record<string, Set<number>> = {
    Push: new Set(), Pull: new Set(), Legs: new Set(), Core: new Set(),
  };
  const PUSH = new Set(["chest","shoulders","triceps","tricepts"]);
  const PULL = new Set(["back","biceps","bicepts"]);
  const LEGS = new Set(["quads","hamstrings","glutes","calves"]);
  const CORE = new Set(["core","waist"]);

  for (const p of plans) {
    const mv = mvMap.get(p.mid);
    if (!mv) continue;
    const key = (mv.muscle ?? mv.bodyPart ?? "").toLowerCase();
    if (PUSH.has(key)) groups.Push.add(p.dow);
    else if (PULL.has(key)) groups.Pull.add(p.dow);
    else if (LEGS.has(key)) groups.Legs.add(p.dow);
    else if (CORE.has(key)) groups.Core.add(p.dow);
  }

  const max = Math.max(1, ...Object.values(groups).map((s) => s.size));
  return Object.entries(groups).map(([label, days]) => ({
    label,
    count: days.size,
    pct: Math.round((days.size / max) * 100),
  }));
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans,     setPlans]     = useState<PlanItem[]>([]);
  const [workouts,  setWorkouts]  = useState<Workout[]>([]);
  const [selDow,    setSelDow]    = useState(() => new Date().getDay());
  const [addSheet,  setAddSheet]  = useState<AddSheet>(null);
  const [editSheet, setEditSheet] = useState<EditSheet>(null);

  const load = useCallback(async () => {
    try {
      const [mv, pl, wk] = await Promise.all([
        listMovements(), listPlans(), listWorkouts({ finished: true }),
      ]);
      setMovements(mv);
      setPlans(pl);
      setWorkouts(wk as Workout[]);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch whenever user navigates back (e.g. from movements page)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddMovement = useCallback(async (mv: Movement, dow: number) => {
    const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newPlan: PlanItem = {
      id, mid: mv.id, dow, sets: 3, reps: "", rpe: "", notes: "",
      order: plans.filter((p) => p.dow === dow).length,
    };
    setPlans((prev) => [...prev, newPlan]);
    setAddSheet(null);
    await upsertPlan(newPlan);
  }, [plans]);

  const handleSavePlan = useCallback(async (updated: PlanItem) => {
    setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditSheet(null);
    await upsertPlan(updated);
  }, []);

  const handleRemovePlan = useCallback(async (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setEditSheet(null);
    await deletePlan(id);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const dowStats     = useMemo(() => buildDowStats(plans, movements, workouts), [plans, movements, workouts]);
  const mvHistory    = useMemo(() => buildMvHistory(workouts), [workouts]);
  const recentWins   = useMemo(() => buildRecentWins(plans, movements, mvHistory), [plans, movements, mvHistory]);
  const muscleBalance = useMemo(() => buildMuscleBalance(plans, movements), [plans, movements]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.headText}>
          <div className={s.subline}>Weekly</div>
          <h1 className={s.headline}>Plan</h1>
        </div>
      </div>

      {loading ? (
        <div className={s.stateMsg}>Loading…</div>
      ) : err ? (
        <div className={s.stateErr}>{err}</div>
      ) : (
        <>
          {/* Recent performance wins */}
          {recentWins.length > 0 && (
            <RecentWins wins={recentWins} />
          )}

          {/* Ring week strip */}
          <RingWeekStrip stats={dowStats} selDow={selDow} onSelect={setSelDow} />

          {/* Muscle balance */}
          <MuscleBalance rows={muscleBalance} />

          {/* Single-day view */}
          <DayView
            dow={selDow}
            stats={dowStats[selDow]}
            plans={plans}
            movements={movements}
            mvHistory={mvHistory}
            onAdd={() => setAddSheet({ dow: selDow })}
            onEdit={(plan, mv) => setEditSheet({ plan, mv })}
          />
        </>
      )}

      {addSheet && (
        <AddMovementSheet
          dow={addSheet.dow}
          movements={movements}
          plans={plans}
          onAdd={handleAddMovement}
          onClose={() => setAddSheet(null)}
        />
      )}

      {editSheet && (
        <EditPlanSheet
          plan={editSheet.plan}
          mv={editSheet.mv}
          onSave={handleSavePlan}
          onRemove={handleRemovePlan}
          onClose={() => setEditSheet(null)}
        />
      )}
    </div>
  );
}

// ─── Recent wins card ─────────────────────────────────────────────────────────

function RecentWins({ wins }: { wins: WinItem[] }) {
  return (
    <div className={s.winsCard}>
      <div className={s.winsHead}>Recent performance</div>
      {wins.map((w) => (
        <div key={w.mid} className={s.winRow}>
          <span className={s.winIcon}>{w.kind === "pr" ? "🏆" : "📈"}</span>
          <div className={s.winBody}>
            <div className={s.winName}>{w.name}</div>
            <div className={s.winSub}>{w.detail}</div>
          </div>
          {w.kind === "pr"
            ? <span className={s.winBadgePr}>{w.badge}</span>
            : <span className={s.winBadgeUp}>{w.badge}</span>
          }
        </div>
      ))}
    </div>
  );
}

// ─── Ring week strip ──────────────────────────────────────────────────────────

function RingWeekStrip({
  stats, selDow, onSelect,
}: {
  stats: DowStats[];
  selDow: number;
  onSelect: (dow: number) => void;
}) {
  return (
    <div className={s.ringStrip}>
      {stats.map((st) => {
        const isSelected = selDow === st.dow;
        // Progress fraction for the ring (done / total planned)
        const frac = st.mvCount > 0 ? st.doneCount / st.mvCount : 0;
        const circ = 100.53; // 2π × 16
        const offset = circ * (1 - frac);

        const cls = [
          s.ringDay,
          isSelected  ? s.ringDayActive   : "",
          st.allDone  ? s.ringDayDone     : "",
          st.partial  ? s.ringDayPartial  : "",
          st.isToday  ? s.ringDayToday    : "",
          st.isRest   ? s.ringDayRest     : "",
        ].filter(Boolean).join(" ");

        return (
          <button key={st.dow} type="button" className={cls}
            onClick={() => onSelect(st.dow)} aria-pressed={isSelected}>
            <div className={s.ringWrap}>
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                {/* Track */}
                {st.isRest
                  ? <circle cx="20" cy="20" r="16"
                      stroke="currentColor" strokeOpacity="0.15"
                      strokeWidth="2" strokeDasharray="5 4" />
                  : <circle cx="20" cy="20" r="16"
                      stroke="currentColor" strokeOpacity="0.14" strokeWidth="2.5" />
                }
                {/* Fill arc — only when there's progress */}
                {!st.isRest && frac > 0 && (
                  <circle cx="20" cy="20" r="16"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
                )}
              </svg>
              <span className={s.ringLetter}>
                {st.allDone ? "✓" : DOW_LETTERS[st.dow]}
              </span>
            </div>
            <span className={s.ringCount}>
              {st.isRest ? "—" : st.allDone ? "done" : `${st.mvCount}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Muscle balance ───────────────────────────────────────────────────────────

function MuscleBalance({ rows }: { rows: Array<{ label: string; count: number; pct: number }> }) {
  const allZero = rows.every((r) => r.count === 0);
  if (allZero) return null;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className={s.balanceCard}>
      <div className={s.balanceHead}>Muscle balance — this week</div>
      {rows.map((r) => (
        <div key={r.label} className={s.balRow}>
          <span className={s.balLabel}>{r.label}</span>
          <div className={s.balTrack}>
            <div className={s.balFill} style={{ width: `${r.pct}%` }} />
          </div>
          <span className={`${s.balVal} ${r.count > 0 && r.count < max / 2 ? s.balValLow : ""}`}>
            {r.count > 0 ? `${r.count}×` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Single day view ──────────────────────────────────────────────────────────

function DayView({
  dow, stats, plans, movements, mvHistory, onAdd, onEdit,
}: {
  dow: number;
  stats: DowStats;
  plans: PlanItem[];
  movements: Movement[];
  mvHistory: Map<string, MvHistory>;
  onAdd: () => void;
  onEdit: (plan: PlanItem, mv: Movement) => void;
}) {
  const mvMap = useMemo(
    () => new Map<string, Movement>(movements.map((m) => [m.id, m])),
    [movements],
  );

  const dayPlans = useMemo(
    () => plans
      .filter((p) => p.dow === dow && mvMap.has(p.mid))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [plans, dow, mvMap],
  );

  const totalSets = dayPlans.reduce((a, p) => a + planItemSets(p), 0);
  const eta       = fmtEta(calcEtaMins(totalSets, dayPlans.length));
  const todayDow  = new Date().getDay();
  const diff      = (dow - todayDow + 7) % 7;
  const d = new Date(); d.setDate(d.getDate() + diff);
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={s.dayView}>
      <div className={s.dayViewHead}>
        <div>
          <div className={s.dayViewName}>
            {DOW_NAMES[dow]}
            {stats.isToday && <span className={s.dayViewTodayBadge}>TODAY</span>}
          </div>
          <div className={s.dayViewMeta}>
            {stats.isRest ? (
              <span className={s.dayViewRestChip}>Rest day</span>
            ) : (
              <>
                <span className={s.dayViewDate}>{dateLabel}</span>
                <span className={s.dayViewDot}>·</span>
                <span>{dayPlans.length} movement{dayPlans.length !== 1 ? "s" : ""}</span>
                {eta && <><span className={s.dayViewDot}>·</span><span>{eta}</span></>}
              </>
            )}
          </div>
        </div>
        <button type="button" className={s.dayAddBtn} onClick={onAdd}>+ Add</button>
      </div>

      <div className={s.dayViewBody}>
        {dayPlans.length === 0 ? (
          <div className={s.dayEmpty}>
            <div className={s.dayEmptyIcon}>{stats.isRest ? "😴" : "📋"}</div>
            <div className={s.dayEmptyTitle}>
              {stats.isRest ? "Rest day" : "Nothing planned yet"}
            </div>
            <div className={s.dayEmptySub}>
              {stats.isRest ? "Tap + Add to turn this into a training day." : "Tap + Add to build this session."}
            </div>
          </div>
        ) : (
          dayPlans.map((plan) => {
            const mv    = mvMap.get(plan.mid)!;
            const badge = deriveProgBadge(plan.mid, mvHistory);
            return (
              <PlanMvRow key={plan.id} plan={plan} mv={mv} badge={badge}
                onEdit={() => onEdit(plan, mv)} />
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Plan movement row ────────────────────────────────────────────────────────

function PlanMvRow({ plan, mv, badge, onEdit }: {
  plan: PlanItem;
  mv: Movement;
  badge: ProgBadge;
  onEdit: () => void;
}) {
  const sets  = planItemSets(plan);
  const reps  = plan.reps  ? `${plan.reps} reps` : "";
  const equip = mv.equipmentType ?? "";
  const meta  = [`${sets} sets`, reps, equip].filter(Boolean).join(" · ");
  const stripeKind = badge?.kind ?? "none";

  return (
    <button type="button" className={s.mvRow} onClick={onEdit}>
      <span className={`${s.mvStripe} ${s[`stripe_${stripeKind}`]}`} aria-hidden="true" />
      <div className={s.mvBody}>
        <span className={s.mvName}>{mv.name}</span>
        <span className={s.mvMeta}>{meta}</span>
      </div>
      <div className={s.mvRowRight}>
        {badge?.kind === "pr" && <span className={s.badgePr}>★ PR</span>}
        {badge?.kind === "up" && <span className={s.badgeUp}>↑ +{badge.lbs} lbs</span>}
        <span className={s.mvChev}>›</span>
      </div>
    </button>
  );
}

// ─── Add Movement Sheet ───────────────────────────────────────────────────────

function AddMovementSheet({ dow, movements, plans, onAdd, onClose }: {
  dow: number;
  movements: Movement[];
  plans: PlanItem[];
  onAdd: (mv: Movement, dow: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const plannedMids = new Set(plans.filter((p) => p.dow === dow).map((p) => p.mid));
  const filtered = movements.filter((mv) => {
    if (plannedMids.has(mv.id)) return false;
    return !query.trim() || mv.name.toLowerCase().includes(query.toLowerCase());
  });

  const grouped: Array<{ label: string; items: Movement[] }> = [];
  if (!query.trim()) {
    const mm = new Map<string, Movement[]>();
    for (const mv of filtered) {
      const k = (mv.muscle ?? mv.category ?? "other").toLowerCase();
      const l = k.charAt(0).toUpperCase() + k.slice(1);
      if (!mm.has(l)) mm.set(l, []);
      mm.get(l)!.push(mv);
    }
    const ORDER = ["Chest","Back","Shoulders","Biceps","Bicepts","Triceps","Tricepts","Core","Quads","Hamstrings","Glutes","Calves","Cardio","Other"];
    for (const l of ORDER) { const items = mm.get(l); if (items?.length) { mm.delete(l); grouped.push({ label: l, items }); } }
    for (const [l, items] of mm) grouped.push({ label: l, items });
  }

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true">
        <div className={s.sheet} role="dialog" aria-modal="true"
          aria-label={`Add to ${DOW_NAMES[dow]}`}
          onClick={(e) => e.stopPropagation()}>
          <div className={s.sheetHandle} />
          <div className={s.sheetHead}>
            <span className={s.sheetTitle}>Add to {DOW_NAMES[dow]}</span>
            <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
          </div>
          <input ref={inputRef} type="search" className={s.searchInput}
            placeholder="Search movements…" value={query}
            onChange={(e) => setQuery(e.target.value)} />
          <div className={s.pickerList}>
            {query.trim() ? (
              filtered.length === 0
                ? <div className={s.pickerEmpty}>No movements match.</div>
                : filtered.map((mv) => <PickerItem key={mv.id} mv={mv} onPick={() => onAdd(mv, dow)} />)
            ) : (
              grouped.map((g) => (
                <div key={g.label}>
                  <div className={s.pickerGroupLabel}>{g.label}</div>
                  {g.items.map((mv) => <PickerItem key={mv.id} mv={mv} onPick={() => onAdd(mv, dow)} />)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PickerItem({ mv, onPick }: { mv: Movement; onPick: () => void }) {
  return (
    <button type="button" className={s.pickerItem} onClick={onPick}>
      <span className={s.pickerItemName}>{mv.name}</span>
      {mv.equipmentType && <span className={s.pickerItemMeta}>{mv.equipmentType}</span>}
    </button>
  );
}

// ─── Edit Plan Sheet ──────────────────────────────────────────────────────────

function EditPlanSheet({ plan, mv, onSave, onRemove, onClose }: {
  plan: PlanItem;
  mv: Movement;
  onSave: (updated: PlanItem) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [sets,          setSets]          = useState(String(planItemSets(plan)));
  const [reps,          setReps]          = useState(plan.reps ?? "");
  const [note,          setNote]          = useState(plan.notes ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true">
        <div className={s.sheet} role="dialog" aria-modal="true"
          aria-label={`Edit ${mv.name}`}
          onClick={(e) => e.stopPropagation()}>
          <div className={s.sheetHandle} />
          <div className={s.sheetHead}>
            <span className={s.sheetTitle}>{mv.name}</span>
            <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className={s.editForm}>
            <div className={s.fieldRow}>
              <label className={s.fieldLabel}>Sets</label>
              <input type="number" className={s.fieldInput} value={sets}
                min={1} max={20} onChange={(e) => setSets(e.target.value)} />
            </div>
            <div className={s.fieldRow}>
              <label className={s.fieldLabel}>Reps</label>
              <input type="text" className={s.fieldInput} value={reps}
                placeholder="e.g. 8–10" onChange={(e) => setReps(e.target.value)} />
            </div>
            <div className={s.fieldRow}>
              <label className={s.fieldLabel}>Note</label>
              <input type="text" className={s.fieldInput} value={note}
                placeholder="Optional cue…" onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className={s.editActions}>
            <button type="button" className={s.btnSave} onClick={() => onSave({ ...plan, sets: Number(sets) > 0 ? Number(sets) : 3, reps, notes: note })}>Save</button>
            {confirmRemove
              ? <button type="button" className={`${s.btnRemove} ${s.btnRemoveConfirm}`} onClick={() => onRemove(plan.id)}>Remove from plan?</button>
              : <button type="button" className={s.btnRemove} onClick={() => setConfirmRemove(true)}>Remove</button>
            }
          </div>
        </div>
      </div>
    </>
  );
}
