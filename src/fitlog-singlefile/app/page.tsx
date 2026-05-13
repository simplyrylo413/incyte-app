"use client";

import { useEffect, useMemo, useState } from "react";

// ==================== Types ====================

type MovementKind = "weight" | "cardio";
type CardioUnit = "mi" | "km" | "m";
type TrainingType =
  | "strength"
  | "hypertrophy"
  | "power"
  | "mobility"
  | "endurance";

const TRAINING_TYPES: TrainingType[] = [
  "strength",
  "hypertrophy",
  "power",
  "mobility",
  "endurance",
];

type Movement = {
  id: string;
  name: string;
  kind: MovementKind;
  unit?: CardioUnit;
};

type WeightSet = { weight: number | null; reps: number | null; done: boolean };
type CardioSet = { distance: number | null; time: number | null; done: boolean };
type SetEntry = WeightSet | CardioSet;

type WorkoutEntry = {
  id: string;
  movementId: string;
  trainingType: TrainingType | null;
  sets: SetEntry[];
};

type Workout = {
  id: string;
  date: string; // YYYY-MM-DD
  finished: boolean;
  entries: WorkoutEntry[];
};

type AppData = { movements: Movement[]; workouts: Workout[] };
type Tab = "today" | "movements" | "history" | "progress";

// ==================== Helpers ====================

const STORAGE_KEY = "fitlog_data_v1";

// Stable seed IDs so SSR and CSR produce identical first-render HTML.
const SEED: AppData = {
  movements: [
    { id: "m-back-squat", name: "Back squat", kind: "weight" },
    { id: "m-bench-press", name: "Bench press", kind: "weight" },
    { id: "m-deadlift", name: "Deadlift", kind: "weight" },
    { id: "m-overhead-press", name: "Overhead press", kind: "weight" },
    { id: "m-pull-up", name: "Pull-up", kind: "weight" },
    { id: "m-row", name: "Barbell row", kind: "weight" },
    { id: "m-run", name: "Run", kind: "cardio", unit: "mi" },
    { id: "m-swim", name: "Swimming", kind: "cardio", unit: "m" },
  ],
  workouts: [],
};

const uid = () => Math.random().toString(36).slice(2, 11);
const today = () => new Date().toISOString().slice(0, 10);
const isWeight = (s: SetEntry): s is WeightSet => "weight" in s && "reps" in s;
const isCardioSet = (s: SetEntry): s is CardioSet =>
  "distance" in s && "time" in s;
const isCardio = (m: Movement) => m.kind === "cardio";

function loadData(): AppData {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed?.movements || !parsed?.workouts) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

function saveData(data: AppData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota / privacy mode — skip
  }
}

function defaultSetsFor(m: Movement): SetEntry[] {
  if (isCardio(m)) return [{ distance: null, time: null, done: false }];
  return [
    { weight: null, reps: null, done: false },
    { weight: null, reps: null, done: false },
    { weight: null, reps: null, done: false },
  ];
}

function topSet(sets: SetEntry[]): WeightSet | null {
  let best: WeightSet | null = null;
  for (const s of sets) {
    if (!isWeight(s)) continue;
    if ((s.weight ?? -Infinity) > (best?.weight ?? -Infinity)) best = s;
  }
  return best;
}

const totalDistance = (sets: SetEntry[]) =>
  sets.filter(isCardioSet).reduce((a, s) => a + (s.distance ?? 0), 0);

function findLastEntry(
  workouts: Workout[],
  movementId: string,
  excludeId?: string
): { date: string; entry: WorkoutEntry } | null {
  const sorted = [...workouts]
    .filter((w) => w.finished && w.id !== excludeId)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const e = w.entries.find((x) => x.movementId === movementId);
    if (e) return { date: w.date, entry: e };
  }
  return null;
}

// ==================== Main page ====================

export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<AppData>(SEED);
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    setData(loadData());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveData(data);
  }, [data, hydrated]);

  const update = (mut: (d: AppData) => AppData) =>
    setData((d) => mut({ ...d }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">fitlog</h1>
          <nav className="flex gap-1 text-sm">
            {(["today", "movements", "history", "progress"] as Tab[]).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    tab === t
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === "today" && <TodayView data={data} update={update} />}
        {tab === "movements" && <MovementsView data={data} update={update} />}
        {tab === "history" && <HistoryView data={data} update={update} />}
        {tab === "progress" && <ProgressView data={data} />}
      </main>
    </div>
  );
}

// ==================== Today ====================

function TodayView({
  data,
  update,
}: {
  data: AppData;
  update: (mut: (d: AppData) => AppData) => void;
}) {
  const td = today();
  const workout = data.workouts.find((w) => w.date === td && !w.finished);

  const startWorkout = () => {
    update((d) => ({
      ...d,
      workouts: [
        ...d.workouts,
        { id: uid(), date: td, finished: false, entries: [] },
      ],
    }));
  };

  const movementsById = useMemo(
    () => new Map(data.movements.map((m) => [m.id, m])),
    [data.movements]
  );

  if (!workout) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="mb-4 text-sm text-slate-400">No workout for {td} yet.</p>
        <button
          onClick={startWorkout}
          className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
        >
          Start today's workout
        </button>
      </div>
    );
  }

  const remainingMovements = data.movements.filter(
    (m) => !workout.entries.some((e) => e.movementId === m.id)
  );

  const addMovement = (m: Movement) => {
    update((d) => ({
      ...d,
      workouts: d.workouts.map((w) =>
        w.id === workout.id
          ? {
              ...w,
              entries: [
                ...w.entries,
                {
                  id: uid(),
                  movementId: m.id,
                  trainingType: isCardio(m) ? null : "hypertrophy",
                  sets: defaultSetsFor(m),
                },
              ],
            }
          : w
      ),
    }));
  };

  const updateEntry = (
    entryId: string,
    mut: (e: WorkoutEntry) => WorkoutEntry
  ) => {
    update((d) => ({
      ...d,
      workouts: d.workouts.map((w) =>
        w.id !== workout.id
          ? w
          : {
              ...w,
              entries: w.entries.map((e) => (e.id === entryId ? mut(e) : e)),
            }
      ),
    }));
  };

  const removeEntry = (entryId: string) => {
    update((d) => ({
      ...d,
      workouts: d.workouts.map((w) =>
        w.id !== workout.id
          ? w
          : { ...w, entries: w.entries.filter((e) => e.id !== entryId) }
      ),
    }));
  };

  const finish = () => {
    update((d) => ({
      ...d,
      workouts: d.workouts.map((w) =>
        w.id === workout.id ? { ...w, finished: true } : w
      ),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Today</h2>
          <p className="text-sm text-slate-400">{workout.date}</p>
        </div>
        <button
          onClick={finish}
          disabled={workout.entries.length === 0}
          className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          Finish workout
        </button>
      </div>

      {workout.entries.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          No movements yet. Add one below.
        </p>
      ) : (
        <ul className="space-y-3">
          {workout.entries.map((e) => {
            const m = movementsById.get(e.movementId);
            if (!m) return null;
            const last = findLastEntry(data.workouts, m.id, workout.id);
            return (
              <EntryCard
                key={e.id}
                movement={m}
                entry={e}
                lastDate={last?.date ?? null}
                lastSets={last?.entry.sets ?? null}
                onUpdate={(mut) => updateEntry(e.id, mut)}
                onRemove={() => removeEntry(e.id)}
              />
            );
          })}
        </ul>
      )}

      <AddMovementBar
        candidates={remainingMovements}
        onAdd={addMovement}
        disabled={remainingMovements.length === 0}
      />
    </div>
  );
}

function AddMovementBar({
  candidates,
  onAdd,
  disabled,
}: {
  candidates: Movement[];
  onAdd: (m: Movement) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  if (disabled)
    return (
      <p className="text-center text-xs text-slate-500">
        All movements added.
      </p>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
      >
        + Add movement
      </button>
    );

  const filtered = candidates.filter((m) =>
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          placeholder="Search movements"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm placeholder-slate-500 outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => {
            setOpen(false);
            setFilter("");
          }}
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          cancel
        </button>
      </div>
      <ul className="max-h-64 overflow-auto">
        {filtered.length === 0 ? (
          <li className="py-3 text-center text-sm text-slate-500">
            No matches.
          </li>
        ) : (
          filtered.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => {
                  onAdd(m);
                  setOpen(false);
                  setFilter("");
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-slate-800"
              >
                <span>{m.name}</span>
                <span className="text-xs text-slate-500">
                  {m.kind === "cardio" ? `cardio · ${m.unit}` : "weight"}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function EntryCard({
  movement,
  entry,
  lastDate,
  lastSets,
  onUpdate,
  onRemove,
}: {
  movement: Movement;
  entry: WorkoutEntry;
  lastDate: string | null;
  lastSets: SetEntry[] | null;
  onUpdate: (mut: (e: WorkoutEntry) => WorkoutEntry) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cardio = isCardio(movement);
  const cur = topSet(entry.sets);
  const prev = lastSets ? topSet(lastSets) : null;
  const diff =
    cur && prev && cur.weight != null && prev.weight != null
      ? cur.weight - prev.weight
      : null;

  const summary = cardio
    ? `${entry.sets.filter((s) => s.done).length}/${entry.sets.length} · ${totalDistance(entry.sets).toFixed(1)} ${movement.unit}`
    : `${entry.sets.filter((s) => s.done).length}/${entry.sets.length} · top ${cur?.weight ?? 0}×${cur?.reps ?? 0}`;

  const updateSet = (i: number, patch: Partial<SetEntry>) =>
    onUpdate((e) => ({
      ...e,
      sets: e.sets.map((x, idx) =>
        idx === i ? ({ ...x, ...patch } as SetEntry) : x
      ),
    }));

  return (
    <li className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="text-slate-500">{expanded ? "▾" : "▸"}</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{movement.name}</span>
              {cardio ? (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                  cardio · {movement.unit}
                </span>
              ) : (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                  {entry.trainingType ?? "—"}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {summary}
              {lastDate ? ` · last: ${lastDate}` : " · no prior log"}
              {diff !== null && diff !== 0 && (
                <span
                  className={
                    diff > 0 ? " text-emerald-400" : " text-rose-400"
                  }
                >
                  {" · "}
                  {diff > 0 ? `▲ +${diff}` : `▼ ${diff}`}
                </span>
              )}
            </div>
          </div>
        </button>
        <button
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              window.confirm(`Remove ${movement.name}?`)
            )
              onRemove();
          }}
          className="text-xs text-slate-500 hover:text-rose-400"
        >
          remove
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3">
          {!cardio && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <label className="text-slate-400">Training type</label>
              <select
                value={entry.trainingType ?? "hypertrophy"}
                onChange={(ev) =>
                  onUpdate((e) => ({
                    ...e,
                    trainingType: ev.target.value as TrainingType,
                  }))
                }
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
              >
                {TRAINING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="w-8 text-left">#</th>
                {cardio ? (
                  <>
                    <th className="text-left">Dist ({movement.unit})</th>
                    <th className="text-left">Min</th>
                  </>
                ) : (
                  <>
                    <th className="text-left">Weight</th>
                    <th className="text-left">Reps</th>
                  </>
                )}
                <th className="w-12 text-center">Done</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {entry.sets.map((s, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="py-2 text-slate-500">{i + 1}</td>
                  {cardio ? (
                    <>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={(s as CardioSet).distance ?? ""}
                          onChange={(ev) =>
                            updateSet(i, {
                              distance:
                                ev.target.value === ""
                                  ? null
                                  : Number(ev.target.value),
                            } as Partial<CardioSet>)
                          }
                          className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={(s as CardioSet).time ?? ""}
                          onChange={(ev) =>
                            updateSet(i, {
                              time:
                                ev.target.value === ""
                                  ? null
                                  : Number(ev.target.value),
                            } as Partial<CardioSet>)
                          }
                          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          value={(s as WeightSet).weight ?? ""}
                          onChange={(ev) =>
                            updateSet(i, {
                              weight:
                                ev.target.value === ""
                                  ? null
                                  : Number(ev.target.value),
                            } as Partial<WeightSet>)
                          }
                          className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={(s as WeightSet).reps ?? ""}
                          onChange={(ev) =>
                            updateSet(i, {
                              reps:
                                ev.target.value === ""
                                  ? null
                                  : Number(ev.target.value),
                            } as Partial<WeightSet>)
                          }
                          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        />
                      </td>
                    </>
                  )}
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => updateSet(i, { done: !s.done })}
                    />
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() =>
                        onUpdate((e) => ({
                          ...e,
                          sets: e.sets.filter((_, idx) => idx !== i),
                        }))
                      }
                      disabled={entry.sets.length <= 1}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-30"
                      aria-label="Delete set"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={() =>
              onUpdate((e) => ({
                ...e,
                sets: [
                  ...e.sets,
                  cardio
                    ? { distance: null, time: null, done: false }
                    : { weight: null, reps: null, done: false },
                ],
              }))
            }
            className="mt-3 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-slate-100"
          >
            + Add {cardio ? "interval" : "set"}
          </button>
        </div>
      )}
    </li>
  );
}

// ==================== Movements ====================

function MovementsView({
  data,
  update,
}: {
  data: AppData;
  update: (mut: (d: AppData) => AppData) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MovementKind>("weight");
  const [unit, setUnit] = useState<CardioUnit>("mi");

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((d) => ({
      ...d,
      movements: [
        ...d.movements,
        {
          id: uid(),
          name: trimmed,
          kind,
          unit: kind === "cardio" ? unit : undefined,
        },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    setName("");
  };

  const remove = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this movement? Past sessions keep their entries.")
    )
      return;
    update((d) => ({
      ...d,
      movements: d.movements.filter((m) => m.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Movements</h2>
        <p className="text-sm text-slate-400">
          Your library of lifts and cardio.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            placeholder="Movement name (e.g., Front squat)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MovementKind)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          >
            <option value="weight">weight</option>
            <option value="cardio">cardio</option>
          </select>
          {kind === "cardio" ? (
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as CardioUnit)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
            >
              <option value="mi">miles</option>
              <option value="km">km</option>
              <option value="m">meters</option>
            </select>
          ) : (
            <span />
          )}
          <button
            onClick={add}
            disabled={!name.trim()}
            className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {data.movements.length === 0 ? (
        <p className="text-sm text-slate-400">No movements yet.</p>
      ) : (
        <ul className="space-y-1">
          {[...data.movements]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{m.name}</span>{" "}
                  <span className="text-xs text-slate-500">
                    {m.kind === "cardio" ? `cardio · ${m.unit}` : "weight"}
                  </span>
                </div>
                <button
                  onClick={() => remove(m.id)}
                  className="text-xs text-slate-500 hover:text-rose-400"
                >
                  delete
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

// ==================== History ====================

function HistoryView({
  data,
  update,
}: {
  data: AppData;
  update: (mut: (d: AppData) => AppData) => void;
}) {
  const finished = useMemo(
    () =>
      [...data.workouts]
        .filter((w) => w.finished)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.workouts]
  );
  const movementsById = useMemo(
    () => new Map(data.movements.map((m) => [m.id, m])),
    [data.movements]
  );

  const removeWorkout = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this finished workout?")
    )
      return;
    update((d) => ({
      ...d,
      workouts: d.workouts.filter((w) => w.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">History</h2>
        <p className="text-sm text-slate-400">Finished sessions.</p>
      </div>

      {finished.length === 0 ? (
        <p className="text-sm text-slate-400">No finished workouts yet.</p>
      ) : (
        <ul className="space-y-2">
          {finished.map((w) => {
            const volume = w.entries.reduce((acc, e) => {
              for (const s of e.sets) {
                if (isWeight(s) && s.weight && s.reps) acc += s.weight * s.reps;
              }
              return acc;
            }, 0);
            return (
              <li
                key={w.id}
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{w.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {w.entries.length} movements · vol{" "}
                      {volume.toLocaleString()}
                    </span>
                    <button
                      onClick={() => removeWorkout(w.id)}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      delete
                    </button>
                  </div>
                </div>
                <ul className="mt-1 text-xs text-slate-500">
                  {w.entries.map((e) => {
                    const m = movementsById.get(e.movementId);
                    return (
                      <li key={e.id}>
                        {m?.name ?? "(deleted)"} — {e.sets.length}{" "}
                        {m?.kind === "cardio" ? "intervals" : "sets"}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ==================== Progress ====================

function ProgressView({ data }: { data: AppData }) {
  const [movementId, setMovementId] = useState<string>(
    data.movements[0]?.id ?? ""
  );

  // Keep the selection valid if the underlying list changes.
  useEffect(() => {
    if (
      movementId &&
      !data.movements.some((m) => m.id === movementId) &&
      data.movements[0]
    ) {
      setMovementId(data.movements[0].id);
    }
  }, [data.movements, movementId]);

  const movement = data.movements.find((m) => m.id === movementId);

  const points = useMemo(() => {
    if (!movement) return [];
    const finished = [...data.workouts]
      .filter((w) => w.finished)
      .sort((a, b) => a.date.localeCompare(b.date));
    const out: { date: string; value: number }[] = [];
    for (const w of finished) {
      const e = w.entries.find((x) => x.movementId === movement.id);
      if (!e) continue;
      const v =
        movement.kind === "cardio"
          ? totalDistance(e.sets)
          : (topSet(e.sets)?.weight ?? 0);
      out.push({ date: w.date, value: v });
    }
    return out;
  }, [data.workouts, movement]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Progress</h2>
          <p className="text-sm text-slate-400">
            {movement?.kind === "cardio"
              ? `Distance over time (${movement.unit})`
              : "Top-set weight over time"}
          </p>
        </div>
        <select
          value={movementId}
          onChange={(e) => setMovementId(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
        >
          {data.movements.length === 0 ? (
            <option value="">No movements yet</option>
          ) : (
            data.movements.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <LineChart points={points} />
      </div>
    </div>
  );
}

function LineChart({
  points,
}: {
  points: { date: string; value: number }[];
}) {
  if (points.length === 0)
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No data yet. Finish a workout to populate this chart.
      </p>
    );

  const W = 600;
  const H = 220;
  const PAD = 32;
  const max = Math.max(...points.map((p) => p.value), 1);
  const dx = points.length === 1 ? 0 : (W - 2 * PAD) / (points.length - 1);
  const scaleY = (v: number) =>
    H - PAD - (v / (max || 1)) * (H - 2 * PAD);

  const coords = points.map((p, i) => ({
    x: PAD + i * dx,
    y: scaleY(p.value),
    ...p,
  }));
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-56 w-full"
      role="img"
      aria-label="Progress chart"
    >
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="#334155"
        strokeWidth="1"
      />
      <line
        x1={PAD}
        y1={PAD}
        x2={PAD}
        y2={H - PAD}
        stroke="#334155"
        strokeWidth="1"
      />
      <text x={6} y={PAD + 4} fill="#64748b" fontSize="11">
        {max}
      </text>
      <text x={6} y={H - PAD + 4} fill="#64748b" fontSize="11">
        0
      </text>
      <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={3} fill="#22d3ee" />
          <title>
            {c.date}: {c.value}
          </title>
        </g>
      ))}
      <text x={PAD} y={H - 8} fill="#64748b" fontSize="10">
        {coords[0]?.date}
      </text>
      {coords.length > 1 && (
        <text
          x={W - PAD}
          y={H - 8}
          fill="#64748b"
          fontSize="10"
          textAnchor="end"
        >
          {coords[coords.length - 1].date}
        </text>
      )}
    </svg>
  );
}
