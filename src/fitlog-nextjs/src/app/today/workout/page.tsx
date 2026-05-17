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
    if (!hasValue(s.weight)) { showToast("Add weight first."); openPicker("weight", idx); return; }
    if (!hasValue(s.reps))   { showToast("Add reps first.");   openPicker("reps",   idx); return; }
    if (trackRpe && !hasValue(s.rpe)) { showToast("Add RPE first."); openPicker("rpe", idx); return; }

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
        onOpenPicker={openPicker}
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
  onOpenPicker: (field: PickerField, idx: number) => void;
  onToggleRpe: () => void;
  onToggleAi: () => void;
  onToggleRest: () => void;
  formatRest: (s: number) => string;
  s: Record<string, string>;
}) {
  const { entry, cur, allDone, trackRpe, restOn, restRemaining, restSecs, s } = props;
  const set = !allDone ? entry.sets[cur] : null;

  const hasW = set && hasValue(set.weight);
  const hasR = set && hasValue(set.reps);
  const hasRpe = set && hasValue(set.rpe);
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
          <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
            <div className={s.heroPrimary}>
              <button
                className={`${s.heroNum} ${!hasW ? s.heroNumEmpty : ""}`}
                onClick={() => props.onOpenPicker("weight", cur)}
                type="button"
              >
                {hasW ? String(set!.weight) : "—"}
              </button>
              <span className={s.heroSep}>×</span>
              <button
                className={`${s.heroNum} ${!hasR ? s.heroNumEmpty : ""}`}
                onClick={() => props.onOpenPicker("reps", cur)}
                type="button"
              >
                {hasR ? String(set!.reps) : "—"}
              </button>
              {trackRpe && (
                <>
                  <span className={s.heroSep}>×</span>
                  <button
                    className={`${s.heroNum} ${!hasRpe ? s.heroNumEmpty : ""}`}
                    onClick={() => props.onOpenPicker("rpe", cur)}
                    type="button"
                  >
                    {hasRpe ? String(set!.rpe) : "—"}
                  </button>
                </>
              )}
            </div>
            <div className={s.heroUnitsBar}>
              <span>LB</span>
              <span>REPS</span>
              {trackRpe && <span>RPE</span>}
            </div>
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
