"use client";

// Movement Library — Phase 7 v2
// New: favorites (heart toggle, pinned section, filter), last-done timestamps
//      from workout history, inline day-chip plan strip (auto-save, Option 2).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listMovements, upsertMovement, deleteMovement,
  listPlans, upsertPlan, deletePlan, toggleMovementFavorite, listWorkouts,
} from "@/lib/db";
import type { Movement, MovementKind, PlanItem, Workout } from "@/lib/types";
import s from "./MovementsPage.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const MUSCLE_OPTIONS = [
  "Chest","Back","Shoulders","Biceps","Triceps",
  "Core","Quads","Hamstrings","Glutes","Calves","Cardio","Other",
];

const MUSCLE_ORDER = [
  "chest","back","shoulders","biceps","bicepts","triceps","tricepts",
  "core","quads","hamstrings","glutes","calves","cardio","other",
];

const DOW_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DOW_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ─── Types ────────────────────────────────────────────────────────────────────

type LastSession = {
  date: Date;
  sets: number;
  topWeight?: number;
  topRpe?: number;
};

type Filter = "all" | "favorites";

type Sheet =
  | { mode: "create" }
  | { mode: "edit"; mv: Movement }
  | { mode: "detail"; mv: Movement }
  | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLastDone(date?: Date): { text: string; recent: boolean; never: boolean } {
  if (!date) return { text: "Never done", recent: false, never: true };
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return { text: "Today", recent: true, never: false };
  if (diffDays === 1) return { text: "Yesterday", recent: true, never: false };
  if (diffDays < 7)  return { text: `${diffDays} days ago`, recent: true, never: false };
  if (diffDays < 14) return { text: "1 week ago", recent: false, never: false };
  if (diffDays < 60) return { text: `${Math.floor(diffDays / 7)} weeks ago`, recent: false, never: false };
  return { text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), recent: false, never: false };
}

function groupByMuscle(movements: Movement[]): Array<{ label: string; items: Movement[] }> {
  const map = new Map<string, Movement[]>();
  for (const mv of movements) {
    const key = (mv.muscle ?? mv.bodyPart ?? "other").toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(mv);
  }
  const result: Array<{ label: string; items: Movement[] }> = [];
  for (const key of MUSCLE_ORDER) {
    const items = map.get(key);
    if (items?.length) { map.delete(key); result.push({ label: key.charAt(0).toUpperCase() + key.slice(1), items }); }
  }
  for (const [key, items] of map) {
    result.push({ label: key.charAt(0).toUpperCase() + key.slice(1), items });
  }
  return result;
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MovementsPage() {
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans, setPlans]       = useState<PlanItem[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [query, setQuery]       = useState("");
  const [filter, setFilter]     = useState<Filter>("all");
  const [sheet, setSheet]       = useState<Sheet>(null);

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

  // Derive last session per movement id from workout history
  const lastSessionMap = useMemo((): Map<string, LastSession> => {
    const map = new Map<string, LastSession>();
    for (const w of workouts) {
      if (!w.finished) continue;
      const wDate = new Date(w.date || w.savedAt || 0);
      for (const entry of w.entries) {
        const mid = entry.movementId;
        if (!mid) continue;
        const existing = map.get(mid);
        if (existing && existing.date >= wDate) continue;
        const doneSets = (entry.sets ?? []).filter((s) => s.done && !s.warmup);
        const weights = doneSets.map((s) => Number(s.weight) || 0).filter((n) => n > 0);
        const lastRpe = doneSets.slice(-1)[0]?.rpe;
        map.set(mid, {
          date: wDate,
          sets: doneSets.length,
          topWeight: weights.length > 0 ? Math.max(...weights) : undefined,
          topRpe: lastRpe != null && lastRpe !== "" ? Number(lastRpe) : undefined,
        });
      }
    }
    return map;
  }, [workouts]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (mv: Movement) => {
    setMovements((prev) => {
      const idx = prev.findIndex((m) => m.id === mv.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = mv;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      }
      return [...prev, mv].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSheet(null);
    const ok = await upsertMovement(mv);
    if (!ok) setErr("Save failed — check console.");
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setMovements((prev) => prev.filter((m) => m.id !== id));
    setSheet(null);
    await deleteMovement(id);
  }, []);

  const handleToggleFavorite = useCallback(async (mv: Movement) => {
    const updated = { ...mv, favorite: !mv.favorite };
    setMovements((prev) => prev.map((m) => m.id === mv.id ? updated : m));
    // Keep open detail sheet in sync
    setSheet((cur) =>
      cur?.mode === "detail" && cur.mv.id === mv.id
        ? { mode: "detail", mv: updated }
        : cur
    );
    await toggleMovementFavorite(mv.id, !mv.favorite);
  }, []);

  const handleTogglePlanDay = useCallback(async (mv: Movement, dow: number) => {
    const existing = plans.find((p) => p.mid === mv.id && p.dow === dow);
    if (existing) {
      setPlans((prev) => prev.filter((p) => p.id !== existing.id));
      await deletePlan(existing.id);
    } else {
      const newPlan: PlanItem = {
        id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${dow}`,
        mid: mv.id, dow, sets: 3, reps: "", notes: "",
      };
      setPlans((prev) => [...prev, newPlan]);
      await upsertPlan(newPlan);
    }
  }, [plans]);

  // ── Derived list content ──────────────────────────────────────────────────

  const queryLower = query.toLowerCase().trim();
  const matchesQuery = (mv: Movement) => !queryLower || mv.name.toLowerCase().includes(queryLower);

  const favMovements  = movements.filter((mv) => mv.favorite && matchesQuery(mv));
  const allFiltered   = movements.filter(matchesQuery);

  let listContent: React.ReactNode;

  if (loading) {
    listContent = <div className={s.stateMsg}>Loading…</div>;
  } else if (err) {
    listContent = <div className={s.stateErr}>{err}</div>;
  } else if (filter === "favorites") {
    listContent = favMovements.length === 0 ? (
      <div className={s.emptyWrap}>
        <p className={s.emptyTitle}>No favorites yet.</p>
        <p className={s.emptySub}>Tap ♡ on any movement to save it here.</p>
      </div>
    ) : (
      <div>
        <div className={`${s.groupLabel} ${s.favGroupLabel}`}>
          ♥ {favMovements.length} favorite{favMovements.length !== 1 ? "s" : ""}
        </div>
        <div className={s.mvList}>
          {favMovements.map((mv) => (
            <MvRow key={mv.id} mv={mv} lastSession={lastSessionMap.get(mv.id)}
              onTap={() => setSheet({ mode: "detail", mv })}
              onToggleFavorite={() => handleToggleFavorite(mv)} />
          ))}
        </div>
      </div>
    );
  } else if (queryLower) {
    listContent = allFiltered.length === 0 ? (
      <div className={s.emptyWrap}>
        <p className={s.emptyTitle}>No matches.</p>
        <p className={s.emptySub}>Try a different search.</p>
      </div>
    ) : (
      <div className={s.mvList} style={{ padding: "0 12px" }}>
        {allFiltered.map((mv) => (
          <MvRow key={mv.id} mv={mv} lastSession={lastSessionMap.get(mv.id)}
            onTap={() => setSheet({ mode: "detail", mv })}
            onToggleFavorite={() => handleToggleFavorite(mv)} />
        ))}
      </div>
    );
  } else {
    // All view: favorites pinned, then muscle groups (non-favorites only)
    const nonFavs = movements.filter((mv) => !mv.favorite);
    const grouped = groupByMuscle(nonFavs);
    listContent = movements.length === 0 ? (
      <div className={s.emptyWrap}>
        <p className={s.emptyTitle}>No movements yet.</p>
        <p className={s.emptySub}>Tap + to add your first movement.</p>
      </div>
    ) : (
      <>
        {favMovements.length > 0 && (
          <div>
            <div className={`${s.groupLabel} ${s.favGroupLabel}`}>♥ Favorites</div>
            <div className={s.mvList}>
              {favMovements.map((mv) => (
                <MvRow key={mv.id} mv={mv} lastSession={lastSessionMap.get(mv.id)}
                  onTap={() => setSheet({ mode: "detail", mv })}
                  onToggleFavorite={() => handleToggleFavorite(mv)} />
              ))}
            </div>
          </div>
        )}
        {grouped.map(({ label, items }) => (
          <div key={label}>
            <div className={s.groupLabel}>{label}</div>
            <div className={s.mvList}>
              {items.map((mv) => (
                <MvRow key={mv.id} mv={mv} lastSession={lastSessionMap.get(mv.id)}
                  onTap={() => setSheet({ mode: "detail", mv })}
                  onToggleFavorite={() => handleToggleFavorite(mv)} />
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const detailMv = sheet?.mode === "detail" ? sheet.mv : null;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.subline}>Library</div>
        <h1 className={s.headline}>Movements</h1>
      </div>

      <div className={s.searchWrap}>
        <input type="search" className={s.searchInput} placeholder="Search movements…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* Filter pills */}
      <div className={s.filterRow}>
        <button type="button"
          className={`${s.filterPill} ${filter === "all" ? s.filterPillActive : ""}`}
          onClick={() => setFilter("all")}>
          All
        </button>
        <button type="button"
          className={`${s.filterPill} ${filter === "favorites" ? s.filterPillFav : ""}`}
          onClick={() => setFilter("favorites")}>
          ♥ Favorites
        </button>
      </div>

      {listContent}

      <button type="button" className={s.fab} aria-label="Add movement"
        onClick={() => setSheet({ mode: "create" })}>+</button>

      {detailMv && (
        <DetailSheet
          mv={detailMv}
          plans={plans}
          lastSession={lastSessionMap.get(detailMv.id)}
          onEdit={() => setSheet({ mode: "edit", mv: detailMv })}
          onToggleFavorite={() => handleToggleFavorite(detailMv)}
          onTogglePlanDay={(dow) => handleTogglePlanDay(detailMv, dow)}
          onDelete={handleDelete}
          onClose={() => setSheet(null)}
        />
      )}

      {(sheet?.mode === "create" || sheet?.mode === "edit") && (
        <MvSheet
          sheet={sheet as { mode: "create" } | { mode: "edit"; mv: Movement }}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ─── Muscle badge ─────────────────────────────────────────────────────────────

const MUSCLE_BADGE: Record<string, { bg: string; label: string }> = {
  chest:      { bg: "#5d9bb8", label: "CH" },
  back:       { bg: "#7fa5c7", label: "BK" },
  shoulders:  { bg: "#9eb5cb", label: "SH" },
  biceps:     { bg: "#4f9aa8", label: "BI" },
  bicepts:    { bg: "#4f9aa8", label: "BI" },
  triceps:    { bg: "#6a8fb8", label: "TR" },
  tricepts:   { bg: "#6a8fb8", label: "TR" },
  core:       { bg: "#5a9fa8", label: "CO" },
  waist:      { bg: "#5a9fa8", label: "CO" },
  quads:      { bg: "#6ba0bc", label: "QU" },
  hamstrings: { bg: "#7a9fc2", label: "HA" },
  glutes:     { bg: "#a08090", label: "GL" },
  calves:     { bg: "#8090a8", label: "CA" },
  cardio:     { bg: "#b08092", label: "♥" },
  other:      { bg: "#8893a8", label: "OT" },
};

function MuscleBadge({ muscle }: { muscle: string }) {
  const key = muscle.toLowerCase().trim();
  const badge = MUSCLE_BADGE[key] ?? MUSCLE_BADGE.other;
  return (
    <span style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100%", height: "100%", borderRadius: "10px",
      background: badge.bg, color: "#fff",
      fontSize: badge.label === "♥" ? "20px" : "13px",
      fontWeight: 800,
      letterSpacing: badge.label === "♥" ? 0 : "0.04em",
      fontFamily: "var(--font-mono,'Geist Mono',monospace)",
    }}>{badge.label}</span>
  );
}

// ─── Movement row ─────────────────────────────────────────────────────────────

function MvRow({ mv, lastSession, onTap, onToggleFavorite }: {
  mv: Movement;
  lastSession?: LastSession;
  onTap: () => void;
  onToggleFavorite: () => void;
}) {
  const muscle = mv.muscle ?? mv.bodyPart ?? "";
  const equip  = mv.equipmentType ?? "";
  const ld     = fmtLastDone(lastSession?.date);

  return (
    <button type="button" className={s.mvRow} onClick={onTap}>
      <div className={s.mvThumb}>
        {mv.gifUrl
          ? <img src={mv.gifUrl} alt="" className={s.mvThumbImg} loading="lazy" decoding="async" />
          : <MuscleBadge muscle={muscle} />}
      </div>
      <div className={s.mvRowBody}>
        <span className={s.mvName}>{mv.name}</span>
        <div className={s.mvMeta}>
          {muscle && <span className={s.mvChip}>{muscle}</span>}
          {equip   && <span className={s.mvChip}>{equip}</span>}
        </div>
        <div className={[s.lastDone, ld.recent ? s.lastDoneRecent : "", ld.never ? s.lastDoneNever : ""].filter(Boolean).join(" ")}>
          <span className={s.lastDoneDot} />
          {ld.text}
        </div>
      </div>
      {/* Heart — stops propagation so it doesn't open the detail sheet */}
      <button
        type="button"
        className={`${s.heartBtn} ${mv.favorite ? s.heartFilled : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        aria-label={mv.favorite ? "Remove from favorites" : "Add to favorites"}
      >
        {mv.favorite ? "♥" : "♡"}
      </button>
      <span className={s.mvChevron}>›</span>
    </button>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function DetailSheet({ mv, plans, lastSession, onEdit, onToggleFavorite, onTogglePlanDay, onDelete, onClose }: {
  mv: Movement;
  plans: PlanItem[];
  lastSession?: LastSession;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onTogglePlanDay: (dow: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const muscle = mv.muscle ?? mv.bodyPart ?? "";
  const equip  = mv.equipmentType ?? "";
  const ld     = fmtLastDone(lastSession?.date);

  const plannedDays = new Set(plans.filter((p) => p.mid === mv.id).map((p) => p.dow));

  // Last session summary line
  const ldSub = lastSession ? [
    lastSession.sets > 0 ? `${lastSession.sets} set${lastSession.sets !== 1 ? "s" : ""}` : "",
    lastSession.topWeight ? `${lastSession.topWeight} lbs` : "",
    lastSession.topRpe    ? `RPE ${lastSession.topRpe}` : "",
  ].filter(Boolean).join(" · ") : "";

  const planHint = plannedDays.size > 0
    ? `In plan: ${Array.from(plannedDays).sort((a, b) => a - b).map((d) => DOW_SHORT[d]).join(" · ")}`
    : "Tap a day to add to your plan";

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={mv.name}>
        <div className={s.sheetHandle} />

        {mv.gifUrl && (
          <div className={s.gifWrap}>
            <img src={mv.gifUrl} alt={`${mv.name} demonstration`} className={s.gif} />
          </div>
        )}

        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>{mv.name}</span>
          <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Scrollable detail body — contains all content except sticky edit/delete */}
        <div className={s.detailBody}>
          {/* Last done stat card */}
          <div className={s.lastDoneStat}>
            <div className={s.ldsIcon}>{lastSession ? "🕐" : "🆕"}</div>
            <div className={s.ldsBd}>
              <span className={s.ldsLabel}>Last done</span>
              <span className={`${s.ldsVal} ${ld.never ? s.ldsValNever : ""}`}>{ld.text}</span>
              {ldSub && <span className={s.ldsSub}>{ldSub}</span>}
              {ld.never && <span className={s.ldsSub}>Log a session to start tracking</span>}
            </div>
          </div>

          {/* Favorite toggle */}
          <button
            type="button"
            className={`${s.favToggle} ${mv.favorite ? s.favToggleActive : ""}`}
            onClick={onToggleFavorite}
          >
            <span className={s.favToggleIcon}>{mv.favorite ? "♥" : "♡"}</span>
            <span className={s.favToggleText}>
              {mv.favorite ? "Saved to Favorites" : "Add to Favorites"}
            </span>
          </button>

          {(muscle || equip || mv.kind) && (
            <div className={s.mvMeta}>
              {muscle && <span className={s.mvChip}>{muscle}</span>}
              {equip  && <span className={s.mvChip}>{equip}</span>}
              {mv.kind && <span className={s.mvChip}>{mv.kind}</span>}
            </div>
          )}
          {mv.secondaryMuscles && mv.secondaryMuscles.length > 0 && (
            <div className={s.detailSection}>
              <div className={s.detailSectionLabel}>Also works</div>
              <div className={s.mvMeta}>
                {mv.secondaryMuscles.map((m) => <span key={m} className={s.mvChip}>{m}</span>)}
              </div>
            </div>
          )}
          {mv.instructions && mv.instructions.length > 0 && (
            <div className={s.detailSection}>
              <div className={s.detailSectionLabel}>How to</div>
              <ol className={s.instructionsList}>
                {mv.instructions.map((step, i) => (
                  <li key={i} className={s.instructionStep}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Inline plan day strip */}
          <div className={s.inlinePlanSec}>
            <div className={s.inlinePlanLabel}>Add to plan</div>
            <div className={s.inlineDayStrip}>
              {DOW_SHORT.map((label, dow) => {
                const planned = plannedDays.has(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    className={`${s.inlineDayChip} ${planned ? s.inlineDayChipPlanned : ""}`}
                    onClick={() => onTogglePlanDay(dow)}
                    title={DOW_FULL[dow]}
                  >
                    <span className={s.inlineDayChipLabel}>{label}</span>
                    {planned && <span className={s.inlineDayChipCheck}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div className={`${s.inlineSaveHint} ${plannedDays.size > 0 ? s.inlineSaveHintActive : ""}`}>
              {planHint}
            </div>
          </div>
        </div>

        {/* Edit / Delete */}
        <div className={s.editActions}>
          <button type="button" className={s.btnSave} onClick={onEdit}>Edit</button>
          {confirmDelete ? (
            <button type="button" className={`${s.btnDelete} ${s.btnDeleteConfirm}`}
              onClick={() => onDelete(mv.id)}>Confirm remove</button>
          ) : (
            <button type="button" className={s.btnDelete}
              onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Create / Edit sheet ──────────────────────────────────────────────────────

function MvSheet({ sheet, onSave, onDelete, onClose }: {
  sheet: { mode: "create" } | { mode: "edit"; mv: Movement };
  onSave: (mv: Movement) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const existing = sheet.mode === "edit" ? sheet.mv : null;

  const [name,   setName]   = useState(existing?.name ?? "");
  const [muscle, setMuscle] = useState(existing?.muscle ?? existing?.bodyPart ?? "");
  const [equip,  setEquip]  = useState(existing?.equipmentType ?? "");
  const [kind,   setKind]   = useState<MovementKind>(existing?.kind ?? undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  function handleSave() {
    if (!name.trim()) return;
    const mv: Movement = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      muscle: muscle || undefined,
      bodyPart: muscle || undefined,
      equipmentType: equip || undefined,
      kind: kind || undefined,
      canonicalMovement: existing?.canonicalMovement ?? name.trim(),
      gifUrl: existing?.gifUrl,
      secondaryMuscles: existing?.secondaryMuscles,
      instructions: existing?.instructions,
      favorite: existing?.favorite ?? false,
    };
    onSave(mv);
  }

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true"
        aria-label={existing ? `Edit ${existing.name}` : "New movement"}>
        <div className={s.sheetHandle} />
        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>{existing ? "Edit movement" : "New movement"}</span>
          <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={s.editForm}>
          <div className={s.editField}>
            <label className={s.editLabel}>Name</label>
            <input ref={nameRef} type="text" className={s.editInput}
              placeholder="e.g. Bench Press" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
          </div>
          <div className={s.editField}>
            <label className={s.editLabel}>Muscle / Body part</label>
            <select className={s.editSelect} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              <option value="">— Select —</option>
              {MUSCLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt.toLowerCase()}>{opt}</option>
              ))}
            </select>
          </div>
          <div className={s.editField}>
            <label className={s.editLabel}>Equipment</label>
            <select className={s.editSelect} value={equip} onChange={(e) => setEquip(e.target.value)}>
              <option value="">— Unspecified —</option>
              <option value="barbell">Barbell</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="cable">Cable</option>
              <option value="machine">Machine</option>
              <option value="bodyweight">Bodyweight</option>
            </select>
          </div>
          <div className={s.editField}>
            <label className={s.editLabel}>Type</label>
            <select className={s.editSelect} value={kind ?? ""}
              onChange={(e) => setKind((e.target.value as MovementKind) || undefined)}>
              <option value="">Strength (default)</option>
              <option value="weight">Weight-based</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
        </div>

        <div className={s.editActions}>
          <button type="button" className={s.btnSave} onClick={handleSave} disabled={!name.trim()}>
            {existing ? "Save" : "Add movement"}
          </button>
          {existing && (
            confirmDelete ? (
              <button type="button" className={`${s.btnDelete} ${s.btnDeleteConfirm}`}
                onClick={() => onDelete(existing.id)}>Confirm remove</button>
            ) : (
              <button type="button" className={s.btnDelete}
                onClick={() => setConfirmDelete(true)}>Delete</button>
            )
          )}
        </div>
      </div>
    </>
  );
}
