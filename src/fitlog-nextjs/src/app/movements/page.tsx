"use client";

// Phase 7 Movement Library screen.
// Visual parity target: src/fitlog-mobile.html #view-movements (mobile351 baseline).
// Features: search, group by muscle, tap to edit, FAB to create, two-tap delete.

import { useCallback, useEffect, useRef, useState } from "react";
import { listMovements, upsertMovement, deleteMovement, importExercisesFromDB } from "@/lib/db";
import type { Movement, MovementKind } from "@/lib/types";
import s from "./MovementsPage.module.css";

const MUSCLE_OPTIONS = [
  "Chest","Back","Shoulders","Biceps","Triceps",
  "Core","Quads","Hamstrings","Glutes","Calves","Cardio","Other",
];

const MUSCLE_ORDER = [
  "chest","back","shoulders","biceps","bicepts","triceps","tricepts",
  "core","quads","hamstrings","glutes","calves","cardio","other",
];

type Sheet =
  | { mode: "create" }
  | { mode: "edit"; mv: Movement }
  | null;

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MovementsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const mv = await listMovements();
      setMovements(mv);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportMsg(null);
    const count = await importExercisesFromDB();
    if (count < 0) {
      setImportMsg("Import failed — check console for details.");
    } else if (count === 0) {
      setImportMsg("Import ran but 0 exercises were added. Check Supabase edge function logs.");
    } else {
      setImportMsg(`Added ${count} exercises to your library.`);
      await load();
    }
    setImporting(false);
  }, [load]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (mv: Movement) => {
    setMovements((prev) => {
      const idx = prev.findIndex((m) => m.id === mv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = mv;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      }
      return [...prev, mv].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSheet(null);
    const ok = await upsertMovement(mv);
    if (!ok) setErr("Save failed — check console for details.");
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setMovements((prev) => prev.filter((m) => m.id !== id));
    setSheet(null);
    await deleteMovement(id);
  }, []);

  // ── Filtered + grouped ────────────────────────────────────────────────────

  const filtered = movements.filter((mv) =>
    !query.trim() || mv.name.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = groupByMuscle(filtered);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.subline}>Library</div>
        <h1 className={s.headline}>Movements</h1>
      </div>

      <div className={s.searchWrap}>
        <input
          type="search"
          className={s.searchInput}
          placeholder="Search movements…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={s.importBar}>
        <button
          type="button"
          className={s.importBtn}
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? "Importing…" : "⬇ Import from ExerciseDB"}
        </button>
        {importMsg && (
          <span className={s.importMsg}>{importMsg}</span>
        )}
      </div>

      {loading ? (
        <div className={s.stateMsg}>Loading…</div>
      ) : err ? (
        <div className={s.stateErr}>{err}</div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyWrap}>
          <p className={s.emptyTitle}>
            {query ? "No matches." : "No movements yet."}
          </p>
          <p className={s.emptySub}>
            {query ? "Try a different search." : "Tap + to add your first movement."}
          </p>
        </div>
      ) : (
        grouped.map(({ label, items }) => (
          <div key={label}>
            <div className={s.groupLabel}>{label}</div>
            <div className={s.mvList}>
              {items.map((mv) => (
                <MvRow
                  key={mv.id}
                  mv={mv}
                  onTap={() => setSheet({ mode: "edit", mv })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        className={s.fab}
        aria-label="Add movement"
        onClick={() => setSheet({ mode: "create" })}
      >
        +
      </button>

      {sheet && (
        <MvSheet
          sheet={sheet}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ─── Movement row ─────────────────────────────────────────────────────────────

function MvRow({ mv, onTap }: { mv: Movement; onTap: () => void }) {
  const muscle = mv.muscle ?? mv.bodyPart ?? "";
  const equip = mv.equipmentType ?? "";

  return (
    <button type="button" className={s.mvRow} onClick={onTap}>
      <div className={s.mvRowBody}>
        <span className={s.mvName}>{mv.name}</span>
        <div className={s.mvMeta}>
          {muscle && <span className={s.mvChip}>{muscle}</span>}
          {equip && <span className={s.mvChip}>{equip}</span>}
          {mv.kind && <span className={s.mvChip}>{mv.kind}</span>}
        </div>
      </div>
      <span className={s.mvChevron}>›</span>
    </button>
  );
}

// ─── Create / Edit sheet ──────────────────────────────────────────────────────

function MvSheet({
  sheet,
  onSave,
  onDelete,
  onClose,
}: {
  sheet: NonNullable<Sheet>;
  onSave: (mv: Movement) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const existing = sheet.mode === "edit" ? sheet.mv : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [muscle, setMuscle] = useState(existing?.muscle ?? existing?.bodyPart ?? "");
  const [equip, setEquip] = useState(existing?.equipmentType ?? "");
  const [kind, setKind] = useState<MovementKind>(existing?.kind ?? undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  function handleSave() {
    if (!name.trim()) return;
    const mv: Movement = {
      id: existing?.id ?? `mv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      muscle: muscle || undefined,
      bodyPart: muscle || undefined,
      equipmentType: equip || undefined,
      kind: kind || undefined,
      canonicalMovement: existing?.canonicalMovement ?? name.trim(),
    };
    onSave(mv);
  }

  return (
    <>
      <div className={s.sheetOverlay} onClick={onClose} aria-hidden="true" />
      <div
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={existing ? `Edit ${existing.name}` : "New movement"}
      >
        <div className={s.sheetHandle} />
        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>
            {existing ? "Edit movement" : "New movement"}
          </span>
          <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={s.editForm}>
          <div className={s.editField}>
            <label className={s.editLabel}>Name</label>
            <input
              ref={nameRef}
              type="text"
              className={s.editInput}
              placeholder="e.g. Bench Press"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          <div className={s.editField}>
            <label className={s.editLabel}>Muscle / Body part</label>
            <select
              className={s.editSelect}
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
            >
              <option value="">— Select —</option>
              {MUSCLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt.toLowerCase()}>{opt}</option>
              ))}
            </select>
          </div>

          <div className={s.editField}>
            <label className={s.editLabel}>Equipment</label>
            <select
              className={s.editSelect}
              value={equip}
              onChange={(e) => setEquip(e.target.value)}
            >
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
            <select
              className={s.editSelect}
              value={kind ?? ""}
              onChange={(e) => setKind((e.target.value as MovementKind) || undefined)}
            >
              <option value="">Strength (default)</option>
              <option value="weight">Weight-based</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
        </div>

        <div className={s.editActions}>
          <button
            type="button"
            className={s.btnSave}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {existing ? "Save" : "Add movement"}
          </button>

          {existing && (
            confirmDelete ? (
              <button
                type="button"
                className={`${s.btnDelete} ${s.btnDeleteConfirm}`}
                onClick={() => onDelete(existing.id)}
              >
                Confirm remove
              </button>
            ) : (
              <button
                type="button"
                className={s.btnDelete}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByMuscle(
  movements: Movement[]
): Array<{ label: string; items: Movement[] }> {
  const map = new Map<string, Movement[]>();
  for (const mv of movements) {
    const key = (mv.muscle ?? mv.bodyPart ?? "other").toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(mv);
  }

  const result: Array<{ label: string; items: Movement[] }> = [];
  for (const key of MUSCLE_ORDER) {
    const items = map.get(key);
    if (items?.length) {
      map.delete(key);
      result.push({ label: key.charAt(0).toUpperCase() + key.slice(1), items });
    }
  }
  for (const [key, items] of map) {
    result.push({ label: key.charAt(0).toUpperCase() + key.slice(1), items });
  }
  return result;
}
