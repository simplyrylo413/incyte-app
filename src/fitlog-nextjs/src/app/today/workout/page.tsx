"use client";

// Phase 4 — Workout Mode.
// Route: /today/workout?mid=xxx&planId=yyy
// Ported from renderWorkoutV2() (~line 13982) + set-action helpers.
// Source: src/fitlog-mobile.html

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listMovements, listWorkouts, listPlans, upsertWorkout, listFinishedTodayWorkouts,
} from "@/lib/db";
import { tryGetDeviceId } from "@/lib/device";
import type { Movement, Workout, WorkoutEntry, SetEntry, PlanItem } from "@/lib/types";
import {
  currentSetIdx, hasValue, prevLabel, hasAnyPrev, defaultSetsFor,
  logSet, reopenSet, toggleSetType, toggleBodyweight, patchSet,
  addSet, removeSet, allSetsDone, archiveEntryToToday,
  PICKER_CONFIG, type PickerField,
} from "@/lib/engine/workout";
import { filterFinishedToday } from "@/lib/engine/today";
import s from "./WorkoutPage.module.css";

// ── Inline picker value arrays ────────────────────────────────────────────
// 2.5 lb steps 0 → 500 — consistent increment throughout
const WM_WEIGHT_VALS: number[] = Array.from({ length: 201 }, (_, i) => i * 2.5);
const WM_REPS_VALS: number[] = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25,30];
const WM_RPE_VALS: (number | string)[] = ['—',6,6.5,7,7.5,8,8.5,9,9.5,10];
const WM_ITEM_W = 44; // px — 5 items visible in ~220px

function wmClosestIdx(vals: (number | string)[], val: number | string | null | undefined): number {
  if (val == null || val === '' || val === '—') return 0;
  let best = 0, bestD = Infinity;
  vals.forEach((v, i) => {
    const d = Math.abs(Number(v) - Number(val));
    if (!isNaN(d) && d < bestD) { bestD = d; best = i; }
  });
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────

const CHECK_SVG = (
  <svg viewBox="0 0 12 12" fill="none">
    <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const REMOVE_SVG = (
  <svg viewBox="0 0 12 12" fill="none">
    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

// useSearchParams() requires a Suspense boundary in Next.js 14 static export.
export default function WorkoutPageShell() {
  return (
    <Suspense fallback={<div className={s.page} style={{ padding: 24, color: "#5e6a82", fontSize: 13 }}>Loading…</div>}>
      <WorkoutPage />
    </Suspense>
  );
}

function WorkoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const mid   = params.get("mid") ?? "";
  const planId = params.get("planId") ?? "";
  const srcId  = params.get("src") ?? "";   // sourceWorkoutId for edit-after-archive

  // ── Data ──────────────────────────────────────────────────────────────────
  const [mv, setMv] = useState<Movement | null>(null);
  const [plan, setPlan] = useState<PlanItem | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [entry, setEntry] = useState<WorkoutEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const lastEntryRef = useRef<WorkoutEntry | null>(null); // prev session entry for prev values

  // ── Session UI state ──────────────────────────────────────────────────────
  const [trackRpe, setTrackRpe] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [restSecs, setRestSecs] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [picker, setPicker] = useState<{ field: PickerField; idx: number; value: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!mid) { setErr("No movement specified."); setLoading(false); return; }
    try {
      const [mvs, wkts, plans, finished] = await Promise.all([
        listMovements(),
        listWorkouts({ finished: false, limit: 5 }),
        listPlans(),
        listFinishedTodayWorkouts(),
      ]);
      const movement = mvs.find((m) => m.id === mid) ?? null;
      const planItem = plans.find((p) => p.id === planId) ?? null;

      // All workouts for archive lookups (active + finished today)
      const ft = filterFinishedToday(finished);
      const allW = [...wkts, ...ft];
      setAllWorkouts(allW);
      setMv(movement);
      setPlan(planItem);

      // Find or build the active workout for this session
      let aw = wkts[0] ?? null;

      // If editing a history entry (srcId), find the source workout
      if (srcId) {
        const srcWorkout = allW.find((w) => w.id === srcId) ?? null;
        if (srcWorkout) {
          setActiveWorkout(srcWorkout);
          const srcEntry = srcWorkout.entries.find((e) => e.movementId === mid) ?? null;
          if (srcEntry) {
            if (!srcEntry.sets?.length) {
              srcEntry.sets = [{ weight: null, reps: null, rpe: null, done: false }];
            }
            setEntry({ ...srcEntry });
            setLoading(false);
            return;
          }
        }
      }

      // Find previous session entry for seeding prev values
      const prevEntry = (() => {
        const allFinishedSorted = allW
          .filter((w) => w.finished && w.id !== (aw?.id ?? ""))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        for (const w of allFinishedSorted) {
          const e = w.entries.find((e) => e.movementId === mid);
          if (e && e.sets?.some((s) => hasValue(s.weight) || hasValue(s.reps))) {
            return e;
          }
        }
        return null;
      })();
      lastEntryRef.current = prevEntry;

      // Find or create the active entry for this movement
      let activeEntry = aw?.entries.find((e) => e.movementId === mid) ?? null;

      if (!activeEntry) {
        // Seed sets from prior session or plan defaults
        const seeds = defaultSetsFor({
          planSets: planItem?.sets,
          planReps: planItem?.reps,
          defaultSets: movement?.defaultSets,
          lastEntry: prevEntry,
        });
        activeEntry = {
          movementId: mid,
          planId: planId || undefined,
          canonicalMovement: movement?.canonicalMovement,
          equipmentType: movement?.equipmentType,
          muscle: movement?.muscle,
          name: movement?.name,
          sets: seeds,
        };

        // Attach to active workout (create one if needed)
        if (!aw) {
          const today = new Date();
          const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          aw = {
            id: crypto.randomUUID(),
            name: `${DAYS[today.getDay()]} session`,
            date: today.toISOString(),
            entries: [activeEntry],
            finished: false,
          };
        } else {
          aw = { ...aw, entries: [...aw.entries, activeEntry] };
        }
        // Save to Supabase immediately so it persists
        await upsertWorkout(aw);
      }

      setActiveWorkout(aw);
      setEntry({ ...activeEntry });
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [mid, planId, srcId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { stopRest(); }, []); // cleanup on unmount

  // Preload current set from last completed set when weight/reps are unset
  useEffect(() => {
    if (!entry) return;
    const cur = currentSetIdx(entry);
    if (cur === -1) return;
    const currentSet = entry.sets[cur];
    if (hasValue(currentSet.weight) && hasValue(currentSet.reps)) return;
    const prevDone = entry.sets.slice(0, cur).reverse().find((set) => set.done);
    if (!prevDone) return;
    let changed = false;
    const newSet = { ...currentSet };
    if (!hasValue(newSet.weight) && hasValue(prevDone.weight)) { newSet.weight = prevDone.weight; changed = true; }
    if (!hasValue(newSet.reps)   && hasValue(prevDone.reps))   { newSet.reps   = prevDone.reps;   changed = true; }
    if (trackRpe && !hasValue(newSet.rpe) && hasValue(prevDone.rpe)) { newSet.rpe = prevDone.rpe; changed = true; }
    if (!changed) return;
    const newSets = entry.sets.map((set, i) => i === cur ? newSet : set);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    persist(newEntry);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.sets?.length, trackRpe]);

  // ── Persistence ───────────────────────────────────────────────────────────
  const persist = useCallback(async (updatedEntry: WorkoutEntry, updatedWorkout?: Workout) => {
    const aw = updatedWorkout ?? activeWorkout;
    if (!aw) return;
    const newEntries = aw.entries.some((e) => e.movementId === mid)
      ? aw.entries.map((e) => e.movementId === mid ? updatedEntry : e)
      : [...aw.entries, updatedEntry];
    const updated: Workout = { ...aw, entries: newEntries, edited_at: new Date().toISOString() };
    setActiveWorkout(updated);
    await upsertWorkout(updated);
  }, [activeWorkout, mid]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  // ── Rest timer ────────────────────────────────────────────────────────────
  function startRest() {
    stopRest();
    let rem = restSecs;
    setRestRemaining(rem);
    restIntervalRef.current = setInterval(() => {
      rem--;
      setRestRemaining(rem);
      if (rem <= 0) { stopRest(); showToast("Rest complete."); }
    }, 1000);
  }

  function stopRest() {
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    setRestRemaining(0);
  }

  const restOn = restRemaining > 0;

  function formatRest(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2,"0")}` : `${s}s`;
  }

  // ── Set actions ───────────────────────────────────────────────────────────
  async function handleLogSet(idx: number) {
    if (!entry) return;
    const s = entry.sets[idx];
    if (!hasValue(s.weight)) { showToast("Scroll to set weight before logging."); return; }
    if (!hasValue(s.reps))   { showToast("Scroll to set reps before logging.");   return; }
    if (trackRpe && !hasValue(s.rpe)) { showToast("Scroll to set RPE, or turn off RPE tracking."); return; }

    const newSets = logSet(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);

    if (allSetsDone(newSets)) {
      // Auto-archive and go back to Today
      await handleComplete(newEntry);
      showToast(`Set ${idx + 1} logged — movement complete.`);
      startRest();
      router.refresh();
      router.push("/today");
      return;
    }
    showToast(`Set ${idx + 1} logged.`);
    startRest();
  }

  async function handleReopenSet(idx: number) {
    if (!entry) return;
    const newSets = reopenSet(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  async function handleToggleType(idx: number) {
    if (!entry) return;
    const newSets = toggleSetType(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  async function handleToggleBW(idx: number) {
    if (!entry) return;
    const newSets = toggleBodyweight(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  async function handleAddSet() {
    if (!entry) return;
    const newSets = addSet(entry.sets);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  async function handleRemoveSet(idx: number) {
    if (!entry) return;
    if (entry.sets.length <= 1) { showToast("Need at least one set."); return; }
    if (entry.sets[idx].done && !confirm(`Remove logged set ${idx + 1}?`)) return;
    const newSets = removeSet(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  async function handleComplete(completedEntry?: WorkoutEntry) {
    const e = completedEntry ?? entry;
    if (!e || srcId) { router.push("/today"); return; }
    // Archive to today's history session
    const { workouts: updatedWorkouts, session } = archiveEntryToToday(e, allWorkouts);
    setAllWorkouts(updatedWorkouts);
    // Save the finished session
    await upsertWorkout(session);
    // Remove entry from active workout (keep active workout alive for other movements)
    if (activeWorkout) {
      const trimmed: Workout = {
        ...activeWorkout,
        entries: activeWorkout.entries.filter((ae) => ae.movementId !== mid),
      };
      setActiveWorkout(trimmed);
      await upsertWorkout(trimmed);
    }
  }

  // ── Picker ────────────────────────────────────────────────────────────────
  function openPicker(field: PickerField, idx: number) {
    if (!entry) return;
    const s = entry.sets[idx];
    const cfg = PICKER_CONFIG[field];
    const raw = s[field as keyof SetEntry];
    const val = (raw != null && raw !== "") ? +raw : cfg.default;
    setPicker({ field, idx, value: val });
  }

  async function commitPicker() {
    if (!picker || !entry) return;
    const newSets = patchSet(entry.sets, picker.idx, picker.field, picker.value);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    setPicker(null);
    await persist(newEntry);
  }

  async function handlePatchSet(field: PickerField, value: number | string) {
    if (!entry) return;
    const cur = currentSetIdx(entry);
    if (cur === -1) return;
    const newVal = (value === '—' || value == null) ? null : Number(value);
    const newSets = patchSet(entry.sets, cur, field, newVal as number);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  // ── Back ──────────────────────────────────────────────────────────────────
  function handleBack() {
    stopRest();
    router.push("/today");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={s.page}>
        <div style={{ padding: 24, color: "#5e6a82", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (err || !entry) {
    return (
      <div className={s.page}>
        <div style={{ padding: 24, color: "#b08092", fontSize: 13 }}>{err ?? "Movement not found."}</div>
      </div>
    );
  }

  const cur = currentSetIdx(entry);
  const allDone = cur === -1;
  const prevEntry = lastEntryRef.current;
  const hasPrior = prevEntry?.sets?.some((s) => hasValue(s.weight) || hasValue(s.reps));
  const anyPrev = hasAnyPrev(entry);

  const bodyPart = ((mv?.bodyPart || mv?.muscle || mv?.category) ?? "—").toUpperCase();
  const equip = (entry.equipmentType ?? mv?.equipmentType ?? "unspecified").toUpperCase();
  const name = mv?.name ?? entry.name ?? "—";

  const doneSets  = (entry.sets ?? []).map((s, i) => ({ s, i })).filter((x) =>  x.s.done && x.i !== cur);
  const targetSets = (entry.sets ?? []).map((s, i) => ({ s, i })).filter((x) => !x.s.done && x.i !== cur);

  // Rule-based next-set recommendation (shown when AI toggle is on + ≥1 done set with RPE)
  const nextSetRec = (() => {
    if (!aiOn || doneSets.length === 0) return null;
    const last = doneSets[doneSets.length - 1].s;
    const rpe = last.rpe != null && last.rpe !== "" ? Number(last.rpe) : null;
    const w   = last.weight != null && last.weight !== "" ? Number(last.weight) : null;
    const r   = last.reps   != null && last.reps   !== "" ? Number(last.reps)   : null;
    if (rpe == null) return null;
    const wLabel = w != null ? `${w} lb` : "same weight";
    const rLabel = r != null ? `${r} reps` : "same reps";
    if (rpe >= 9.5) return `Drop 10 lb · ${rLabel} · high effort last set`;
    if (rpe >= 9)   return `−5–10 lb · ${rLabel} · near max`;
    if (rpe >= 8.5) return `${wLabel} or −5 lb · ${rLabel}`;
    if (rpe >= 8)   return `Hold ${wLabel} · ${rLabel}`;
    if (rpe >= 7)   return `${wLabel} or +5 lb · ${rLabel}`;
    if (rpe >= 6)   return `+5–10 lb · ${rLabel} · room to push`;
    return `+10 lb · ${rLabel} · effort too low`;
  })();

  // Prior session summary
  let priorSummary = "";
  let priorDate = "";
  if (hasPrior && prevEntry) {
    const ws = prevEntry.sets.map((s) => s.weight).filter((v) => hasValue(v));
    const rs = prevEntry.sets.map((s) => s.reps).filter((v) => hasValue(v));
    const wMin = Math.min(...ws.map(Number)), wMax = Math.max(...ws.map(Number));
    const rMin = Math.min(...rs.map(Number)), rMax = Math.max(...rs.map(Number));
    const wStr = ws.length === 0 ? "—" : wMin === wMax ? `${wMin} lb` : `${wMin}–${wMax} lb`;
    const rStr = rs.length === 0 ? "" : rMin === rMax ? `${rMin} reps` : `${rMin}–${rMax} reps`;
    priorSummary = rStr ? `${wStr} · ${rStr}` : wStr;
    const d = new Date((prevEntry as WorkoutEntry & { date?: string }).date ?? "");
    if (!isNaN(d.getTime())) {
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      priorDate = `· ${MONTHS[d.getMonth()].toUpperCase()} ${d.getDate()}`;
    }
  }

  return (
    <div className={s.page}>
      {/* ── Top bar ── */}
      <div className={s.topBar}>
        <button className={s.backChip} onClick={handleBack} aria-label="Back to Today" type="button">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>
        <div className={s.identity}>
          <div className={s.bodyPart}>{bodyPart} · {equip}</div>
          <div className={s.mvName}>{name}</div>
        </div>
      </div>

      {/* ── Prior session strip ── */}
      {hasPrior && (
        <div className={s.prior}>
          <span className={s.priorLbl}>
            Previous
            {priorDate && <span className={s.priorDate}>{priorDate}</span>}
          </span>
          <span className={s.priorVals}>{priorSummary}</span>
        </div>
      )}

      {/* ── Hero card ── */}
      <HeroCard
        entry={entry}
        cur={cur}
        allDone={allDone}
        trackRpe={trackRpe}
        aiOn={aiOn}
        restOn={restOn}
        restRemaining={restRemaining}
        restSecs={restSecs}
        onLogSet={handleLogSet}
        onComplete={async () => { await handleComplete(); router.refresh(); router.push("/today"); }}
        onPatchSet={handlePatchSet}
        onToggleRpe={() => setTrackRpe((v) => !v)}
        onToggleAi={() => setAiOn((v) => !v)}
        onToggleRest={() => restOn ? stopRest() : startRest()}
        formatRest={formatRest}
        s={s}
      />

      {/* ── Done set rows ── */}
      {doneSets.length > 0 && (
        <div>
          <ColHeader hasPrev={anyPrev} s={s} />
          <div className={s.sets}>
            {doneSets.map(({ s: set, i }) => (
              <SetRow
                key={i}
                set={set}
                idx={i}
                isDone={true}
                cur={-1}
                anyPrev={anyPrev}
                trackRpe={trackRpe}
                onReopenSet={handleReopenSet}
                onToggleType={handleToggleType}
                onToggleBW={handleToggleBW}
                onRemove={handleRemoveSet}
                onOpenPicker={openPicker}
                styles={s}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── AI next-set recommendation ── */}
      {nextSetRec && (
        <div className={s.aiRec}>
          <span className={s.aiRecLabel}>AI</span>
          <span className={s.aiRecText}>{nextSetRec}</span>
        </div>
      )}

      {/* ── Target set rows ── */}
      {targetSets.length > 0 && (
        <div>
          {doneSets.length === 0 && <ColHeader hasPrev={anyPrev} s={s} />}
          <div className={s.sets}>
            {targetSets.map(({ s: set, i }) => (
              <SetRow
                key={i}
                set={set}
                idx={i}
                isDone={false}
                cur={cur}
                anyPrev={anyPrev}
                trackRpe={trackRpe}
                onReopenSet={handleReopenSet}
                onToggleType={handleToggleType}
                onToggleBW={handleToggleBW}
                onRemove={handleRemoveSet}
                onOpenPicker={openPicker}
                styles={s}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Add set ── */}
      <button className={s.addSetBtn} onClick={handleAddSet} type="button">
        + Add set
      </button>

      {/* ── Toast ── */}
      {toast && <div className={s.toast}>{toast}</div>}

      {/* ── Picker sheet ── */}
      {picker && (
        <PickerSheet
          field={picker.field}
          value={picker.value}
          onChange={(v) => setPicker((p) => p ? { ...p, value: v } : p)}
          onDone={commitPicker}
          onDismiss={() => setPicker(null)}
          s={s}
        />
      )}
    </div>
  );
}

// ─── InlinePicker ─────────────────────────────────────────────────────────────
// Horizontal drag-to-scroll strip with tinted pill selection window.
// Items are rendered as plain divs; distance-from-center classes (wm-pk-*)
// are applied imperatively via classList since CSS Modules hashes names.
// The item state classes are declared :global() in the CSS module so they match.

function InlinePicker({
  label,
  values,
  value,
  onChange,
  styles,
}: {
  label: string;
  values: (number | string)[];
  value: number | string | null | undefined;
  onChange: (val: number | string) => void;
  styles: Record<string, string>;
}) {
  const s = styles;
  const widgetRef  = useRef<HTMLDivElement>(null);
  const trackRef   = useRef<HTMLDivElement>(null);
  const fadeLRef   = useRef<HTMLDivElement>(null);
  const fadeRRef   = useRef<HTMLDivElement>(null);

  // Drag state in refs — never triggers re-render
  const curXRef        = useRef(0);
  const draggingRef    = useRef(false);
  const dragStartXRef  = useRef(0);
  const dragStartTXRef = useRef(0);
  const velRef         = useRef(0);
  const lastXRef       = useRef(0);
  const lastTRef       = useRef(0);
  const selIdxRef      = useRef(wmClosestIdx(values, value));

  // Keep onChange in ref to avoid stale closure in drag handlers
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  function cw(): number {
    return widgetRef.current?.getBoundingClientRect().width ?? 220;
  }
  function txForIdx(i: number): number {
    return cw() / 2 - WM_ITEM_W / 2 - i * WM_ITEM_W;
  }

  function updateClasses(x: number) {
    const track = trackRef.current;
    if (!track) return;
    const center = cw() / 2 - WM_ITEM_W / 2;
    const fi = (center - x) / WM_ITEM_W;
    const isDark = document.body.classList.contains('theme-dark');
    const [r, g, b] = isDark ? [255, 255, 255] : [15, 22, 34];
    // Continuous exponential scale — smooth drum-roll, no discrete steps
    track.querySelectorAll('[data-pk-item]').forEach((el, i) => {
      const d = Math.abs(i - fi);
      const t      = Math.exp(-d * 0.9);
      const size   = (11 + 21 * t).toFixed(1); // 11px far → 32px center
      const alpha  = (0.09 + 0.91 * t).toFixed(3);
      const weight = d < 0.6 ? '800' : d < 1.4 ? '650' : '500';
      const ls     = d < 0.6 ? '-0.018em' : '0em';
      (el as HTMLElement).style.cssText =
        `font-size:${size}px;font-weight:${weight};color:rgba(${r},${g},${b},${alpha});letter-spacing:${ls};`;
    });
  }

  function applyX(x: number, animate: boolean) {
    const track = trackRef.current;
    if (!track) return;
    if (animate) track.classList.add('wm-pk-snapping');
    else         track.classList.remove('wm-pk-snapping');
    track.style.transform = `translateX(${x}px)`;
    curXRef.current = x;
    updateClasses(x);
  }

  function doSnap() {
    const center = cw() / 2 - WM_ITEM_W / 2;
    const proj = curXRef.current + velRef.current * 80;
    let idx = Math.round((center - proj) / WM_ITEM_W);
    idx = Math.max(0, Math.min(values.length - 1, idx));
    selIdxRef.current = idx;
    applyX(txForIdx(idx), true);
    onChangeRef.current(values[idx]);
  }

  // Position track and set up edge fades on mount / value change
  useEffect(() => {
    const newIdx = wmClosestIdx(values, value);
    selIdxRef.current = newIdx;
    requestAnimationFrame(() => { applyX(txForIdx(newIdx), false); });

    // Edge fades: match actual surface background colour (light + dark)
    const widget = widgetRef.current;
    if (!widget) return;
    const getBg = (el: Element | null): string => {
      let e = el;
      while (e && e !== document.documentElement) {
        const bg = window.getComputedStyle(e).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        e = e.parentElement;
      }
      return '#f5f7fb';
    };
    const bg = getBg(widget.parentElement);
    if (fadeLRef.current) fadeLRef.current.style.background = `linear-gradient(to right, ${bg} 0%, rgba(0,0,0,0) 100%)`;
    if (fadeRRef.current) fadeRRef.current.style.background = `linear-gradient(to left, ${bg} 0%, rgba(0,0,0,0) 100%)`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, values]);

  // Wire pointer/touch drag
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    function start(cx: number) {
      trackRef.current?.classList.remove('wm-pk-snapping');
      draggingRef.current    = true;
      dragStartXRef.current  = cx;
      dragStartTXRef.current = curXRef.current;
      lastXRef.current = cx;
      lastTRef.current = Date.now();
      velRef.current   = 0;
    }
    function move(cx: number) {
      if (!draggingRef.current) return;
      const now = Date.now(), dt = now - lastTRef.current;
      if (dt > 0) velRef.current = (cx - lastXRef.current) / dt;
      lastXRef.current = cx; lastTRef.current = now;
      applyX(dragStartTXRef.current + (cx - dragStartXRef.current), false);
    }
    function end() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      doSnap();
    }

    const onMD = (e: MouseEvent) => { e.preventDefault(); start(e.clientX); };
    const onMM = (e: MouseEvent) => { if (draggingRef.current) move(e.clientX); };
    const onMU = () => end();
    const onTS = (e: TouchEvent) => start(e.touches[0].clientX);
    const onTM = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX); };
    const onTE = () => end();

    widget.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    widget.addEventListener('touchstart', onTS, { passive: true });
    widget.addEventListener('touchmove', onTM, { passive: false });
    widget.addEventListener('touchend', onTE);

    return () => {
      widget.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      widget.removeEventListener('touchstart', onTS);
      widget.removeEventListener('touchmove', onTM);
      widget.removeEventListener('touchend', onTE);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — drag handlers use refs, no stale closures

  return (
    <div className={s.inlinePickerRow}>
      <div className={s.inlinePickerLabel}>{label}</div>
      <div className={s.inlinePickerWrap}>
        <div className={s.inlinePickerPill} />
        <div ref={widgetRef} className={s.inlinePickerWidget}>
          <div ref={trackRef} className={s.inlinePickerTrack}>
            {values.map((v, i) => (
              <div key={i} data-pk-item className={s.inlinePickerItem}>
                {String(v)}
              </div>
            ))}
          </div>
          <div ref={fadeLRef} className={`${s.inlinePickerFade} ${s.inlinePickerFadeL}`} />
          <div ref={fadeRRef} className={`${s.inlinePickerFade} ${s.inlinePickerFadeR}`} />
        </div>
      </div>
    </div>
  );
}

// ─── HeroCard ─────────────────────────────────────────────────────────────────

function HeroCard(props: {
  entry: WorkoutEntry;
  cur: number;
  allDone: boolean;
  trackRpe: boolean;
  aiOn: boolean;
  restOn: boolean;
  restRemaining: number;
  restSecs: number;
  onLogSet: (idx: number) => void;
  onComplete: () => void;
  onPatchSet: (field: PickerField, value: number | string) => void;
  onToggleRpe: () => void;
  onToggleAi: () => void;
  onToggleRest: () => void;
  formatRest: (s: number) => string;
  s: Record<string, string>;
}) {
  const { entry, cur, allDone, trackRpe, restOn, restRemaining, restSecs, s } = props;
  const set = !allDone ? entry.sets[cur] : null;

  const total = entry.sets.length;

  const restDisplay = restOn ? props.formatRest(restRemaining) : props.formatRest(restSecs);

  return (
    <div className={s.hero}>
      <div className={s.heroEyebrow}>
        {allDone ? (
          <span className={s.nowMarker}>
            <span className={`${s.nowDot} ${s.nowDotOk}`} />
            <span className={`${s.activeSet} ${s.activeSetOk}`}>MOVEMENT COMPLETE</span>
          </span>
        ) : (
          <span className={s.nowMarker}>
            <span className={s.nowDot} />
            <span className={s.activeSet}>SET {cur + 1}/{total}</span>
          </span>
        )}
        <span className={s.eyebrowPills}>
          <button
            className={`${s.togglePill} ${trackRpe ? s.togglePillOn : ""}`}
            onClick={props.onToggleRpe}
            type="button"
          >RPE</button>
          <button
            className={`${s.togglePill} ${props.aiOn ? s.togglePillOn : ""}`}
            onClick={props.onToggleAi}
            type="button"
          >AI</button>
          <button
            className={`${s.restPill} ${restOn ? s.restPillOn : ""} ${restOn && restRemaining <= 10 ? s.restPillUrgent : ""}`}
            onClick={props.onToggleRest}
            type="button"
          >
            Rest <span>{restDisplay}</span>
          </button>
        </span>
      </div>

      {allDone ? (
        <>
          <p className={s.completeMsg}>All sets logged.</p>
          <div className={s.heroActions}>
            <button className={s.heroCta} onClick={props.onComplete} type="button">
              Complete
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={s.inlinePickerSection}>
            <InlinePicker
              key={`w-${cur}`}
              label="Weight · lb"
              values={WM_WEIGHT_VALS}
              value={set?.weight}
              onChange={(v) => props.onPatchSet("weight", v)}
              styles={s}
            />
            <div className={s.inlinePickerDivider} />
            <InlinePicker
              key={`r-${cur}`}
              label="Reps"
              values={WM_REPS_VALS}
              value={set?.reps}
              onChange={(v) => props.onPatchSet("reps", v)}
              styles={s}
            />
            {trackRpe && (
              <>
                <div className={s.inlinePickerDivider} />
                <InlinePicker
                  key={`e-${cur}`}
                  label="RPE · Optional"
                  values={WM_RPE_VALS}
                  value={set?.rpe}
                  onChange={(v) => props.onPatchSet("rpe", v)}
                  styles={s}
                />
              </>
            )}
          </div>
          <div className={s.heroActions}>
            <button
              className={s.heroCta}
              onClick={() => props.onLogSet(cur)}
              type="button"
            >
              Log set {cur + 1}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ColHeader ────────────────────────────────────────────────────────────────

function ColHeader({ hasPrev, s }: { hasPrev: boolean; s: Record<string, string> }) {
  return (
    <div className={s.colHead}>
      <span>Set</span>
      <span></span>
      <span></span>
      <span>{hasPrev ? "Previous" : ""}</span>
      <span className={s.hToday}>Today</span>
      <span></span>
      <span></span>
    </div>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

function SetRow({
  set, idx, isDone, cur: _cur, anyPrev, trackRpe,
  onReopenSet, onToggleType, onToggleBW, onRemove, onOpenPicker, styles,
}: {
  set: SetEntry;
  idx: number;
  isDone: boolean;
  cur: number;
  anyPrev: boolean;
  trackRpe: boolean;
  onReopenSet: (i: number) => void;
  onToggleType: (i: number) => void;
  onToggleBW: (i: number) => void;
  onRemove: (i: number) => void;
  onOpenPicker: (field: PickerField, i: number) => void;
  styles: Record<string, string>;
}) {
  const s = styles;
  const num = String(idx + 1).padStart(2, "0");
  const isWarmup = !!set.warmup;
  const isBW = !!set.bw;

  const hasW = hasValue(set.weight);
  const hasR = hasValue(set.reps);

  return (
    <div className={`${s.setRow} ${isDone ? s.setRowDone : ""}`}>
      {/* Set number / type toggle */}
      <button
        className={`${s.rSetBtn} ${isWarmup ? s.rSetBtnWarmup : ""}`}
        onClick={() => onToggleType(idx)}
        type="button"
      >
        {num}
      </button>

      {/* WS/WU toggle */}
      <button
        className={`${s.wuBtn} ${isWarmup ? s.wuBtnWarmup : ""}`}
        onClick={() => onToggleType(idx)}
        type="button"
      >
        {isWarmup ? "WU" : "WS"}
      </button>

      {/* BW toggle */}
      <button
        className={`${s.bwBtn} ${isBW ? s.bwBtnOn : ""}`}
        onClick={() => onToggleBW(idx)}
        type="button"
      >
        BW
      </button>

      {/* Previous */}
      <span className={s.rPrev}>
        {anyPrev ? prevLabel(set) : ""}
      </span>

      {/* Today values */}
      {isDone ? (
        <span className={s.rVals}>
          {set.weight} × {set.reps}
          {trackRpe && hasValue(set.rpe) && (
            <span className={s.rpeBit}>@{set.rpe}</span>
          )}
        </span>
      ) : (
        <span className={`${s.rVals} ${s.rValsEditable}`}>
          <button
            className={`${s.editNum} ${!hasW ? s.editNumBlank : ""}`}
            onClick={() => onOpenPicker("weight", idx)}
            type="button"
          >
            {hasW ? String(set.weight) : "—"}
          </button>
          <span className={s.editX}>×</span>
          <button
            className={`${s.editNum} ${!hasR ? s.editNumBlank : ""}`}
            onClick={() => onOpenPicker("reps", idx)}
            type="button"
          >
            {hasR ? String(set.reps) : "—"}
          </button>
        </span>
      )}

      {/* Check / Reopen */}
      {isDone ? (
        <button
          className={`${s.chk} ${s.chkDone}`}
          onClick={() => onReopenSet(idx)}
          type="button"
          aria-label="Reopen set"
        >
          {CHECK_SVG}
        </button>
      ) : (
        <span className={`${s.chk} ${s.chkTarget}`} aria-hidden="true">
          {CHECK_SVG}
        </span>
      )}

      {/* Remove */}
      <button
        className={s.rowRemove}
        onClick={() => onRemove(idx)}
        type="button"
        aria-label="Remove set"
      >
        {REMOVE_SVG}
      </button>
    </div>
  );
}

// ─── PickerSheet ──────────────────────────────────────────────────────────────

function PickerSheet({
  field, value, onChange, onDone, onDismiss, s,
}: {
  field: PickerField;
  value: number;
  onChange: (v: number) => void;
  onDone: () => void;
  onDismiss: () => void;
  s: Record<string, string>;
}) {
  const cfg = PICKER_CONFIG[field];
  const presets = cfg.presets(value);

  function step(delta: number) {
    const nv = +(value + delta).toFixed(cfg.decimals);
    if (nv < cfg.min) return;
    onChange(nv);
  }

  return (
    <div className={s.pickerOverlay} onClick={(e) => { if (e.target === e.currentTarget) onDone(); }}>
      <div className={s.pickerSheet} onClick={(e) => e.stopPropagation()}>
        <div className={s.pickerHeader}>
          <span className={s.pickerTitle}>{cfg.title}</span>
          <span className={s.pickerUnit}>{cfg.unit}</span>
        </div>

        <div className={s.pickerVal}>{cfg.decimals > 0 ? value.toFixed(cfg.decimals) : value}</div>

        <div className={s.pickerSteppers}>
          {cfg.steps.map((delta) => (
            <button
              key={delta}
              className={s.pkStepper}
              onClick={() => step(delta)}
              type="button"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        <div className={s.pickerPresets}>
          {presets.map((p) => (
            <button
              key={p}
              className={`${s.pkPreset} ${p === value ? s.pkPresetActive : ""}`}
              onClick={() => onChange(p)}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>

        <button className={s.pkDone} onClick={onDone} type="button">
          Done
        </button>
      </div>
    </div>
  );
}
