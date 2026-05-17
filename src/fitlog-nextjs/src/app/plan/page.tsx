"use client";

// Plan — v2
// Single-day view: tap a day circle → see only that day's workout.
// Gamification: streak counter, weekly completion score, XP bar, progression
// badges (↑ +N lbs / ★ PR / New) derived from workout history.
// Data-sync fix: visibilitychange listener ensures fresh data whenever the
// user navigates back from the movements page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listMovements, listPlans, listWorkouts,
  upsertPlan, deletePlan,
} from "@/lib/db";
import type { Movement, PlanItem, Workout } from "@/lib/types";
import {
  buildDowStats,
  calcEtaMins,
  fmtEta,
  planItemSets,
  DOW_NAMES,
  DOW_LETTERS,
  type DowStats,
} from "@/lib/engine/plan";
import s from "./PlanPage.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddSheet  = { dow: number } | null;
type EditSheet = { plan: PlanItem; mv: Movement } | null;

type ProgBadge =
  | { kind: "pr" }
  | { kind: "up"; lbs: number }
  | { kind: "new" }
  | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive progression badge by comparing the last two sessions for a movement. */
function deriveProgBadge(
  mid: string,
  workouts: Workout[],
): ProgBadge {
  const sessions: Array<{ topWeight: number; date: Date }> = [];
  for (const w of workouts) {
    if (!w.finished) continue;
    for (const e of w.entries) {
      if (e.movementId !== mid) continue;
      const done = (e.sets ?? []).filter((s) => s.done && !s.warmup);
      const weights = done.map((s) => Number(s.weight) || 0).filter((n) => n > 0);
      if (!weights.length) continue;
      sessions.push({ topWeight: Math.max(...weights), date: new Date(w.date) });
    }
  }
  if (!sessions.length) return { kind: "new" };
  sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  if (sessions.length === 1) return null;
  const delta = sessions[0].topWeight - sessions[1].topWeight;
  const isPR = sessions[0].topWeight >= Math.max(...sessions.map((s) => s.topWeight));
  if (isPR && delta > 0) return { kind: "pr" };
  if (delta > 0)         return { kind: "up", lbs: delta };
  return null;
}

/** How many days this week (Sun–Sat) had at least one finished workout. */
function completedDaysThisWeek(workouts: Workout[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const days = new Set<string>();
  for (const w of workouts) {
    if (!w.finished) continue;
    const d = new Date(w.date || w.savedAt || 0);
    if (d >= startOfWeek) days.add(d.toDateString());
  }
  return days.size;
}

/** Longest current streak in days ending today. */
function currentStreak(workouts: Workout[]): number {
  const doneDays = new Set<string>(
    workouts
      .filter((w) => w.finished)
      .map((w) => new Date(w.date || w.savedAt || 0).toDateString()),
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (doneDays.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans,     setPlans]     = useState<PlanItem[]>([]);
  const [workouts,  setWorkouts]  = useState<Workout[]>([]);

  // Selected dow — defaults to today
  const [selDow, setSelDow] = useState<number>(() => new Date().getDay());

  const [addSheet,  setAddSheet]  = useState<AddSheet>(null);
  const [editSheet, setEditSheet] = useState<EditSheet>(null);

  const load = useCallback(async () => {
    try {
      const [mv, pl, wk] = await Promise.all([
        listMovements(),
        listPlans(),
        listWorkouts({ finished: true }),
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

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Re-fetch when the user navigates back to this tab/page from movements
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
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

  const dowStats  = useMemo(() => buildDowStats(plans, movements, workouts), [plans, movements, workouts]);
  const streak    = useMemo(() => currentStreak(workouts), [workouts]);
  const weekDone  = useMemo(() => completedDaysThisWeek(workouts), [workouts]);
  const weekPlanned = dowStats.filter((d) => !d.isRest).length;

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
          {/* Gamification hero card */}
          <GamHero streak={streak} weekDone={weekDone} weekPlanned={weekPlanned} />

          {/* Day selector — 7 circles */}
          <DaySelector
            stats={dowStats}
            selDow={selDow}
            onSelect={setSelDow}
          />

          {/* Single-day workout view */}
          <DayView
            dow={selDow}
            stats={dowStats[selDow]}
            plans={plans}
            movements={movements}
            workouts={workouts}
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

// ─── Gamification hero card ───────────────────────────────────────────────────

function GamHero({
  streak,
  weekDone,
  weekPlanned,
}: {
  streak: number;
  weekDone: number;
  weekPlanned: number;
}) {
  // Fake XP for now — will wire to real XP system in a future phase
  const xpPct = Math.min(100, (streak * 7) % 100);
  const level  = Math.floor(streak / 14) + 1;

  return (
    <div className={s.gamHero}>
      <div className={s.gamHeroRow}>
        {/* Streak */}
        <div className={s.gamStreak}>
          <span className={s.gamFlame}>🔥</span>
          <div className={s.gamStreakBd}>
            <span className={s.gamStreakNum}>{streak}</span>
            <span className={s.gamStreakLabel}>Day streak</span>
          </div>
        </div>

        {/* Weekly score */}
        <div className={s.gamWeekScore}>
          <span className={s.gamWeekNum}>
            {weekDone}<span className={s.gamWeekDenom}>/{weekPlanned || "—"}</span>
          </span>
          <span className={s.gamWeekLabel}>This week</span>
        </div>
      </div>

      {/* XP bar */}
      <div className={s.gamXpRow}>
        <span className={s.gamXpLabel}>LV {level}</span>
        <div className={s.gamXpTrack}>
          <div className={s.gamXpFill} style={{ width: `${xpPct}%` }} />
        </div>
        <span className={s.gamXpNext}>LV {level + 1}</span>
      </div>
    </div>
  );
}

// ─── Day selector ─────────────────────────────────────────────────────────────

function DaySelector({
  stats,
  selDow,
  onSelect,
}: {
  stats: DowStats[];
  selDow: number;
  onSelect: (dow: number) => void;
}) {
  return (
    <div className={s.daySelector}>
      {stats.map((st) => {
        const isSelected = selDow === st.dow;
        const cls = [
          s.daySel,
          isSelected  ? s.daySelActive  : "",
          st.isToday  ? s.daySelToday   : "",
          st.allDone  ? s.daySelDone    : "",
          st.partial  ? s.daySelPartial : "",
          st.isRest   ? s.daySelRest    : "",
        ].filter(Boolean).join(" ");

        return (
          <button
            key={st.dow}
            type="button"
            className={cls}
            onClick={() => onSelect(st.dow)}
            aria-pressed={isSelected}
          >
            <div className={s.daySelCircle}>
              {st.allDone ? "✓" : DOW_LETTERS[st.dow]}
            </div>
            <span className={s.daySelCount}>
              {st.isRest ? "—" : `${st.mvCount}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Single day view ──────────────────────────────────────────────────────────

function DayView({
  dow,
  stats,
  plans,
  movements,
  workouts,
  onAdd,
  onEdit,
}: {
  dow: number;
  stats: DowStats;
  plans: PlanItem[];
  movements: Movement[];
  workouts: Workout[];
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

  const totalSets = dayPlans.reduce((acc, p) => acc + planItemSets(p), 0);
  const etaLabel  = fmtEta(calcEtaMins(totalSets, dayPlans.length));

  // Date label for the selected day
  const todayDow = new Date().getDay();
  const diff  = (dow - todayDow + 7) % 7;
  const d     = new Date();
  d.setDate(d.getDate() + diff);
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={s.dayView}>
      {/* Day header */}
      <div className={s.dayViewHead}>
        <div className={s.dayViewName}>
          {DOW_NAMES[dow]}
          {stats.isToday && <span className={s.dayViewTodayBadge}>TODAY</span>}
        </div>
        <div className={s.dayViewMeta}>
          {stats.isRest
            ? <span className={s.dayViewRestChip}>Rest day</span>
            : (
              <>
                <span className={s.dayViewDate}>{dateLabel}</span>
                <span className={s.dayViewDot}>·</span>
                <span>{dayPlans.length} movement{dayPlans.length !== 1 ? "s" : ""}</span>
                {etaLabel && <><span className={s.dayViewDot}>·</span><span>{etaLabel}</span></>}
              </>
            )
          }
        </div>
      </div>

      {/* Movement list or empty */}
      <div className={s.dayViewBody}>
        {dayPlans.length === 0 ? (
          <div className={s.dayEmpty}>
            <div className={s.dayEmptyIcon}>{stats.isRest ? "😴" : "📋"}</div>
            <div className={s.dayEmptyTitle}>
              {stats.isRest ? "Rest day" : "No movements planned"}
            </div>
            <div className={s.dayEmptySub}>
              {stats.isRest
                ? "Add movements below to turn this into a training day."
                : "Tap + to build this session."}
            </div>
          </div>
        ) : (
          dayPlans.map((plan) => {
            const mv = mvMap.get(plan.mid)!;
            const badge = deriveProgBadge(plan.mid, workouts);
            return (
              <PlanMvRow
                key={plan.id}
                plan={plan}
                mv={mv}
                badge={badge}
                onEdit={() => onEdit(plan, mv)}
              />
            );
          })
        )}

        <button type="button" className={s.addRow} onClick={onAdd}>
          <span className={s.addRowPlus}>+</span>
          <span className={s.addRowLabel}>Add movement</span>
        </button>
      </div>
    </div>
  );
}

// ─── Plan movement row ────────────────────────────────────────────────────────

function PlanMvRow({
  plan,
  mv,
  badge,
  onEdit,
}: {
  plan: PlanItem;
  mv: Movement;
  badge: ProgBadge;
  onEdit: () => void;
}) {
  const sets  = planItemSets(plan);
  const reps  = plan.reps ? `${plan.reps} reps` : "";
  const equip = mv.equipmentType ?? "";
  const meta  = [`${sets} sets`, reps, equip].filter(Boolean).join(" · ");

  return (
    <button type="button" className={s.mvRow} onClick={onEdit}>
      <div className={s.mvBody}>
        <span className={s.mvName}>{mv.name}</span>
        <span className={s.mvMeta}>{meta}</span>
      </div>
      <div className={s.mvRowRight}>
        {badge?.kind === "pr"  && <span className={s.badgePr}>★ PR</span>}
        {badge?.kind === "up"  && <span className={s.badgeUp}>↑ +{badge.lbs} lbs</span>}
        {badge?.kind === "new" && <span className={s.badgeNew}>New</span>}
        <span className={s.mvChev}>›</span>
      </div>
    </button>
  );
}

// ─── Add Movement Sheet ───────────────────────────────────────────────────────

function AddMovementSheet({
  dow,
  movements,
  plans,
  onAdd,
  onClose,
}: {
  dow: number;
  movements: Movement[];
  plans: PlanItem[];
  onAdd: (mv: Movement, dow: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const plannedMids = new Set(plans.filter((p) => p.dow === dow).map((p) => p.mid));

  const filtered = movements.filter((mv) => {
    if (plannedMids.has(mv.id)) return false;
    if (!query.trim()) return true;
    return mv.name.toLowerCase().includes(query.toLowerCase());
  });

  // Group by muscle when not searching
  const grouped: Array<{ label: string; items: Movement[] }> = [];
  if (!query.trim()) {
    const muscleMap = new Map<string, Movement[]>();
    for (const mv of filtered) {
      const key   = (mv.muscle ?? mv.category ?? "other").toLowerCase();
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      if (!muscleMap.has(label)) muscleMap.set(label, []);
      muscleMap.get(label)!.push(mv);
    }
    const ORDER = [
      "Chest","Back","Shoulders","Biceps","Bicepts",
      "Triceps","Tricepts","Core","Quads","Hamstrings",
      "Glutes","Calves","Cardio","Other",
    ];
    for (const label of ORDER) {
      const items = muscleMap.get(label);
      if (items?.length) { muscleMap.delete(label); grouped.push({ label, items }); }
    }
    for (const [label, items] of muscleMap) grouped.push({ label, items });
  }

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true">
        <div
          className={s.sheet}
          role="dialog"
          aria-modal="true"
          aria-label={`Add to ${DOW_NAMES[dow]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={s.sheetHandle} />
          <div className={s.sheetHead}>
            <span className={s.sheetTitle}>Add to {DOW_NAMES[dow]}</span>
            <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
          </div>

          <input
            ref={inputRef}
            type="search"
            className={s.searchInput}
            placeholder="Search movements…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className={s.pickerList}>
            {query.trim() ? (
              filtered.length === 0 ? (
                <div className={s.pickerEmpty}>No movements match.</div>
              ) : (
                filtered.map((mv) => (
                  <PickerItem key={mv.id} mv={mv} onPick={() => onAdd(mv, dow)} />
                ))
              )
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <div className={s.pickerGroupLabel}>{group.label}</div>
                  {group.items.map((mv) => (
                    <PickerItem key={mv.id} mv={mv} onPick={() => onAdd(mv, dow)} />
                  ))}
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
      {mv.equipmentType && (
        <span className={s.pickerItemMeta}>{mv.equipmentType}</span>
      )}
    </button>
  );
}

// ─── Edit Plan Sheet ──────────────────────────────────────────────────────────

function EditPlanSheet({
  plan,
  mv,
  onSave,
  onRemove,
  onClose,
}: {
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

  const handleSave = () => {
    onSave({
      ...plan,
      sets: Number(sets) > 0 ? Number(sets) : 3,
      reps,
      notes: note,
    });
  };

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true">
        <div
          className={s.sheet}
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${mv.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={s.sheetHandle} />
          <div className={s.sheetHead}>
            <span className={s.sheetTitle}>{mv.name}</span>
            <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className={s.editForm}>
            <div className={s.fieldRow}>
              <label className={s.fieldLabel}>Sets</label>
              <input type="number" className={s.fieldInput}
                value={sets} min={1} max={20}
                onChange={(e) => setSets(e.target.value)} />
            </div>
            <div className={s.fieldRow}>
              <label className={s.fieldLabel}>Reps</label>
              <input type="text" className={s.fieldInput}
                value={reps} placeholder="e.g. 8–10"
                onChange={(e) => setReps(e.target.value)} />
            </div>
            <div className={s.fieldRow}>
              <label className={s.fieldLabel}>Note</label>
              <input type="text" className={s.fieldInput}
                value={note} placeholder="Optional cue…"
                onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <div className={s.editActions}>
            <button type="button" className={s.btnSave} onClick={handleSave}>Save</button>
            {confirmRemove ? (
              <button type="button"
                className={`${s.btnRemove} ${s.btnRemoveConfirm}`}
                onClick={() => onRemove(plan.id)}>
                Remove from plan?
              </button>
            ) : (
              <button type="button" className={s.btnRemove}
                onClick={() => setConfirmRemove(true)}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
