"use client";

// Phase 6 Plan editor.
// Visual parity target: src/fitlog-mobile.html #view-plan (mobile351 baseline).
// Week-strip → collapsible day cards → movement rows → bottom-sheet add/edit.

import { useCallback, useEffect, useRef, useState } from "react";
import { listMovements, listPlans, listWorkouts, upsertPlan, deletePlan } from "@/lib/db";
import type { Movement, PlanItem, Workout } from "@/lib/types";
import {
  buildDowStats,
  calcEtaMins,
  fmtEta,
  groupPlanByMuscle,
  planItemSets,
  rotatedDowOrder,
  DOW_NAMES,
  DOW_LETTERS,
  type DowStats,
} from "@/lib/engine/plan";
import s from "./PlanPage.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddSheet = { dow: number } | null;
type EditSheet = { plan: PlanItem; mv: Movement } | null;

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  // Which dow card is expanded (null = none)
  const [pinnedDow, setPinnedDow] = useState<number | null>(() => new Date().getDay());

  // Bottom sheets
  const [addSheet, setAddSheet] = useState<AddSheet>(null);
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

  useEffect(() => { load(); }, [load]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddMovement = useCallback(async (mv: Movement, dow: number) => {
    const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newPlan: PlanItem = {
      id,
      mid: mv.id,
      dow,
      sets: 3,
      reps: "",
      rpe: "",
      notes: "",
      order: plans.filter((p) => p.dow === dow).length,
    };
    setPlans((prev) => [...prev, newPlan]);
    setAddSheet(null);
    await upsertPlan(newPlan);
  }, [plans]);

  const handleSavePlan = useCallback(async (updated: PlanItem) => {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditSheet(null);
    await upsertPlan(updated);
  }, []);

  const handleRemovePlan = useCallback(async (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setEditSheet(null);
    await deletePlan(id);
  }, []);

  const handleStripTap = useCallback((dow: number) => {
    setPinnedDow((cur) => (cur === dow ? null : dow));
  }, []);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const dowStats = buildDowStats(plans, movements, workouts);
  const dayOrder = rotatedDowOrder();

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.subline}>Weekly</div>
        <h1 className={s.headline}>Plan</h1>
      </div>

      {loading ? (
        <div className={s.stateMsg}>Loading…</div>
      ) : err ? (
        <div className={s.stateErr}>{err}</div>
      ) : (
        <>
          <WeekStrip
            stats={dowStats}
            pinnedDow={pinnedDow}
            onTap={handleStripTap}
          />

          <div className={s.dayList}>
            {dayOrder.map((dow) => (
              <DayCard
                key={dow}
                dow={dow}
                stats={dowStats[dow]}
                plans={plans}
                movements={movements}
                workouts={workouts}
                expanded={pinnedDow === dow}
                onToggle={() => handleStripTap(dow)}
                onAdd={() => setAddSheet({ dow })}
                onEdit={(plan, mv) => setEditSheet({ plan, mv })}
              />
            ))}
          </div>
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

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  stats,
  pinnedDow,
  onTap,
}: {
  stats: DowStats[];
  pinnedDow: number | null;
  onTap: (dow: number) => void;
}) {
  return (
    <div className={s.weekStrip}>
      {stats.map((st) => {
        const active = pinnedDow === st.dow;
        const cls = [
          s.wday,
          st.isToday ? s.wdayToday : "",
          st.allDone ? s.wdayDone : "",
          st.partial ? s.wdayPartial : "",
          st.isRest ? s.wdayRest : "",
          active ? s.wdayActive : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={st.dow}
            type="button"
            className={cls}
            aria-pressed={active}
            onClick={() => onTap(st.dow)}
          >
            <span className={s.wdayLetter}>{DOW_LETTERS[st.dow]}</span>
            <span className={s.wdayDot} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  dow,
  stats,
  plans,
  movements,
  workouts,
  expanded,
  onToggle,
  onAdd,
  onEdit,
}: {
  dow: number;
  stats: DowStats;
  plans: PlanItem[];
  movements: Movement[];
  workouts: Workout[];
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (plan: PlanItem, mv: Movement) => void;
}) {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const groups = groupPlanByMuscle(plans, movements, dow);

  // ETA
  const dayPlans = plans.filter((p) => p.dow === dow);
  const totalSets = dayPlans.reduce((s, p) => s + planItemSets(p), 0);
  const totalMvs = dayPlans.filter((p) => mvMap.has(p.mid)).length;
  const etaMins = calcEtaMins(totalSets, totalMvs);
  const etaLabel = fmtEta(etaMins);

  // Date label relative to today
  const todayDow = new Date().getDay();
  let dateLabel = "";
  {
    const diff = (dow - todayDow + 7) % 7;
    const d = new Date();
    d.setDate(d.getDate() + diff);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    dateLabel = d.toLocaleDateString("en-US", opts);
  }

  const headerCls = [s.dayCardHead, expanded ? s.dayCardHeadOpen : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${s.dayCard} ${expanded ? s.dayCardExpanded : ""}`}>
      <button
        type="button"
        className={headerCls}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className={s.dayCardLeft}>
          <span className={s.dayName}>
            {DOW_NAMES[dow]}
            {stats.isToday && <span className={s.dayTodayBadge}>TODAY</span>}
          </span>
          <span className={s.dayMeta}>
            {stats.isRest
              ? "Rest"
              : `${stats.mvCount} movement${stats.mvCount !== 1 ? "s" : ""}${etaLabel ? " · " + etaLabel : ""}`}
          </span>
        </div>
        <div className={s.dayCardRight}>
          {!stats.isRest && stats.allDone && (
            <span className={s.dayDoneCheck} aria-label="All done">✓</span>
          )}
          <span className={s.dayChev} aria-hidden="true">▼</span>
        </div>
      </button>

      <div className={`${s.dayBody} ${expanded ? s.dayBodyOpen : ""}`}>
        <div className={s.dayBodyInner}>
          {groups.length === 0 ? (
            <div className={s.dayEmpty}>
              Rest day. Tap + to add movements.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.muscle} className={s.muscleGroup}>
                <div className={s.muscleLabel}>{group.label}</div>
                {group.items.map(({ plan, mv }) => (
                  <PlanMvRow
                    key={plan.id}
                    plan={plan}
                    mv={mv}
                    onEdit={() => onEdit(plan, mv)}
                  />
                ))}
              </div>
            ))
          )}

          <button type="button" className={s.addRow} onClick={onAdd}>
            <span className={s.addRowPlus}>+</span>
            <span className={s.addRowLabel}>Add movement</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan movement row ─────────────────────────────────────────────────────────

function PlanMvRow({
  plan,
  mv,
  onEdit,
}: {
  plan: PlanItem;
  mv: Movement;
  onEdit: () => void;
}) {
  const sets = planItemSets(plan);
  const reps = plan.reps ? `${plan.reps} reps` : "";
  const equip = mv.equipmentType ? mv.equipmentType : "";
  const meta = [
    `${sets} sets`,
    reps,
    equip,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button type="button" className={s.mvRow} onClick={onEdit}>
      <div className={s.mvRowBody}>
        <span className={s.mvName}>{mv.name}</span>
        <span className={s.mvMeta}>{meta}</span>
      </div>
      <span className={s.mvRowChev} aria-hidden="true">›</span>
    </button>
  );
}

// ─── Add Movement Sheet ────────────────────────────────────────────────────────

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

  // Filter out already-planned mids for this dow
  const plannedMids = new Set(plans.filter((p) => p.dow === dow).map((p) => p.mid));

  const filtered = movements.filter((mv) => {
    if (plannedMids.has(mv.id)) return false;
    if (!query.trim()) return true;
    return mv.name.toLowerCase().includes(query.toLowerCase());
  });

  // Group by muscle when no query
  const grouped: Array<{ label: string; items: Movement[] }> = [];
  if (!query.trim()) {
    const muscleMap = new Map<string, Movement[]>();
    for (const mv of filtered) {
      const key = (mv.muscle ?? mv.category ?? "other").toLowerCase();
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      if (!muscleMap.has(label)) muscleMap.set(label, []);
      muscleMap.get(label)!.push(mv);
    }
    const ORDER = [
      "Chest", "Back", "Shoulders", "Biceps", "Bicepts",
      "Triceps", "Tricepts", "Core", "Quads", "Hamstrings",
      "Glutes", "Calves", "Cardio", "Other",
    ];
    for (const label of ORDER) {
      const items = muscleMap.get(label);
      if (items?.length) {
        muscleMap.delete(label);
        grouped.push({ label, items });
      }
    }
    for (const [label, items] of muscleMap) {
      grouped.push({ label, items });
    }
  }

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Add movement">
        <div className={s.sheetHandle} />
        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>Add to {DOW_NAMES[dow]}</span>
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
    </>
  );
}

function PickerItem({ mv, onPick }: { mv: Movement; onPick: () => void }) {
  return (
    <button type="button" className={s.pickerItem} onClick={onPick}>
      <span className={s.pickerName}>{mv.name}</span>
      {mv.equipmentType && (
        <span className={s.pickerEquip}>{mv.equipmentType}</span>
      )}
    </button>
  );
}

// ─── Edit Plan Sheet ───────────────────────────────────────────────────────────

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
  const [sets, setSets] = useState(String(planItemSets(plan)));
  const [reps, setReps] = useState(plan.reps ?? "");
  const [note, setNote] = useState(plan.notes ?? "");
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
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={`Edit ${mv.name}`}>
        <div className={s.sheetHandle} />
        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>{mv.name}</span>
          <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={s.editForm}>
          <div className={s.editRow}>
            <label className={s.editLabel}>Sets</label>
            <input
              type="number"
              className={s.editInput}
              value={sets}
              min={1}
              max={20}
              onChange={(e) => setSets(e.target.value)}
            />
          </div>

          <div className={s.editRow}>
            <label className={s.editLabel}>Reps</label>
            <input
              type="text"
              className={s.editInput}
              value={reps}
              placeholder="e.g. 8–10"
              onChange={(e) => setReps(e.target.value)}
            />
          </div>

          <div className={s.editRow}>
            <label className={s.editLabel}>Note</label>
            <input
              type="text"
              className={s.editInput}
              value={note}
              placeholder="Optional cue…"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className={s.editActions}>
          <button type="button" className={s.btnSave} onClick={handleSave}>
            Save
          </button>
          {confirmRemove ? (
            <button
              type="button"
              className={`${s.btnRemove} ${s.btnRemoveConfirm}`}
              onClick={() => onRemove(plan.id)}
            >
              Remove from plan?
            </button>
          ) : (
            <button
              type="button"
              className={s.btnRemove}
              onClick={() => setConfirmRemove(true)}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </>
  );
}
