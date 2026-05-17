"use client";

// Shared movement-picker bottom sheet.
// Used on Today (add to session) and Plan (add to day).
// Features: search, body-part groups, Favorites tab, heart toggle.
// Plan mode: when onAddToPlan is provided, tapping "+ Add" opens an inline
// day-picker step before confirming. defaultDow pre-selects the day.

import { useEffect, useRef, useState } from "react";
import { toggleMovementFavorite } from "@/lib/db";
import type { Movement } from "@/lib/types";
import s from "./MovementPickerSheet.module.css";

const BODY_PART_ORDER = [
  "Chest", "Back", "Shoulders", "Biceps",
  "Triceps", "Core", "Quads", "Hamstrings",
  "Glutes", "Calves", "Cardio", "Other",
];

const BODY_PART_PILLS = [
  { key: "chest",      label: "Chest" },
  { key: "back",       label: "Back" },
  { key: "shoulders",  label: "Shoulders" },
  { key: "biceps",     label: "Biceps" },
  { key: "triceps",    label: "Triceps" },
  { key: "core",       label: "Core" },
  { key: "quads",      label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes",     label: "Glutes" },
  { key: "calves",     label: "Calves" },
  { key: "cardio",     label: "Cardio" },
];

function matchesBP(mv: Movement, key: string): boolean {
  const bp = (mv.bodyPart ?? mv.muscle ?? "other").toLowerCase();
  if (key === "biceps")  return bp === "biceps"  || bp === "bicepts";
  if (key === "triceps") return bp === "triceps" || bp === "tricepts";
  return bp === key;
}

const DOW_SHORT  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DOW_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  title: string;
  movements: Movement[];
  /** Movement IDs already in the session / day — hidden from the list */
  excludeMids?: Set<string>;
  /** Session-add callback (Today page). When provided, rows show "+ Add" that calls this directly. */
  onAdd?: (mv: Movement) => void;
  /** Plan-add callback (Plan page). When provided, tapping "+ Add" opens the day-picker step. */
  onAddToPlan?: (mv: Movement, dow: number) => void;
  /** Pre-selects a day in the day-picker step (0=Sun…6=Sat). Defaults to today. */
  defaultDow?: number;
  onClose: () => void;
  /** Called after a favorite is toggled so the parent can update its movements state */
  onFavoriteToggled?: (id: string, next: boolean) => void;
}

export default function MovementPickerSheet({
  title,
  movements,
  excludeMids,
  onAdd,
  onAddToPlan,
  defaultDow,
  onClose,
  onFavoriteToggled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery]               = useState("");
  const [bodyPart, setBodyPart]         = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Day-picker step state (plan mode only)
  const [pendingMv, setPendingMv] = useState<Movement | null>(null);
  const [pendingDow, setPendingDow] = useState<number>(
    defaultDow ?? new Date().getDay()
  );

  // Local copy so we can optimistically toggle favorites without refetching
  const [localMovements, setLocalMovements] = useState<Movement[]>(movements);

  // Sync when parent list changes
  useEffect(() => { setLocalMovements(movements); }, [movements]);

  // Auto-focus search (only when not in day-picker step)
  useEffect(() => {
    if (pendingMv) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [pendingMv]);

  async function handleToggleFavorite(e: React.MouseEvent, mv: Movement) {
    e.stopPropagation();
    const next = !mv.favorite;
    setLocalMovements((prev) =>
      prev.map((m) => m.id === mv.id ? { ...m, favorite: next } : m)
    );
    await toggleMovementFavorite(mv.id, next);
    onFavoriteToggled?.(mv.id, next);
  }

  function handlePick(mv: Movement) {
    if (onAddToPlan) {
      // Plan mode: show day-picker step
      setPendingMv(mv);
      setPendingDow(defaultDow ?? new Date().getDay());
    } else {
      onAdd?.(mv);
    }
  }

  function handleConfirmDay() {
    if (!pendingMv) return;
    onAddToPlan!(pendingMv, pendingDow);
    setPendingMv(null);
  }

  // Apply exclude + body part + favorites + search
  const pool = localMovements.filter((mv) => {
    if (excludeMids?.has(mv.id)) return false;
    if (favoritesOnly && !mv.favorite) return false;
    if (bodyPart && !matchesBP(mv, bodyPart)) return false;
    if (query.trim()) return mv.name.toLowerCase().includes(query.toLowerCase());
    return true;
  });

  // Build grouped list (only when not searching)
  const grouped: Array<{ label: string; items: Movement[] }> = [];
  if (!query.trim()) {
    const map = new Map<string, Movement[]>();
    for (const mv of pool) {
      const raw = (mv.bodyPart ?? mv.muscle ?? "other").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(mv);
    }
    for (const label of BODY_PART_ORDER) {
      const items = map.get(label);
      if (items?.length) { map.delete(label); grouped.push({ label, items }); }
    }
    for (const [label, items] of map) grouped.push({ label, items });
  }

  const favCount = localMovements.filter((m) => m.favorite && !excludeMids?.has(m.id)).length;

  return (
    <>
      <div className={s.overlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.handle} />

        {/* Header */}
        <div className={s.head}>
          <span className={s.headTitle}>
            {pendingMv ? pendingMv.name : title}
          </span>
          <button type="button" className={s.closeBtn}
            onClick={pendingMv ? () => setPendingMv(null) : onClose}
            aria-label={pendingMv ? "Back" : "Close"}>
            {pendingMv ? "‹" : "✕"}
          </button>
        </div>

        {pendingMv ? (
          /* ── Day-picker step ── */
          <div className={s.dayPickStep}>
            <div className={s.dayPickLabel}>Which day?</div>
            <div className={s.dayPickRow}>
              {DOW_SHORT.map((label, dow) => (
                <button
                  key={dow}
                  type="button"
                  className={`${s.dayPickPill} ${pendingDow === dow ? s.dayPickPillOn : ""}`}
                  onClick={() => setPendingDow(dow)}
                  title={DOW_FULL[dow]}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={s.dayPickConfirmRow}>
              <button type="button" className={s.dayPickCancel}
                onClick={() => setPendingMv(null)}>
                Back
              </button>
              <button type="button" className={s.dayPickConfirm}
                onClick={handleConfirmDay}>
                Add to {DOW_FULL[pendingDow]}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Filter pills — horizontally scrollable */}
            <div className={s.pillRow}>
              <button type="button"
                className={`${s.pill} ${!bodyPart && !favoritesOnly ? s.pillActive : ""}`}
                onClick={() => { setBodyPart(null); setFavoritesOnly(false); }}>
                All
              </button>
              <button type="button"
                className={`${s.pill} ${favoritesOnly ? s.pillFavActive : s.pillFav}`}
                onClick={() => setFavoritesOnly(!favoritesOnly)}>
                ♥{favCount > 0 ? ` Favorites (${favCount})` : " Favorites"}
              </button>
              {BODY_PART_PILLS.map(({ key, label }) => (
                <button key={key} type="button"
                  className={`${s.pill} ${bodyPart === key ? s.pillActive : ""}`}
                  onClick={() => setBodyPart(bodyPart === key ? null : key)}>
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className={s.searchWrap}>
              <input
                ref={inputRef}
                type="search"
                className={s.searchInput}
                placeholder="Search movements…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* List */}
            <div className={s.list}>
              {query.trim() ? (
                pool.length === 0 ? (
                  <div className={s.empty}>
                    {favoritesOnly && !bodyPart ? "No favorites match." : "No movements match."}
                  </div>
                ) : (
                  pool.map((mv) => (
                    <PickerRow
                      key={mv.id}
                      mv={mv}
                      onPick={() => handlePick(mv)}
                      onToggleFav={(e) => handleToggleFavorite(e, mv)}
                    />
                  ))
                )
              ) : grouped.length === 0 ? (
                <div className={s.empty}>
                  {favoritesOnly && !bodyPart
                    ? "No favorites yet. Tap ♥ on any movement to save it."
                    : "No movements available."}
                </div>
              ) : (
                grouped.map(({ label, items }) => (
                  <div key={label}>
                    <div className={s.groupLabel}>{label}</div>
                    {items.map((mv) => (
                      <PickerRow
                        key={mv.id}
                        mv={mv}
                        onPick={() => handlePick(mv)}
                        onToggleFav={(e) => handleToggleFavorite(e, mv)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PickerRow({
  mv,
  onPick,
  onToggleFav,
}: {
  mv: Movement;
  onPick: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}) {
  return (
    <div className={s.row}>
      {/* Name + equip — display only */}
      <div className={s.rowBody}>
        <span className={s.rowName}>{mv.name}</span>
        {mv.equipmentType && (
          <span className={s.rowEquip}>{mv.equipmentType}</span>
        )}
      </div>
      {/* Favorite heart */}
      <button
        type="button"
        className={`${s.favBtn} ${mv.favorite ? s.favOn : ""}`}
        onClick={onToggleFav}
        aria-label={mv.favorite ? "Remove from favorites" : "Add to favorites"}
      >
        {mv.favorite ? "♥" : "♡"}
      </button>
      {/* Ghost add button */}
      <button
        type="button"
        className={s.rowAddBtn}
        onClick={onPick}
        aria-label={`Add ${mv.name}`}
      >
        + Add
      </button>
    </div>
  );
}
