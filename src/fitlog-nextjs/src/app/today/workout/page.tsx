"use client";

// Workout Mode — cassette-deck UI, ported 1:1 from the workout-alt prototype
// (public/workout-alt.html, 2026-05-20). Replaces the prior glass-card layout.
// Data layer is preserved from the previous version: same db helpers, same
// engine functions, same Supabase persistence.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listMovements, listWorkouts, listPlans, upsertWorkout, listFinishedTodayWorkouts,
} from "@/lib/db";
import type { Movement, Workout, WorkoutEntry, SetEntry, PlanItem } from "@/lib/types";
import {
  currentSetIdx, hasValue, defaultSetsFor, logSet, reopenSet, toggleSetType,
  toggleBodyweight, patchSet, addSet, removeSet, allSetsDone, archiveEntryToToday,
} from "@/lib/engine/workout";
import { filterFinishedToday } from "@/lib/engine/today";
import s from "./WorkoutPage.module.css";

// Fader picker config — same min/max/step thresholds as prototype state
const PICKER_CFG = {
  weight: { min: 0, max: 500, step: 5, curve: 2 },
  reps:   { min: 1, max: 30,  step: 1, curve: 1 },
  rpe:    { min: 1, max: 10,  step: 0.5, curve: 1 },
} as const;
type FaderKey = keyof typeof PICKER_CFG;

const FADER_BARS = 14;
const FADER_PAD = 4;

// Inject the Google Fonts stylesheet once on mount — same set used by the prototype.
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Share+Tech+Mono&family=Barlow+Condensed:wght@500;600;700;800&family=Caveat:wght@700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

// SVG-symbol library used by the cassette + bottom-nav + status-bar.
function SvgSymbols() {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <symbol id="wo-chev" viewBox="0 0 24 24">
          <path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="wo-check" viewBox="0 0 24 24">
          <path d="M5 12 L10 17 L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="wo-cal" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 9 H21" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3 V7 M16 3 V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="wo-signal" viewBox="0 0 24 24">
          <rect x="3" y="14" width="3" height="6" fill="currentColor" />
          <rect x="8" y="10" width="3" height="10" fill="currentColor" />
          <rect x="13" y="6" width="3" height="14" fill="currentColor" />
          <rect x="18" y="2" width="3" height="18" fill="currentColor" opacity="0.4" />
        </symbol>
        <symbol id="wo-batt" viewBox="0 0 24 24">
          <rect x="2" y="7" width="18" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="21" y="10" width="2" height="4" fill="currentColor" />
          <rect x="4" y="9" width="13" height="6" fill="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}

export default function WorkoutPageShell() {
  return (
    <Suspense fallback={<div className={s.page} style={{ padding: 24 }}><div style={{ color: '#5e6a82', fontSize: 13 }}>Loading…</div></div>}>
      <WorkoutPage />
    </Suspense>
  );
}

function WorkoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const mid = params.get("mid") ?? "";
  const planId = params.get("planId") ?? "";
  const srcId = params.get("src") ?? "";

  // ── Data state ────────────────────────────────────────────────────────────
  const [mv, setMv] = useState<Movement | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [entry, setEntry] = useState<WorkoutEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const lastEntryRef = useRef<WorkoutEntry | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [aiOn, setAiOn] = useState(false);
  const [faderOpen, setFaderOpen] = useState(false);
  const [restSecs, setRestSecs] = useState(90);
  const [restRemaining, setRestRemaining] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'std' | 'ai'>('std');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual-entry picker (tap an LCD readout to type a value)
  const [picker, setPicker] = useState<{ field: FaderKey; value: string } | null>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  // SVG refs for reels + VU bars
  const reelLRef = useRef<SVGGElement>(null);
  const reelRRef = useRef<SVGGElement>(null);
  const vuBarsRef = useRef<SVGGElement>(null);
  const vuIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fader visual rotation cache (separate from value so dragging spins reels naturally)
  const visualRotRef = useRef<{ weight: number; reps: number }>({ weight: 0, reps: 0 });

  // ── iOS viewport fix — set --vh on root so calc(var(--vh)*100) ≈ window.innerHeight
  useEffect(() => {
    function setVh() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);

  // Inject Google Fonts stylesheet once (idempotent)
  useEffect(() => {
    const id = 'wo-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  // ── Load data ─────────────────────────────────────────────────────────────
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
      const ft = filterFinishedToday(finished);
      const allW = [...wkts, ...ft];
      setAllWorkouts(allW);
      setMv(movement);

      let aw = wkts[0] ?? null;

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

      const prevEntry = (() => {
        const sorted = allW
          .filter((w) => w.finished && w.id !== (aw?.id ?? ''))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        for (const w of sorted) {
          const e = w.entries.find((e) => e.movementId === mid);
          if (e && e.sets?.some((s) => hasValue(s.weight) || hasValue(s.reps))) return e;
        }
        return null;
      })();
      lastEntryRef.current = prevEntry;

      let activeEntry = aw?.entries.find((e) => e.movementId === mid) ?? null;
      if (!activeEntry) {
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
        if (!aw) {
          const today = new Date();
          const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
  useEffect(() => () => { stopRest(); stopVuAnim(); }, []);

  // Preload current set's weight from most-recent completed set (resets reps/rpe).
  useEffect(() => {
    if (!entry) return;
    const cur = currentSetIdx(entry);
    if (cur === -1) return;
    const currentSet = entry.sets[cur];
    const prevDone = entry.sets.slice(0, cur).reverse().find((set) => set.done);
    if (!prevDone) return;
    let changed = false;
    const newSet = { ...currentSet, reps: null, rpe: null };
    if (hasValue(prevDone.weight)) { newSet.weight = prevDone.weight; changed = true; }
    if (hasValue(currentSet.reps) || hasValue(currentSet.rpe)) changed = true;
    if (!changed) return;
    const newSets = entry.sets.map((set, i) => i === cur ? newSet : set);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    persist(newEntry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.sets?.length]);

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

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string, durationMs = 1500, kind: 'std' | 'ai' = 'std') {
    setToast(msg);
    setToastKind(kind);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
  }

  // Matches the canonical nextSetRec thresholds — keeps the prototype and the
  // app's coaching insights in lockstep.
  function computeAiRec(): string | null {
    if (!entry) return null;
    const doneWithRpe = entry.sets.filter((sx) => sx.done && hasValue(sx.rpe));
    if (!doneWithRpe.length) return null;
    const last = doneWithRpe[doneWithRpe.length - 1];
    const rpe = Number(last.rpe);
    if (Number.isNaN(rpe)) return null;
    const w = hasValue(last.weight) ? Number(last.weight) : null;
    const r = hasValue(last.reps)   ? Number(last.reps)   : null;
    const wLabel = w != null ? `${w} lb` : 'same weight';
    const rLabel = r != null ? `${r} reps` : 'same reps';
    if (rpe >= 9.5) return `AI · drop 10 lb · ${rLabel} · high effort last set`;
    if (rpe >= 9)   return `AI · −5–10 lb · ${rLabel} · near max`;
    if (rpe >= 8.5) return `AI · ${wLabel} or −5 lb · ${rLabel}`;
    if (rpe >= 8)   return `AI · hold ${wLabel} · ${rLabel}`;
    if (rpe >= 7)   return `AI · ${wLabel} or +5 lb · ${rLabel}`;
    if (rpe >= 6)   return `AI · +5–10 lb · ${rLabel} · room to push`;
    return `AI · +10 lb · ${rLabel} · effort too low`;
  }

  // ── Rest timer ────────────────────────────────────────────────────────────
  function startRest() {
    stopRest();
    let rem = restSecs;
    setRestRemaining(rem);
    if (reelLRef.current) reelLRef.current.removeAttribute('transform');
    if (reelRRef.current) reelRRef.current.removeAttribute('transform');
    reelLRef.current?.classList.add(s['spinning']);
    reelRRef.current?.classList.add(s['spinning']);
    startVuAnim();
    restIntervalRef.current = setInterval(() => {
      rem--;
      setRestRemaining(rem);
      if (rem <= 0) { stopRest(); showToast('REST COMPLETE'); }
    }, 1000);
  }
  function stopRest() {
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    setRestRemaining(0);
    reelLRef.current?.classList.remove(s['spinning']);
    reelRRef.current?.classList.remove(s['spinning']);
    stopVuAnim();
    resetVuToRpe();
  }
  function startVuAnim() {
    if (vuIntervalRef.current) return;
    vuIntervalRef.current = setInterval(() => {
      const bars = vuBarsRef.current?.children;
      if (!bars) return;
      const lit = Math.floor(Math.random() * 6) + 3;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i] as SVGRectElement;
        if (i < lit) {
          bar.setAttribute('fill', i >= 7 ? '#ff3030' : '#f5ec00');
          bar.setAttribute('opacity', (1 - i * 0.06).toFixed(2));
        } else {
          bar.setAttribute('fill', '#2a2e33');
          bar.setAttribute('opacity', '1');
        }
      }
    }, 130);
  }
  function stopVuAnim() {
    if (vuIntervalRef.current) { clearInterval(vuIntervalRef.current); vuIntervalRef.current = null; }
  }
  function resetVuToRpe() {
    const bars = vuBarsRef.current?.children;
    if (!bars) return;
    const cur = entry ? currentSetIdx(entry) : -1;
    const set = cur >= 0 ? entry!.sets[cur] : null;
    const rpe = set && hasValue(set.rpe) ? Number(set.rpe) : 0;
    const total = bars.length;
    const lit = Math.min(total, Math.round((rpe / 10) * total));
    for (let i = 0; i < total; i++) {
      const bar = bars[i] as SVGRectElement;
      if (i < lit) {
        bar.setAttribute('fill', i >= 7 ? '#ff3030' : '#f5ec00');
        bar.setAttribute('opacity', '1');
      } else {
        bar.setAttribute('fill', '#2a2e33');
        bar.setAttribute('opacity', '1');
      }
    }
  }
  useEffect(() => { resetVuToRpe(); }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatRest(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ── Set actions ───────────────────────────────────────────────────────────
  async function handleLogSet() {
    if (!entry) return;
    const idx = currentSetIdx(entry);
    if (idx === -1) { showToast('ALL SETS COMPLETE'); return; }
    const set = entry.sets[idx];
    if (!hasValue(set.weight)) { showToast('SET A WEIGHT'); return; }
    if (!hasValue(set.reps))   { showToast('SET REPS'); return; }
    const newSets = logSet(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
    showToast(`SET ${idx + 1} LOGGED`);

    if (aiOn) {
      const rec = computeAiRec();
      if (rec) {
        if (aiToastTimerRef.current) clearTimeout(aiToastTimerRef.current);
        aiToastTimerRef.current = setTimeout(() => showToast(rec, 4500, 'ai'), 1600);
      }
    }

    if (allSetsDone(newSets)) {
      await handleComplete(newEntry);
      router.refresh();
      router.push('/today');
      return;
    }
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
    if (entry.sets.length <= 1) { showToast('NEED ≥ 1 SET'); return; }
    if (entry.sets[idx].done && !confirm(`Remove logged set ${idx + 1}?`)) return;
    const newSets = removeSet(entry.sets, idx);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }
  async function handleComplete(completedEntry?: WorkoutEntry) {
    const e = completedEntry ?? entry;
    if (!e || srcId) { router.push('/today'); return; }
    const { workouts: updatedWorkouts, session } = archiveEntryToToday(e, allWorkouts);
    setAllWorkouts(updatedWorkouts);
    await upsertWorkout(session);
    if (activeWorkout) {
      const trimmed: Workout = {
        ...activeWorkout,
        entries: activeWorkout.entries.filter((ae) => ae.movementId !== mid),
      };
      setActiveWorkout(trimmed);
      await upsertWorkout(trimmed);
    }
  }

  async function patchCurrent(field: FaderKey, value: number | null) {
    if (!entry) return;
    const idx = currentSetIdx(entry);
    if (idx === -1) return;
    const newSets = patchSet(entry.sets, idx, field, value as number);
    const newEntry = { ...entry, sets: newSets };
    setEntry(newEntry);
    await persist(newEntry);
  }

  // ── Fader drag ────────────────────────────────────────────────────────────
  const faderRefs = useRef<{ [K in FaderKey]?: HTMLDivElement | null }>({});
  const draggingRef = useRef<{ key: FaderKey; lastY: number } | null>(null);

  function ratioToValue(key: FaderKey, ratio: number): number {
    const cfg = PICKER_CFG[key];
    const curved = cfg.curve > 1 ? Math.pow(ratio, cfg.curve) : ratio;
    const raw = cfg.min + curved * (cfg.max - cfg.min);
    const stepIdx = Math.round((raw - cfg.min) / cfg.step);
    return Math.max(cfg.min, Math.min(cfg.max, cfg.min + stepIdx * cfg.step));
  }
  function valueToRatio(key: FaderKey, value: number): number {
    const cfg = PICKER_CFG[key];
    const base = (value - cfg.min) / (cfg.max - cfg.min);
    return cfg.curve > 1 ? Math.pow(Math.max(0, Math.min(1, base)), 1 / cfg.curve) : Math.max(0, Math.min(1, base));
  }
  function paintFader(key: FaderKey, value: number) {
    const track = faderRefs.current[key];
    if (!track) return;
    const ratio = valueToRatio(key, value);
    const bars = track.querySelectorAll<HTMLDivElement>(`.${s['fader-bar']}`);
    const lit = Math.round(ratio * FADER_BARS);
    bars.forEach((bar, i) => {
      bar.classList.toggle(s['on'], i < lit);
      bar.classList.toggle(s['hot'], i < lit && i >= FADER_BARS - 2);
    });
    const thumb = track.querySelector<HTMLDivElement>(`.${s['fader-thumb']}`);
    if (thumb) {
      const usable = track.clientHeight - FADER_PAD * 2;
      const topPx = FADER_PAD + (1 - ratio) * usable;
      thumb.style.top = `${topPx}px`;
    }
  }
  // Paint faders whenever entry/current changes
  useEffect(() => {
    if (!entry) return;
    const idx = currentSetIdx(entry);
    const set = idx >= 0 ? entry.sets[idx] : null;
    paintFader('weight', set && hasValue(set.weight) ? Number(set.weight) : PICKER_CFG.weight.min);
    paintFader('reps',   set && hasValue(set.reps)   ? Number(set.reps)   : PICKER_CFG.reps.min);
    paintFader('rpe',    set && hasValue(set.rpe)    ? Number(set.rpe)    : PICKER_CFG.rpe.min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, faderOpen]);

  function setupFader(track: HTMLDivElement | null, key: FaderKey) {
    if (!track) return;
    faderRefs.current[key] = track;
    // Build bar children once (idempotent: skip if already populated)
    if (!track.querySelector(`.${s['fader-bar']}`)) {
      const thumb = track.querySelector(`.${s['fader-thumb']}`);
      for (let i = 0; i < FADER_BARS; i++) {
        const bar = document.createElement('div');
        bar.className = s['fader-bar'];
        track.insertBefore(bar, thumb);
      }
    }
  }

  // Pointer/touch fader handlers wired at the page level
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const drag = draggingRef.current;
      if (!drag) return;
      const pt = 'touches' in e ? e.touches[0] : e;
      const cy = pt.clientY;
      const dy = cy - drag.lastY;
      drag.lastY = cy;
      // Rotate the appropriate reel based on drag direction
      const ROT_PER_PX = 3;
      if (drag.key === 'weight' && reelLRef.current) {
        visualRotRef.current.weight -= dy * ROT_PER_PX;
        reelLRef.current.setAttribute('transform', `rotate(${visualRotRef.current.weight} 95 100)`);
      } else if (drag.key === 'reps' && reelRRef.current) {
        visualRotRef.current.reps -= dy * ROT_PER_PX;
        reelRRef.current.setAttribute('transform', `rotate(${visualRotRef.current.reps} 265 100)`);
      }
      const track = faderRefs.current[drag.key];
      if (!track) return;
      const r = track.getBoundingClientRect();
      const usable = r.height - FADER_PAD * 2;
      let relY = cy - r.top - FADER_PAD;
      relY = Math.max(0, Math.min(usable, relY));
      const ratio = 1 - relY / usable;
      const newVal = ratioToValue(drag.key, ratio);
      paintFader(drag.key, newVal);
      patchCurrent(drag.key, newVal);
      if ('touches' in e) e.preventDefault();
    }
    function onUp() {
      const drag = draggingRef.current;
      if (!drag) return;
      faderRefs.current[drag.key]?.classList.remove(s['dragging']);
      draggingRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  function onFaderDown(key: FaderKey, e: React.MouseEvent | React.TouchEvent) {
    const track = faderRefs.current[key];
    if (!track) return;
    track.classList.add(s['dragging']);
    const pt = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    draggingRef.current = { key, lastY: pt.clientY };
    // Apply initial position immediately
    const r = track.getBoundingClientRect();
    const usable = r.height - FADER_PAD * 2;
    let relY = pt.clientY - r.top - FADER_PAD;
    relY = Math.max(0, Math.min(usable, relY));
    const ratio = 1 - relY / usable;
    const newVal = ratioToValue(key, ratio);
    paintFader(key, newVal);
    patchCurrent(key, newVal);
    if ('touches' in e) e.preventDefault();
  }

  // ── Picker (manual entry) ────────────────────────────────────────────────
  function openPicker(field: FaderKey) {
    if (!entry) return;
    const idx = currentSetIdx(entry);
    if (idx === -1) return;
    const set = entry.sets[idx];
    const raw = set[field as keyof SetEntry];
    setPicker({ field, value: hasValue(raw) ? String(raw) : '' });
    requestAnimationFrame(() => pickerInputRef.current?.focus());
  }
  async function commitPicker() {
    if (!picker) return;
    const num = parseFloat(picker.value);
    if (!isNaN(num) && num >= PICKER_CFG[picker.field].min && num <= PICKER_CFG[picker.field].max) {
      await patchCurrent(picker.field, num);
    } else if (picker.value === '') {
      await patchCurrent(picker.field, null);
    }
    setPicker(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className={s.page}><div style={{ padding: 24, color: '#5e6a82', fontSize: 13 }}>Loading…</div></div>;
  }
  if (err || !entry) {
    return <div className={s.page}><div style={{ padding: 24, color: '#b08092', fontSize: 13 }}>{err ?? 'Movement not found.'}</div></div>;
  }

  const cur = currentSetIdx(entry);
  const allDone = cur === -1;
  const curSet = !allDone ? entry.sets[cur] : null;
  const total = entry.sets.length;
  const setNum = !allDone ? cur + 1 : total;
  const bodyPart = ((mv?.bodyPart || mv?.muscle || mv?.category) ?? '—').toUpperCase();
  const name = mv?.name ?? entry.name ?? '—';

  const weightDisplay = curSet && hasValue(curSet.weight) ? String(curSet.weight) : '—';
  const repsDisplay   = curSet && hasValue(curSet.reps)   ? String(curSet.reps)   : '—';
  const rpeDisplay    = curSet && hasValue(curSet.rpe)    ? String(curSet.rpe)    : '—';

  return (
    <div className={s.page}>
      <SvgSymbols />
      <div className={s.phone}>
        {/* Edge rivets — 8 total */}
        <span className={`${s.rivet} ${s['rivet-tl']}`} />
        <span className={`${s.rivet} ${s['rivet-tr']}`} />
        <span className={`${s.rivet} ${s['rivet-bl']}`} />
        <span className={`${s.rivet} ${s['rivet-br']}`} />
        <span className={`${s.rivet} ${s['rivet-tm-l']}`} />
        <span className={`${s.rivet} ${s['rivet-tm-r']}`} />
        <span className={`${s.rivet} ${s['rivet-bm-l']}`} />
        <span className={`${s.rivet} ${s['rivet-bm-r']}`} />
        <span className={`${s['frame-led']} ${s['frame-led-top-l']}`} />
        <span className={`${s['frame-led']} ${s['frame-led-green']} ${s['frame-led-top-r']}`} />

        {/* ── Status bar ── */}
        <div className={s['status-bar']}>
          <div className={s['status-bar-side']}>
            <span className={s['status-led']} />
            <span>SYS.OK</span>
            <span className={s['status-sep']}>|</span>
            <span>v2.1.4</span>
          </div>
          <div className={s['status-bar-side']}>
            <span>MDL-X7</span>
            <span className={s['status-sep']}>|</span>
            <svg style={{ width: 12, height: 12, color: '#6a6e72' }}><use href="#wo-signal" /></svg>
            <svg style={{ width: 14, height: 10, color: '#6a6e72' }}><use href="#wo-batt" /></svg>
            <span className={s['status-yellow']}>84%</span>
          </div>
        </div>

        {/* ── Scrolling content ── */}
        <div className={s.content}>
          {/* Header */}
          <div className={s.header}>
            <span className={`${s['panel-rivet']} ${s['pr-tl']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-tr']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-bl']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-br']}`} />
            <button className={s['icon-btn']} onClick={() => { stopRest(); router.push('/today'); }} aria-label="Back">
              <svg><use href="#wo-chev" /></svg>
            </button>
            <div className={s['header-title']}>
              <div className={s['header-label']}>MOVEMENT</div>
              <div className={s['header-name']}>{name}</div>
              <div className={s['focus-row']}>
                <span className={s['focus-label']}>FOCUS</span>
                <span className={s.tag}>{bodyPart}</span>
              </div>
            </div>
            <button
              className={`${s['ai-btn']} ${aiOn ? s['ai-on'] : ''}`}
              onClick={() => {
                const next = !aiOn;
                setAiOn(next);
                showToast(next ? 'AI ASSIST ON' : 'AI ASSIST OFF');
              }}
              aria-pressed={aiOn}
            >
              <span className={s['ai-led']} />
              <span className={s['ai-big']}>AI</span>
              <span className={s['ai-sub']}>ASSIST</span>
            </button>
          </div>

          {/* ── Cassette panel ── */}
          <div className={`${s.panel} ${s['cassette-panel']}`}>
            <span className={`${s['panel-rivet']} ${s['pr-tl']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-tr']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-bl']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-br']}`} />
            <div className={s['cassette-inner']}>
              <span className={`${s.bracket} ${s['bracket-tl']}`} />
              <span className={`${s.bracket} ${s['bracket-tr']}`} />
              <span className={`${s.bracket} ${s['bracket-bl']}`} />
              <span className={`${s.bracket} ${s['bracket-br']}`} />

              <div className={s['cassette-top']}>
                <div className={s['active-set']}>
                  <span className={s['active-dot']} />
                  <span>ACTIVE SET</span>
                  <span className={s['active-set-counter']}>{setNum} / {total}</span>
                </div>
              </div>

              <div className={s['cassette-svg-wrap']}>
                <svg viewBox="0 0 360 175" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="wo-shellGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(35,40,45,0.85)" />
                      <stop offset="12%" stopColor="rgba(25,28,32,0.78)" />
                      <stop offset="35%" stopColor="rgba(18,21,24,0.72)" />
                      <stop offset="50%" stopColor="rgba(15,17,20,0.70)" />
                      <stop offset="65%" stopColor="rgba(18,21,24,0.72)" />
                      <stop offset="88%" stopColor="rgba(25,28,32,0.78)" />
                      <stop offset="100%" stopColor="rgba(35,40,45,0.85)" />
                    </linearGradient>
                    <linearGradient id="wo-shellEdge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                      <stop offset="4%" stopColor="rgba(255,255,255,0.35)" />
                      <stop offset="48%" stopColor="rgba(255,255,255,0.05)" />
                      <stop offset="52%" stopColor="rgba(255,255,255,0.05)" />
                      <stop offset="95%" stopColor="rgba(255,255,255,0.32)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.75)" />
                    </linearGradient>
                    <linearGradient id="wo-shellEdgeH" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
                      <stop offset="5%" stopColor="rgba(255,255,255,0.20)" />
                      <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="95%" stopColor="rgba(255,255,255,0.20)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.65)" />
                    </linearGradient>
                    <linearGradient id="wo-plasticSheen" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="20%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="35%" stopColor="rgba(255,255,255,0.18)" />
                      <stop offset="42%" stopColor="rgba(255,255,255,0.32)" />
                      <stop offset="48%" stopColor="rgba(255,255,255,0.18)" />
                      <stop offset="62%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                    <linearGradient id="wo-topGloss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                      <stop offset="40%" stopColor="rgba(255,255,255,0.04)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                    <linearGradient id="wo-labelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(40,46,52,0.55)" />
                      <stop offset="100%" stopColor="rgba(10,11,12,0.7)" />
                    </linearGradient>
                    <radialGradient id="wo-reelGrad" cx="0.3" cy="0.3" r="0.85">
                      <stop offset="0%" stopColor="#6a7075" />
                      <stop offset="35%" stopColor="#2a2e33" />
                      <stop offset="100%" stopColor="#050607" />
                    </radialGradient>
                    <radialGradient id="wo-reelInner" cx="0.3" cy="0.3" r="0.8">
                      <stop offset="0%" stopColor="#2a2e33" />
                      <stop offset="100%" stopColor="#050607" />
                    </radialGradient>
                    <radialGradient id="wo-hubGrad" cx="0.3" cy="0.3" r="0.7">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="15%" stopColor="#fff366" />
                      <stop offset="55%" stopColor="#f5ec00" />
                      <stop offset="100%" stopColor="#5a5400" />
                    </radialGradient>
                    <linearGradient id="wo-tapeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3a2a0a" />
                      <stop offset="50%" stopColor="#1a1208" />
                      <stop offset="100%" stopColor="#3a2a0a" />
                    </linearGradient>
                    <pattern id="wo-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    </pattern>
                    <pattern id="wo-tapeWind" patternUnits="userSpaceOnUse" width="2" height="2">
                      <rect width="2" height="2" fill="#1a1208" />
                      <line x1="0" y1="0.5" x2="2" y2="0.5" stroke="rgba(60,40,20,0.5)" strokeWidth="0.3" />
                      <line x1="0" y1="1.5" x2="2" y2="1.5" stroke="rgba(80,55,30,0.3)" strokeWidth="0.3" />
                    </pattern>
                    <radialGradient id="wo-feltPad" cx="0.5" cy="0.4" r="0.6">
                      <stop offset="0%" stopColor="#5a4030" />
                      <stop offset="60%" stopColor="#3a2818" />
                      <stop offset="100%" stopColor="#1a1208" />
                    </radialGradient>
                  </defs>

                  {/* Glass shell */}
                  <rect x="2" y="2" width="356" height="171" rx="7" fill="none" stroke="#000" strokeWidth="1.2" />
                  <rect x="2" y="2" width="356" height="171" rx="7" fill="url(#wo-shellGrad)" />
                  <rect x="2" y="2" width="356" height="171" rx="7" fill="url(#wo-shellEdgeH)" opacity="0.9" />
                  <rect x="2" y="2" width="356" height="171" rx="7" fill="url(#wo-shellEdge)" opacity="0.6" />
                  <rect x="4" y="4" width="352" height="60" rx="5" fill="url(#wo-topGloss)" pointerEvents="none" />
                  <rect x="4" y="4" width="352" height="167" rx="6" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
                  <rect x="6" y="6" width="348" height="163" rx="5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />

                  {/* Corner Phillips screws */}
                  {[[12, 12], [348, 12], [12, 161], [348, 161]].map(([cx, cy], i) => (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="3.5" fill="#5a6065" stroke="#000" strokeWidth="0.6" />
                      <circle cx={cx} cy={cy} r="2.5" fill="#3a3f44" />
                      <line x1={cx - 2} y1={cy - 2} x2={cx + 2} y2={cy + 2} stroke="#000" strokeWidth="0.7" />
                      <line x1={cx + 2} y1={cy - 2} x2={cx - 2} y2={cy + 2} stroke="#000" strokeWidth="0.7" />
                    </g>
                  ))}
                  {/* Center screws */}
                  <circle cx="180" cy="12" r="2.5" fill="#5a6065" stroke="#000" strokeWidth="0.5" />
                  <line x1="178.5" y1="10.5" x2="181.5" y2="13.5" stroke="#000" strokeWidth="0.6" />
                  <line x1="181.5" y1="10.5" x2="178.5" y2="13.5" stroke="#000" strokeWidth="0.6" />
                  <circle cx="180" cy="161" r="2.5" fill="#5a6065" stroke="#000" strokeWidth="0.5" />
                  <line x1="178.5" y1="159.5" x2="181.5" y2="162.5" stroke="#000" strokeWidth="0.6" />
                  <line x1="181.5" y1="159.5" x2="178.5" y2="162.5" stroke="#000" strokeWidth="0.6" />

                  {/* Write-protection tabs */}
                  <rect x="22" y="3" width="14" height="5" rx="0.5" fill="#1a1d20" stroke="#000" strokeWidth="0.4" />
                  <rect x="23" y="4" width="12" height="3" rx="0.3" fill="#0a0b0c" />
                  <rect x="324" y="3" width="14" height="5" rx="0.5" fill="#1a1d20" stroke="#000" strokeWidth="0.4" />
                  <rect x="325" y="4" width="12" height="3" rx="0.3" fill="#0a0b0c" />

                  {/* Label strip + readouts */}
                  <rect x="22" y="10" width="316" height="48" rx="3" fill="url(#wo-labelGrad)" stroke="#000" strokeWidth="0.8" />
                  <rect x="23" y="11" width="314" height="46" rx="2" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                  <text x="32"  y="20" fill="#ffffff" fontFamily="Share Tech Mono, monospace" fontSize="8.5" letterSpacing="1" fontWeight="700">WEIGHT</text>
                  <text x="180" y="20" textAnchor="middle" fill="#ffffff" fontFamily="Share Tech Mono, monospace" fontSize="8.5" letterSpacing="1" fontWeight="700">RPE</text>
                  <text x="328" y="20" textAnchor="end" fill="#ffffff" fontFamily="Share Tech Mono, monospace" fontSize="8.5" letterSpacing="1" fontWeight="700">REPS</text>
                  <text x="95"  y="40" textAnchor="middle" dominantBaseline="central" fill="#f5ec00" fontFamily="Share Tech Mono, monospace" fontSize="34" fontWeight="700" letterSpacing="1" style={{ filter: 'drop-shadow(0 0 5px rgba(245,236,0,0.7))', cursor: 'pointer' }} onClick={() => openPicker('weight')}>{weightDisplay}</text>
                  <text x="180" y="40" textAnchor="middle" dominantBaseline="central" fill="#f5ec00" fontFamily="Share Tech Mono, monospace" fontSize="34" fontWeight="700" letterSpacing="1" style={{ filter: 'drop-shadow(0 0 5px rgba(245,236,0,0.7))', cursor: 'pointer' }} onClick={() => openPicker('rpe')}>{rpeDisplay}</text>
                  <text x="265" y="40" textAnchor="middle" dominantBaseline="central" fill="#f5ec00" fontFamily="Share Tech Mono, monospace" fontSize="34" fontWeight="700" letterSpacing="1" style={{ filter: 'drop-shadow(0 0 5px rgba(245,236,0,0.7))', cursor: 'pointer' }} onClick={() => openPicker('reps')}>{repsDisplay}</text>
                  <text x="180" y="54" textAnchor="middle" fill="#5a6065" fontFamily="Barlow Condensed, sans-serif" fontSize="5" letterSpacing="2" fontWeight="700" opacity="0.75">— TAP NUMBER TO EDIT —</text>

                  {/* Tape line between reels */}
                  <path d="M 95 100 Q 180 70 265 100" stroke="url(#wo-tapeGrad)" strokeWidth="3" fill="none" opacity="0.55" />
                  <path d="M 95 100 Q 180 70 265 100" stroke="rgba(245,236,0,0.15)" strokeWidth="1" fill="none" />

                  {/* Left reel */}
                  <g ref={reelLRef} className={s.reel}>
                    <circle cx="95" cy="100" r="42" fill="url(#wo-reelGrad)" stroke="#000" strokeWidth="1.3" />
                    <circle cx="95" cy="100" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
                    <circle cx="95" cy="100" r="36" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="0.6" />
                    <g fill="#5a6065" stroke="#000" strokeWidth="0.4">
                      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((rot, i) => (
                        <rect key={i} x="92.5" y="62" width="5" height="14" rx="1" transform={`rotate(${rot} 95 100)`} />
                      ))}
                    </g>
                    <circle cx="95" cy="100" r="22" fill="url(#wo-reelInner)" stroke="#000" strokeWidth="0.8" />
                    <circle cx="95" cy="100" r="22" fill="url(#wo-hatch)" opacity="0.5" />
                    <circle cx="95" cy="100" r="20" fill="url(#wo-tapeWind)" opacity="0.9" />
                    <circle cx="95" cy="100" r="20" fill="none" stroke="#0a0805" strokeWidth="0.5" />
                    <circle cx="95" cy="100" r="18.5" fill="none" stroke="rgba(60,40,20,0.4)" strokeWidth="0.3" />
                    <circle cx="95" cy="100" r="16" fill="none" stroke="rgba(60,40,20,0.35)" strokeWidth="0.3" />
                    <circle cx="95" cy="100" r="14" fill="none" stroke="rgba(70,48,25,0.3)" strokeWidth="0.3" />
                    <circle cx="95" cy="100" r="12" fill="#0a0805" stroke="#000" strokeWidth="0.4" />
                    <g fill="#3a3f44" stroke="#000" strokeWidth="0.3">
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((rot, i) => (
                        <rect key={i} x="93" y="83" width="4" height="6" transform={`rotate(${rot} 95 100)`} />
                      ))}
                    </g>
                    <circle cx="95" cy="100" r="11" fill="url(#wo-hubGrad)" stroke="#000" strokeWidth="0.7" />
                    <circle cx="95" cy="100" r="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
                    <g fill="#1a1208" stroke="#000" strokeWidth="0.2">
                      {[0, 60, 120, 180, 240, 300].map((rot, i) => (
                        <rect key={i} x="93.5" y="91" width="3" height="3.5" transform={`rotate(${rot} 95 100)`} />
                      ))}
                    </g>
                    <circle cx="95" cy="100" r="3.5" fill="#050607" stroke="#000" strokeWidth="0.4" />
                    <circle cx="95" cy="100" r="1.2" fill="#7a7400" />
                  </g>

                  {/* RPE box with VU bars */}
                  <g>
                    <rect x="152" y="62" width="56" height="78" rx="4" fill="#050607" stroke="#000" strokeWidth="1" />
                    <rect x="153" y="63" width="54" height="76" rx="3" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                    <text x="180" y="72" textAnchor="middle" fill="#ffffff" fontFamily="Share Tech Mono, monospace" fontSize="8" fontWeight="700" letterSpacing="1">RPE</text>
                    <text x="180" y="138" textAnchor="middle" fill="#f5ec00" fontFamily="Share Tech Mono, monospace" fontSize="9" fontWeight="700" letterSpacing="1" style={{ filter: 'drop-shadow(0 0 3px rgba(245,236,0,0.7))' }}>{rpeDisplay}</text>
                    <g ref={vuBarsRef} transform="translate(157, 77)">
                      {[50, 44, 38, 32, 26, 20, 14, 8, 2].map((y, i) => (
                        <rect key={i} x="0" y={y} width="46" height="3" fill={i < 4 ? '#f5ec00' : '#2a2e33'} opacity={i < 4 ? String(0.95 - i * 0.1) : '1'} />
                      ))}
                    </g>
                    <g stroke="#7c8085" strokeWidth="0.5">
                      <line x1="156" y1="79" x2="158" y2="79" />
                      <line x1="156" y1="115" x2="158" y2="115" />
                      <line x1="204" y1="79" x2="206" y2="79" />
                      <line x1="204" y1="115" x2="206" y2="115" />
                    </g>
                  </g>

                  {/* Right reel */}
                  <g ref={reelRRef} className={s.reel}>
                    <circle cx="265" cy="100" r="42" fill="url(#wo-reelGrad)" stroke="#000" strokeWidth="1.3" />
                    <circle cx="265" cy="100" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
                    <circle cx="265" cy="100" r="36" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="0.6" />
                    <g fill="#5a6065" stroke="#000" strokeWidth="0.4">
                      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((rot, i) => (
                        <rect key={i} x="262.5" y="62" width="5" height="14" rx="1" transform={`rotate(${rot} 265 100)`} />
                      ))}
                    </g>
                    <circle cx="265" cy="100" r="22" fill="url(#wo-reelInner)" stroke="#000" strokeWidth="0.8" />
                    <circle cx="265" cy="100" r="22" fill="url(#wo-hatch)" opacity="0.5" />
                    <circle cx="265" cy="100" r="20" fill="url(#wo-tapeWind)" opacity="0.9" />
                    <circle cx="265" cy="100" r="20" fill="none" stroke="#0a0805" strokeWidth="0.5" />
                    <circle cx="265" cy="100" r="18.5" fill="none" stroke="rgba(60,40,20,0.4)" strokeWidth="0.3" />
                    <circle cx="265" cy="100" r="16" fill="none" stroke="rgba(60,40,20,0.35)" strokeWidth="0.3" />
                    <circle cx="265" cy="100" r="14" fill="none" stroke="rgba(70,48,25,0.3)" strokeWidth="0.3" />
                    <circle cx="265" cy="100" r="12" fill="#0a0805" stroke="#000" strokeWidth="0.4" />
                    <g fill="#3a3f44" stroke="#000" strokeWidth="0.3">
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((rot, i) => (
                        <rect key={i} x="263" y="83" width="4" height="6" transform={`rotate(${rot} 265 100)`} />
                      ))}
                    </g>
                    <circle cx="265" cy="100" r="11" fill="url(#wo-hubGrad)" stroke="#000" strokeWidth="0.7" />
                    <circle cx="265" cy="100" r="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
                    <g fill="#1a1208" stroke="#000" strokeWidth="0.2">
                      {[0, 60, 120, 180, 240, 300].map((rot, i) => (
                        <rect key={i} x="263.5" y="91" width="3" height="3.5" transform={`rotate(${rot} 265 100)`} />
                      ))}
                    </g>
                    <circle cx="265" cy="100" r="3.5" fill="#050607" stroke="#000" strokeWidth="0.4" />
                    <circle cx="265" cy="100" r="1.2" fill="#7a7400" />
                  </g>

                  {/* Specular reflections (drawn last) */}
                  <rect x="2" y="2" width="356" height="171" rx="7" fill="url(#wo-plasticSheen)" pointerEvents="none" />
                  <rect x="8" y="3" width="344" height="3" rx="1.5" fill="rgba(255,255,255,0.6)" pointerEvents="none" />
                  <rect x="14" y="6" width="332" height="1" rx="0.5" fill="rgba(255,255,255,0.25)" pointerEvents="none" />
                  <rect x="8" y="169" width="344" height="2" rx="1" fill="rgba(255,255,255,0.18)" pointerEvents="none" />
                  <circle cx="20" cy="14" r="1.5" fill="rgba(255,255,255,0.7)" pointerEvents="none" />
                  <circle cx="340" cy="14" r="1" fill="rgba(255,255,255,0.4)" pointerEvents="none" />
                  <ellipse cx="60" cy="30" rx="50" ry="14" fill="rgba(255,255,255,0.07)" pointerEvents="none" />

                  {/* Felt pad + tape path */}
                  <rect x="148" y="132" width="64" height="8" rx="0.5" fill="url(#wo-feltPad)" stroke="#000" strokeWidth="0.4" />
                  <rect x="148" y="132" width="64" height="8" rx="0.5" fill="url(#wo-hatch)" opacity="0.6" />
                  <rect x="80" y="139" width="200" height="3" fill="#1a1208" stroke="#000" strokeWidth="0.3" opacity="0.85" />
                  <circle cx="80" cy="140.5" r="2.2" fill="#7a8085" stroke="#000" strokeWidth="0.4" />
                  <circle cx="80" cy="140.5" r="1" fill="#0a0b0c" />
                  <circle cx="280" cy="140.5" r="2.2" fill="#7a8085" stroke="#000" strokeWidth="0.4" />
                  <circle cx="280" cy="140.5" r="1" fill="#0a0b0c" />

                  {/* Bottom timer strip */}
                  <g>
                    <rect x="22" y="146" width="316" height="20" rx="3" fill="#050607" stroke="#000" strokeWidth="0.8" />
                    <rect x="23" y="147" width="314" height="18" rx="2" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                    <g style={{ cursor: 'pointer' }} onClick={() => {
                      const input = prompt('Set rest time in seconds (e.g. 90):', String(restSecs));
                      if (input) {
                        const n = parseInt(input, 10);
                        if (!isNaN(n) && n > 0 && n < 3600) {
                          setRestSecs(n);
                          showToast(`REST ${formatRest(n)}`);
                        }
                      }
                    }}>
                      <text x="180" y="161" textAnchor="middle" fill="#f5ec00" fontFamily="Share Tech Mono, monospace" fontSize="14" fontWeight="700" letterSpacing="4" style={{ filter: 'drop-shadow(0 0 5px rgba(245,236,0,0.7))' }}>
                        {formatRest(restRemaining > 0 ? restRemaining : restSecs)}
                      </text>
                    </g>
                    <text x="32" y="159" fill="#7c8085" fontFamily="Barlow Condensed, sans-serif" fontSize="8" fontWeight="700" letterSpacing="2">⏵ REST</text>
                    <text x="328" y="159" textAnchor="end" fill="#7c8085" fontFamily="Barlow Condensed, sans-serif" fontSize="8" fontWeight="700" letterSpacing="2">TIMER ⏸</text>
                  </g>
                </svg>
                <div className={s['tape-edit-hint']}>TAP TIMER TO EDIT</div>
              </div>

              <div className={s['cassette-btn-row']}>
                <button
                  type="button"
                  className={`${s['cassette-open-btn']} ${faderOpen ? s['is-open'] : ''}`}
                  aria-expanded={faderOpen}
                  onClick={() => setFaderOpen((v) => !v)}
                >
                  <span className={s['open-arrow']}>▼</span>
                  <span>{faderOpen ? 'CLOSE' : 'OPEN'}</span>
                  <span className={s['open-arrow']}>▼</span>
                </button>
                <button
                  type="button"
                  className={s['cassette-log-btn']}
                  onClick={handleLogSet}
                  disabled={allDone}
                >
                  <span className={s['play-tri']}>▶</span>
                  <span>LOG SET {setNum}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Faders ── */}
          <div className={`${s['mixer-wrap']} ${faderOpen ? s['is-open'] : ''}`}>
            <div className={`${s.panel} ${s['mixer-panel']}`}>
              <span className={`${s['panel-rivet']} ${s['pr-tl']}`} />
              <span className={`${s['panel-rivet']} ${s['pr-tr']}`} />
              <span className={`${s['panel-rivet']} ${s['pr-bl']}`} />
              <span className={`${s['panel-rivet']} ${s['pr-br']}`} />
              <div className={s['panel-strip']}>
                <div className={s['panel-strip-side']}><span className={s['strip-led']} /><span>FADER.CTRL</span></div>
                <div className={s['panel-strip-side']}><span>3-CH</span><span className={s['strip-led']} /></div>
              </div>
              <div className={s['mixer-row']}>
                {(['weight', 'rpe', 'reps'] as FaderKey[]).map((key) => (
                  <div className={s['fader-col']} key={key}>
                    <div
                      ref={(el) => setupFader(el, key)}
                      className={s['fader-track']}
                      data-key={key}
                      onMouseDown={(e) => onFaderDown(key, e)}
                      onTouchStart={(e) => onFaderDown(key, e)}
                    >
                      <div className={s['fader-ticks']} />
                      <div className={s['fader-zero']} />
                      <div className={s['fader-thumb']} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Log panel ── */}
          <div className={`${s.panel} ${s['log-panel']}`}>
            <span className={`${s['panel-rivet']} ${s['pr-tl']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-tr']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-bl']}`} />
            <span className={`${s['panel-rivet']} ${s['pr-br']}`} />
            <div className={s['log-header']}>
              <div className={s['log-title']}>LOGGED SETS</div>
              <div className={s['log-day']}>
                <span>TODAY</span>
                <svg><use href="#wo-cal" /></svg>
              </div>
            </div>
            <div>
              {entry.sets.map((set, i) => {
                const isCurrent = !allDone && i === cur;
                const isFuture = !set.done && !isCurrent;
                const rowCls = [
                  s['log-row'],
                  isCurrent ? s.current : '',
                  isFuture ? s.future : '',
                ].filter(Boolean).join(' ');
                return (
                  <div key={i} className={rowCls}>
                    <div className={s['log-num']}>{String(i + 1).padStart(2, '0')}</div>
                    <div className={s['log-tags']}>
                      <button
                        type="button"
                        className={`${s['log-tag']} ${set.warmup ? s['tag-warmup'] : ''}`}
                        onClick={() => handleToggleType(i)}
                      >
                        {set.warmup ? 'WU' : 'WS'}
                      </button>
                      <button
                        type="button"
                        className={`${s['log-tag']} ${set.bw ? s['tag-bw'] : ''}`}
                        onClick={() => handleToggleBW(i)}
                      >
                        {set.bw ? 'BW' : '—'}
                      </button>
                    </div>
                    <div className={`${s['log-value']} ${!hasValue(set.weight) ? s.empty : ''}`}>
                      {hasValue(set.weight) ? (
                        <>
                          {set.weight}<span className={s['x-sep']}>×</span>{hasValue(set.reps) ? set.reps : '—'}
                          {hasValue(set.rpe) && <span className={s['log-rpe']}>@ {String(set.rpe)}</span>}
                        </>
                      ) : '— × —'}
                    </div>
                    <button
                      type="button"
                      className={`${s['log-check']} ${set.done ? s.done : ''}`}
                      onClick={() => set.done ? handleReopenSet(i) : undefined}
                      aria-label={set.done ? 'Reopen set' : 'Pending'}
                    />
                    <button
                      type="button"
                      className={s['log-remove']}
                      onClick={() => handleRemoveSet(i)}
                      aria-label="Remove set"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className={s['add-set']} onClick={handleAddSet}>+ ADD SET</button>
            {!allDone && entry.sets.some((s) => s.done) && (
              <button
                type="button"
                className={s['complete-btn']}
                onClick={async () => { await handleComplete(); router.push('/today'); }}
              >
                FINISH WORKOUT
              </button>
            )}
          </div>
        </div>

        {/* ── Bottom nav — wired to real routes ── */}
        <div className={s['bottom-nav-wrap']}>
          <div className={s['nav-strip']}>
            <span className={s['nav-strip-led']} />
            <span>SYS-NAV ◆ MDL-X7</span>
            <span className={s['nav-strip-led']} />
          </div>
          <div className={s['bottom-nav']}>
            <button className={s['nav-btn']} onClick={() => router.push('/today')}>
              <span className={s['nav-icon']}>◄◄</span>
              <span className={s['nav-label']}>TODAY</span>
            </button>
            <button className={s['nav-btn']} onClick={() => router.push('/momentum')}>
              <span className={s['nav-icon']}>▮▯▯</span>
              <span className={s['nav-label']}>INSIGHTS</span>
            </button>
            <button className={`${s['nav-btn']} ${s.active}`}>
              <span className={s['nav-icon']}>▶ <span className={s['nav-icon-label']}>PLAY</span></span>
              <span className={s['nav-label']}>WORKOUT</span>
            </button>
            <button className={s['nav-btn']} onClick={() => router.push('/plan')}>
              <span className={s['nav-icon']}>▣</span>
              <span className={s['nav-label']}>PLAN</span>
            </button>
            <button className={s['nav-btn']} onClick={() => router.push('/more')}>
              <span className={s['nav-icon']}>►►</span>
              <span className={s['nav-label']}>MORE</span>
            </button>
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div className={`${s.toast} ${s.show} ${toastKind === 'ai' ? s.ai : ''}`}>
            {toast}
          </div>
        )}

        {/* ── Picker overlay (manual entry) ── */}
        {picker && (
          <div className={s['picker-backdrop']} onClick={() => setPicker(null)}>
            <div className={s['picker-sheet']} onClick={(e) => e.stopPropagation()}>
              <div className={s['picker-header']}>SET {picker.field.toUpperCase()}</div>
              <input
                ref={pickerInputRef}
                className={s['picker-input']}
                type="number"
                inputMode="decimal"
                step={PICKER_CFG[picker.field].step}
                min={PICKER_CFG[picker.field].min}
                max={PICKER_CFG[picker.field].max}
                value={picker.value}
                onChange={(e) => setPicker((p) => p ? { ...p, value: e.target.value } : p)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitPicker(); }}
              />
              <div className={s['picker-actions']}>
                <button className={s['picker-cancel']} onClick={() => setPicker(null)}>CANCEL</button>
                <button className={s['picker-ok']} onClick={commitPicker}>OK</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
