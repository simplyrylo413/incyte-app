"use client";

// Shared movement-picker bottom sheet.
// Used on Today (add to session) and Plan (add to day).
// Features: search, body-part groups, Favorites tab, heart toggle.

import { useEffect, useRef, useState } from "react";
import { toggleMovementFavorite } from "@/lib/db";
import type { Movement } from "@/lib/types";
import s from "./MovementPickerSheet.module.css";

const BODY_PART_ORDER = [
  "Chest", "Back", "Shoulders", "Biceps",
  "Triceps", "Core", "Quads", "Hamstrings",
  "Glutes", "Calves", "Cardio", "Other",
];

type Filter = "all" | "favorites";

interface Props {
  title: string;
  movements: Movement[];
  /** Movement IDs already in the session / day — hidden from the list */
  excludeMids?: Set<string>;
  onAdd: (mv: Movement) => void;
  onClose: () => void;
  /** Called after a favorite is toggled so the parent can update its movements state */
  onFavoriteToggled?: (id: string, next: boolean) => void;
}

export default function MovementPickerSheet({
  title,
  movements,
  excludeMids,
  onAdd,
  onClose,
  onFavoriteToggled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Local copy so we can optimistically toggle favorites without refetching
  const [localMovements, setLocalMovements] = useState<Movement[]>(movements);

  // Sync when parent list changes (e.g. parent re-fetches after a toggle on another screen)
  useEffect(() => { setLocalMovements(movements); }, [movements]);

  // Auto-focus search
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function handleToggleFavorite(e: React.MouseEvent, mv: Movement) {
    e.stopPropagation();
    const next = !mv.favorite;
    // Optimistic update — immediate UI response
    setLocalMovements((prev) =>
      prev.map((m) => m.id === mv.id ? { ...m, favorite: next } : m)
    );
    await toggleMovementFavorite(mv.id, next);
    // Notify parent so its movements state stays in sync — prevents stale
    // favorites when the picker is closed and reopened without a page refresh
    onFavoriteToggled?.(mv.id, next);
  }

  // Apply exclude + filter + search
  const pool = localMovements.filter((mv) => {
    if (excludeMids?.has(mv.id)) return false;
    if (filter === "favorites" && !mv.favorite) return false;
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

  // Count all favorites regardless of excludeMids — the badge shows how many exist total
  const favCount = localMovements.filter((m) => m.favorite).length;

  return (
    <>
      <div className={s.overlay} onClick={onClose} aria-hidden="true" />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.handle} />

        {/* Header */}
        <div className={s.head}>
          <span className={s.headTitle}>{title}</span>
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Filter tabs */}
        <div className={s.tabs}>
          <button
            className={`${s.tab} ${filter === "all" ? s.tabActive : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`${s.tab} ${filter === "favorites" ? s.tabActive : ""}`}
            onClick={() => setFilter("favorites")}
          >
            ♥ Favorites
            {favCount > 0 && <span className={s.tabBadge}>{favCount}</span>}
          </button>
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
                {filter === "favorites" ? "No favorites match." : "No movements match."}
              </div>
            ) : (
              pool.map((mv) => (
                <PickerRow
                  key={mv.id}
                  mv={mv}
                  onPick={() => onAdd(mv)}
                  onToggleFav={(e) => handleToggleFavorite(e, mv)}
                />
              ))
            )
          ) : grouped.length === 0 ? (
            <div className={s.empty}>
              {filter === "favorites"
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
                    onPick={() => onAdd(mv)}
                    onToggleFav={(e) => handleToggleFavorite(e, mv)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
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
      {/* Name + equip — tappable but not the primary CTA */}
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
