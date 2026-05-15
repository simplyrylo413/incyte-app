// @ts-nocheck
// Dormant scaffold component — rebuilt in Phase 7 (More / Movement Library).
// Uses the old normalized schema. ts-nocheck keeps the build green until then.
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  TRAINING_TYPES,
  type CardioSet,
  type Movement,
  type SetEntry,
  type TrainingType,
  type WeightSet,
  type WorkoutEntry,
} from "@/lib/types";

type Props = {
  movement: Movement;
  entry: WorkoutEntry;
  defaultExpanded?: boolean;
  lastEntryAt?: string | null;
  lastSets?: SetEntry[] | null;
  lastTopSet?: { weight: number; reps: number } | null;
};

const isCardio = (m: Movement) => m.kind === "cardio";
const isWeightSet = (s: SetEntry): s is WeightSet => "weight" in s && "reps" in s;
const isCardioSet = (s: SetEntry): s is CardioSet => "distance" in s && "time" in s;

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 14) return "Last week";
  return `${Math.round(diff / 7)}w ago`;
}

function setsSummary(sets: SetEntry[], m: Movement): string {
  const done = sets.filter((s) => s.done).length;
  const total = sets.length;
  if (isCardio(m)) return `${done}/${total} interval${total !== 1 ? "s" : ""}`;
  return `${done}/${total} sets`;
}

function prevForWeight(
  lastSets: SetEntry[] | null | undefined,
  i: number,
  field: "weight" | "reps"
): string {
  const s = lastSets?.[i];
  if (!s || !isWeightSet(s)) return "";
  const v = s[field];
  return v == null ? "" : String(v);
}

function prevForCardio(
  lastSets: SetEntry[] | null | undefined,
  i: number,
  field: "distance" | "time"
): string {
  const s = lastSets?.[i];
  if (!s || !isCardioSet(s)) return "";
  const v = s[field];
  return v == null ? "" : String(v);
}

// SVG chevron icons
function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function MovementCard({
  movement,
  entry,
  defaultExpanded = false,
  lastEntryAt,
  lastSets,
  lastTopSet,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [sets, setSets] = useState<SetEntry[]>(entry.sets);
  const [trainingType, setTrainingType] = useState<TrainingType>(
    entry.training_type ?? "hypertrophy"
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const summary = useMemo(() => setsSummary(sets, movement), [sets, movement]);

  // Progress delta badge vs last session top set
  const progressLabel = useMemo(() => {
    if (isCardio(movement) || !lastTopSet) return null;
    const ws = sets.filter(isWeightSet);
    const cur = ws.reduce(
      (best, s) => ((s.weight ?? 0) > (best?.weight ?? -1) ? s : best),
      null as WeightSet | null
    );
    if (!cur || cur.weight == null) return null;
    const diff = cur.weight - lastTopSet.weight;
    if (diff > 0) return { tone: "good" as const, label: `▲ +${diff}` };
    if (diff < 0) return { tone: "bad" as const, label: `▼ ${diff}` };
    return { tone: "same" as const, label: "= same" };
  }, [sets, lastTopSet, movement]);

  // Last session context string for subtitle
  const lastContext = useMemo(() => {
    if (!lastEntryAt) return null;
    if (isCardio(movement)) {
      const cs = (lastSets ?? []).filter(isCardioSet);
      const dist = cs.reduce((a, s) => a + (s.distance ?? 0), 0);
      const time = cs.reduce((a, s) => a + (s.time ?? 0), 0);
      return dist || time ? `${dist} ${movement.unit} · ${time}min` : null;
    }
    if (lastTopSet) return `${lastTopSet.weight} × ${lastTopSet.reps}`;
    return null;
  }, [lastEntryAt, lastSets, lastTopSet, movement]);

  const persist = (next: SetEntry[], nextType: TrainingType) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_entries")
        .update({
          sets: next,
          training_type: isCardio(movement) ? null : nextType,
        })
        .eq("id", entry.id);
      if (error) setError(error.message);
    });
  };

  const updateSet = (i: number, patch: Partial<SetEntry>) => {
    const next = sets.map((s, idx) =>
      idx === i ? ({ ...s, ...patch } as SetEntry) : s
    );
    setSets(next);
    persist(next, trainingType);
  };

  const toggleDone = (i: number) =>
    updateSet(i, { done: !sets[i].done } as Partial<SetEntry>);

  const addSet = () => {
    const next: SetEntry[] = [
      ...sets,
      isCardio(movement)
        ? { distance: null, time: null, done: false }
        : { weight: null, reps: null, done: false },
    ];
    setSets(next);
    persist(next, trainingType);
  };

  const deleteSet = (i: number) => {
    if (sets.length <= 1) return;
    const next = sets.filter((_, idx) => idx !== i);
    setSets(next);
    persist(next, trainingType);
  };

  const removeMovement = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_entries")
        .delete()
        .eq("id", entry.id);
      if (error) setError(error.message);
      else router.refresh();
    });
  };

  const allDone = sets.length > 0 && sets.every((s) => s.done);

  return (
    <section className="rounded-lg border border-line bg-panel">
      <header className="flex items-center gap-2 px-4 py-3">
        {/* Expand / collapse toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-3 text-left min-w-0"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${movement.name}`}
        >
          <span className={`flex-shrink-0 ${allDone ? "text-good" : "text-sub"}`}>
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </span>

          <div className="min-w-0 flex-1">
            {/* Row 1: name + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${allDone ? "text-good" : "text-ink"}`}>
                {movement.name}
              </span>

              {isCardio(movement) ? (
                <span className="rounded bg-panel2 px-1.5 py-0.5 text-xs text-sub">
                  cardio · {movement.unit}
                </span>
              ) : (
                <span className="rounded bg-panel2 px-1.5 py-0.5 text-xs text-sub capitalize">
                  {trainingType}
                </span>
              )}

              {/* Progress delta pill */}
              {progressLabel ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    progressLabel.tone === "good"
                      ? "bg-good/15 text-good"
                      : progressLabel.tone === "bad"
                        ? "bg-bad/15 text-bad"
                        : "bg-panel2 text-sub"
                  }`}
                >
                  {progressLabel.label}
                </span>
              ) : null}
            </div>

            {/* Row 2: sets count + last session */}
            <div className="mt-0.5 text-xs text-sub">
              <span className={allDone ? "text-good" : ""}>{summary}</span>
              {lastEntryAt ? (
                <>
                  {" · "}
                  {relativeDate(lastEntryAt)}
                  {lastContext ? ` · ${lastContext}` : ""}
                </>
              ) : (
                <> · no prior log</>
              )}
            </div>
          </div>
        </button>

        {/* Remove button — inline confirm to avoid accidental taps */}
        <div className="flex-shrink-0">
          {confirmRemove ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-sub">Remove?</span>
              <button
                onClick={() => setConfirmRemove(false)}
                className="rounded px-2 py-1.5 text-xs text-sub hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={removeMovement}
                disabled={pending}
                className="rounded bg-bad/10 px-2.5 py-1.5 text-xs font-medium text-bad hover:bg-bad/20"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={pending}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-sub hover:text-bad"
              aria-label={`Remove ${movement.name} from workout`}
            >
              <XIcon />
            </button>
          )}
        </div>
      </header>

      {expanded ? (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {/* Training type — pill buttons instead of native select */}
          {!isCardio(movement) ? (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-sub">Type:</span>
              {TRAINING_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTrainingType(t);
                    persist(sets, t);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs capitalize transition-colors ${
                    trainingType === t
                      ? "bg-ink text-bg"
                      : "border border-line text-sub hover:border-ink hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}

          {/* Sets table */}
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-sub">
                <th className="w-8 pb-2">#</th>
                {isCardio(movement) ? (
                  <>
                    <th className="pb-2">Dist ({movement.unit})</th>
                    <th className="pb-2">Min</th>
                  </>
                ) : (
                  <>
                    <th className="pb-2">Weight</th>
                    <th className="pb-2">Reps</th>
                  </>
                )}
                <th className="w-14 pb-2 text-center">Done</th>
                <th className="w-12 pb-2" />
              </tr>
            </thead>
            <tbody>
              {sets.map((s, i) => (
                <tr
                  key={i}
                  className={`border-t border-line transition-opacity ${
                    s.done ? "opacity-50" : ""
                  }`}
                >
                  <td className="py-2 text-sub">{i + 1}</td>

                  {isCardio(movement) ? (
                    <>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={(s as CardioSet).distance ?? ""}
                          onChange={(e) =>
                            updateSet(i, {
                              distance:
                                e.target.value === "" ? null : Number(e.target.value),
                            } as Partial<CardioSet>)
                          }
                          placeholder={prevForCardio(lastSets, i, "distance")}
                          className="w-full"
                          aria-label={`Set ${i + 1} distance`}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={(s as CardioSet).time ?? ""}
                          onChange={(e) =>
                            updateSet(i, {
                              time:
                                e.target.value === "" ? null : Number(e.target.value),
                            } as Partial<CardioSet>)
                          }
                          placeholder={prevForCardio(lastSets, i, "time")}
                          className="w-full"
                          aria-label={`Set ${i + 1} duration in minutes`}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          value={(s as WeightSet).weight ?? ""}
                          onChange={(e) =>
                            updateSet(i, {
                              weight:
                                e.target.value === "" ? null : Number(e.target.value),
                            } as Partial<WeightSet>)
                          }
                          placeholder={prevForWeight(lastSets, i, "weight")}
                          className="w-full"
                          aria-label={`Set ${i + 1} weight`}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={(s as WeightSet).reps ?? ""}
                          onChange={(e) =>
                            updateSet(i, {
                              reps:
                                e.target.value === "" ? null : Number(e.target.value),
                            } as Partial<WeightSet>)
                          }
                          placeholder={prevForWeight(lastSets, i, "reps")}
                          className="w-full"
                          aria-label={`Set ${i + 1} reps`}
                        />
                      </td>
                    </>
                  )}

                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => toggleDone(i)}
                      aria-label={`Mark set ${i + 1} as done`}
                    />
                  </td>

                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteSet(i)}
                      disabled={sets.length <= 1}
                      className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded text-sub hover:text-bad disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Delete set ${i + 1}`}
                    >
                      <XIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={addSet}
              className="rounded-md border border-line px-3 py-2 text-xs text-sub hover:border-ink hover:text-ink"
            >
              + Add {isCardio(movement) ? "interval" : "set"}
            </button>
            <div className="flex items-center gap-2">
              {error ? <span className="text-xs text-bad">{error}</span> : null}
              {pending ? <span className="text-xs text-sub">saving…</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
