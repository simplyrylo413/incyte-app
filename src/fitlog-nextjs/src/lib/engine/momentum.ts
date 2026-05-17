// Momentum-screen engine — pure analytics helpers.
// Ported from src/fitlog-mobile.html:
//   computeOverallFatiguePct()  — line 20606
//   _heroLastNFinished()        — line 20698
//   _heroFinishedThisWeek()     — line 20575
//   renderFatigueCard()         — line 21015
//   renderPRCard()              — line 21370
//   calculate1RM()              — line 10844
//   analyzeWorkoutPerformance() — line 10931
//   rpeToRir(), calibrateRpe()  — lines 10713, 15584
// No DOM, no Supabase. All functions take plain data arrays and return results.

import type { Workout, Movement, WorkoutEntry, SetEntry } from "@/lib/types";

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

function rpeToRir(rpe: number | null | undefined): number {
  const r = Number(rpe);
  if (!r || r <= 0) return 2;
  return clamp(10 - r, 0, 6);
}

function calibrateRpe(rpe: number | null | undefined): number {
  const r = Number(rpe) || 0;
  if (r <= 0) return 0;
  return Math.max(0, r - 0.4 - Math.max(0, r - 6.5) * 0.3);
}

// Calendar-day distance (midnight-to-midnight). Returns null if timestamp is falsy.
function calendarDays(ts: number | null): number | null {
  if (!ts) return null;
  const last = new Date(ts);
  last.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - last.getTime()) / 86400000);
}

// HTML build line 12242
const MUSCLE_KEY_ALIASES: Record<string, string> = {
  triceps: "tricepts",
  biceps: "bicepts",
  swimming: "cardio",
};

export const MUSCLE_UPPER = [
  { key: "chest",     label: "Chest" },
  { key: "back",      label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "bicepts",   label: "Biceps" },
  { key: "tricepts",  label: "Triceps" },
  { key: "core",      label: "Core" },
];

export const MUSCLE_LOWER = [
  { key: "quads",      label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes",     label: "Glutes" },
  { key: "calves",     label: "Calves" },
];

const SMALL_MUSCLES = new Set(["bicepts", "tricepts", "calves", "core"]);

/** Maps a movement record to its canonical muscle key. */
export function mvMuscleKey(mv: Movement): string {
  const raw = ((mv.muscle ?? mv.category) ?? "other")
    .toLowerCase()
    .replace(/\s+/g, "");
  return MUSCLE_KEY_ALIASES[raw] ?? raw;
}

function isCardioMv(mv: Movement): boolean {
  const key = mvMuscleKey(mv);
  return key === "cardio";
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Last N finished workouts, newest first. HTML build line 20698. */
export function heroLastNFinished(workouts: Workout[], n: number): Workout[] {
  return workouts
    .filter((w) => w?.finished)
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
    .slice(0, n);
}

/** Finished workouts in the last 7 calendar days. HTML build line 20575. */
export function heroFinishedThisWeek(workouts: Workout[]): Workout[] {
  const weekAgo = Date.now() - 7 * 86400000;
  return workouts.filter(
    (w) => w?.finished && w.date && new Date(w.date).getTime() >= weekAgo
  );
}

// ─── Fatigue ──────────────────────────────────────────────────────────────────

/**
 * Decay factor for volume fatigue. Small muscles recover faster.
 * HTML build line 20613.
 */
function decayFactor(days: number, isSmall: boolean): number {
  if (days <= 0) return 1.0;
  if (isSmall) {
    if (days === 1) return 0.4;
    if (days === 2) return 0.15;
    return 0;
  }
  if (days === 1) return 0.65;
  if (days === 2) return 0.35;
  if (days === 3) return 0.15;
  return 0;
}

/**
 * Overall fatigue 0-100. 60% max + 40% mean of trained muscles.
 * Ports computeOverallFatiguePct() (HTML build line 20606).
 */
export function computeOverallFatiguePct(
  workouts: Workout[],
  movements: Movement[]
): number {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const weekAgo = Date.now() - 7 * 86400000;

  const setsByMuscle: Record<string, number> = {};
  const lastByMuscle: Record<string, number> = {};

  for (const w of workouts) {
    if (!w?.finished) continue;
    const ts = new Date(w.date ?? w.savedAt ?? 0).getTime();
    if (!isFinite(ts)) continue;
    for (const e of w.entries ?? []) {
      const mv = mvMap.get(e.movementId ?? "");
      if (!mv || isCardioMv(mv)) continue;
      const key = mvMuscleKey(mv);
      let setCount = 0;
      for (const s of e.sets ?? []) {
        if (s.done && !s.warmup) setCount++;
      }
      if (ts >= weekAgo && setCount > 0) {
        setsByMuscle[key] = (setsByMuscle[key] ?? 0) + setCount;
      }
      const hasDone = (e.sets ?? []).some((s) => s.done);
      if (hasDone && (!lastByMuscle[key] || ts > lastByMuscle[key])) {
        lastByMuscle[key] = ts;
      }
    }
  }

  const fatigues: number[] = [];
  for (const [key, sets] of Object.entries(setsByMuscle)) {
    const lastTs = lastByMuscle[key] ?? null;
    const days = calendarDays(lastTs);
    if (days == null) continue;
    const isSmall = SMALL_MUSCLES.has(key);
    const vol = Math.min(100, sets * 6.5);
    const pct = Math.round(vol * decayFactor(days, isSmall));
    if (pct > 0) fatigues.push(pct);
  }

  if (!fatigues.length) return 0;
  const maxF = Math.max(...fatigues);
  const avgF = fatigues.reduce((a, b) => a + b, 0) / fatigues.length;
  return Math.round(0.6 * maxF + 0.4 * avgF);
}

/** Per-muscle fatigue breakdown for the Recovery Map card. */
export type MuscleFatigueRow = {
  key: string;
  label: string;
  sets: number;
  pct: number;
  tier: "low" | "med" | "high";
  daysAgo: number | null;
};

export function computeMuscleFatigue(
  workouts: Workout[],
  movements: Movement[],
  tab: "upper" | "lower"
): MuscleFatigueRow[] {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const weekAgo = Date.now() - 7 * 86400000;
  const MUSCLES = tab === "upper" ? MUSCLE_UPPER : MUSCLE_LOWER;

  const setsByMuscle: Record<string, number> = {};
  const lastByMuscle: Record<string, number> = {};
  MUSCLES.forEach((b) => { setsByMuscle[b.key] = 0; });

  // Walk lifetime finished workouts — need full history for "last trained" date.
  for (const w of workouts) {
    if (!w?.finished) continue;
    const ts = new Date(w.date ?? w.savedAt ?? 0).getTime();
    if (!isFinite(ts)) continue;
    for (const e of w.entries ?? []) {
      const mv = mvMap.get(e.movementId ?? "");
      if (!mv || isCardioMv(mv)) continue;
      const key = mvMuscleKey(mv);
      if (!(key in setsByMuscle) && tab === "upper") continue;
      if (tab === "lower" && !MUSCLE_LOWER.find((b) => b.key === key)) continue;
      let setCount = 0;
      for (const s of e.sets ?? []) {
        if (s.done && !s.warmup) setCount++;
      }
      if (ts >= weekAgo && setCount > 0) {
        setsByMuscle[key] = (setsByMuscle[key] ?? 0) + setCount;
      }
      const hasDone = (e.sets ?? []).some((s) => s.done);
      if (hasDone && (!lastByMuscle[key] || ts > lastByMuscle[key])) {
        lastByMuscle[key] = ts;
      }
    }
  }

  return MUSCLES.map(({ key, label }) => {
    const sets = setsByMuscle[key] ?? 0;
    const lastTs = lastByMuscle[key] ?? null;
    const days = calendarDays(lastTs);
    const isSmall = SMALL_MUSCLES.has(key);
    let pct = 0;
    if (sets > 0 && lastTs != null && days != null) {
      const vol = Math.min(100, sets * 6.5);
      pct = Math.round(vol * decayFactor(days, isSmall));
    }
    const tier: "low" | "med" | "high" = pct >= 60 ? "high" : pct >= 25 ? "med" : "low";
    return { key, label, sets, pct, tier, daysAgo: days };
  });
}

// ─── Readiness ────────────────────────────────────────────────────────────────

export type ReadinessScores = {
  readiness: number | null;
  recovery: number;
  fatigue: number;
  title: string;
  recAction: string;
  recBullets: string[];
  recTone: "high" | "med" | "pos" | "";
  readinessCap: string;
  recoveryCap: string;
  fatigueCap: string;
};

/**
 * Compute Readiness, Recovery, Fatigue scores and training recommendation.
 * Simplified port of renderReadinessCard() — HTML build line 20704.
 * readiness: avg calibrated-RIR-based score from last 5 sessions.
 * recovery: days-since-last proxy (50 + days × 16, max 100).
 * fatigue: computeOverallFatiguePct().
 */
export function computeReadiness(
  workouts: Workout[],
  movements: Movement[]
): ReadinessScores {
  const recent = heroLastNFinished(workouts, 5);
  const last = recent[0] ?? null;
  const daysSince = last
    ? Math.max(0, calendarDays(new Date(last.date ?? last.savedAt ?? 0).getTime()) ?? 7)
    : 7;
  const recovery = Math.min(100, 50 + daysSince * 16);
  const totalFatigue = computeOverallFatiguePct(workouts, movements);
  const fatigueScore = Math.min(100, totalFatigue);

  // Readiness proxy from avg calibrated RPE across recent working sets.
  let rpeSum = 0, rpeN = 0;
  for (const w of recent) {
    for (const e of w.entries ?? []) {
      for (const s of e.sets ?? []) {
        if (s.done && !s.warmup && s.rpe != null && Number(s.rpe) > 0) {
          const calRpe = calibrateRpe(Number(s.rpe));
          const calRir = rpeToRir(calRpe);
          rpeSum += clamp(40 + calRir * 6.0, 0, 100);
          rpeN++;
        }
      }
    }
  }
  const readiness: number | null =
    rpeN >= 2 ? Math.round(rpeSum / rpeN) : null;

  // Title
  let title = "Ready to train";
  if (readiness == null) {
    title = "Log a session to begin";
  } else if (fatigueScore >= 75) {
    title = "Heavy week — back off and deload";
  } else if (fatigueScore >= 50) {
    title = readiness >= 60 ? "Trainable — but cap volume" : "Heavy week — keep it light";
  } else if (readiness >= 78) {
    title = "Recovery strong — push today";
  } else if (readiness >= 60) {
    title = "Solid baseline — train normally";
  } else if (readiness >= 40) {
    title = "Mixed signal — keep it controlled";
  } else {
    title = "Recovery limited";
  }

  // Readiness caption
  let readinessCap = "—";
  if (readiness == null) readinessCap = "Awaiting data";
  else if (fatigueScore >= 75) readinessCap = "Strong · but deload first";
  else if (fatigueScore >= 50) readinessCap = "Strong · cap volume today";
  else if (readiness >= 78) readinessCap = "Strong · push today";
  else if (readiness >= 60) readinessCap = "Steady · train normally";
  else if (readiness >= 40) readinessCap = "Mixed · keep it controlled";
  else readinessCap = "Limited · ease up";

  // Recovery caption
  let recoveryCap = "No prior log";
  if (daysSince === 0) recoveryCap = "Trained today";
  else if (daysSince === 1) recoveryCap = "1 day rest · fresh";
  else if (daysSince <= 3) recoveryCap = `${daysSince} days rest · well recovered`;
  else recoveryCap = `${daysSince}+ days rest · re-engage soon`;

  // Fatigue caption
  let fatigueCap = "Awaiting data";
  if (fatigueScore < 25) fatigueCap = "Light · room to push";
  else if (fatigueScore < 50) fatigueCap = "Moderate · normal session load";
  else if (fatigueScore < 75) fatigueCap = "Heavy · cap volume";
  else fatigueCap = "Very heavy · consider deload";

  // Training recommendation (simplified from HTML build lines 20768–20890)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trainedToday = workouts.some((w) => {
    if (!w?.finished) return false;
    const ts = new Date(w.date ?? w.savedAt ?? 0);
    ts.setHours(0, 0, 0, 0);
    return ts.getTime() === today.getTime();
  });

  let recAction = "Log a session to get guidance";
  let recBullets: string[] = [
    "Finish a workout with RPE noted",
    "The engine needs ~2 sessions to start tuning",
  ];
  let recTone: "high" | "med" | "pos" | "" = "";

  if (readiness != null) {
    if (trainedToday && fatigueScore >= 75) {
      recAction = "Heavy load already accumulated · keep further work light";
      recBullets = [
        "Weekly fatigue is high — be selective with additional sets",
        "Drop top-set weights 10–15% and stay at RPE 6–7",
        "Skip extra cardio finishers",
        "Sleep + protein remain the limiting factor",
      ];
      recTone = "high";
    } else if (trainedToday && fatigueScore >= 50) {
      recAction = "Solid load logged · stay deliberate with anything more";
      recBullets = [
        "Already a meaningful session — cap any follow-up work",
        "Mobility or zone-2 cardio fit well alongside what you logged",
        "Avoid a second peaking effort today",
        "Sleep + protein priority",
      ];
      recTone = "med";
    } else if (trainedToday) {
      recAction = "Work logged · headroom remains for more if you want it";
      recBullets = [
        "Weekly load still moderate — additional sets are an option",
        "Keep any follow-up sets calibrated (RPE 6–8)",
        "Mobility or zone-2 cardio fit cleanly alongside today",
        "Recovery (sleep, protein) compounds either way",
      ];
      recTone = "pos";
    } else if (fatigueScore >= 75) {
      recAction = "Skip training today · rest priority";
      recBullets = [
        "Weekly load is very heavy — skip resistance training",
        "Mobility or light walking ok if you want movement",
        "Sleep + protein priority",
        "Tomorrow: deload — drop top-set weights ~10–15%",
      ];
      recTone = "high";
    } else if (fatigueScore >= 50 && readiness >= 60) {
      recAction = "Train light · cap volume today";
      recBullets = [
        "Drop top-set weights ~5–10% from prescribed",
        "Cap working sets at 2 per movement",
        "Stay at RPE 6–7 (leave 3–4 reps in reserve)",
        "Skip 1RM attempts and amrap finishers",
      ];
      recTone = "med";
    } else if (fatigueScore >= 50) {
      recAction = "Recovery session only today";
      recBullets = [
        "Skip lifting today",
        "Mobility, light cardio (zone 2), or technique drills",
        "Sleep + protein priority",
      ];
      recTone = "med";
    } else if (readiness >= 78) {
      recAction = "Push your planned session today";
      recBullets = [
        "Recovery is solid — go for prescribed weights",
        "Add 5–10 lb to your top set if you cleared all reps last time",
        "Stop sets at RPE 8 — quality over chasing failure",
      ];
      recTone = "pos";
    } else if (readiness >= 60) {
      recAction = "Train as planned today";
      recBullets = [
        "Aim for prescribed sets × reps at planned RPE",
        "Stop a set 1–2 reps short if form breaks",
        "Note RPE on each working set so the engine learns",
      ];
      recTone = "pos";
    } else if (readiness >= 40) {
      recAction = "Train light today · keep it controlled";
      recBullets = [
        "Drop top-set weights ~5–10% from prescribed",
        "Stay at RPE 6 — leave reps in reserve",
        "Skip heavy compounds if anything feels off",
      ];
      recTone = "med";
    } else {
      recAction = "Rest or recovery day";
      recBullets = [
        "Recovery score is low — your body needs more rest",
        "Light cardio, stretching, or nothing today",
        "Check sleep, hydration, and food before next session",
      ];
      recTone = "high";
    }
  }

  return {
    readiness,
    recovery: Math.round(recovery),
    fatigue: Math.round(fatigueScore),
    title,
    recAction,
    recBullets,
    recTone,
    readinessCap,
    recoveryCap,
    fatigueCap,
  };
}

// ─── Muscle Stimulus ──────────────────────────────────────────────────────────

export type StimulusBar = {
  key: string;
  label: string;
  sets: number;
  pct: number;
};

/** Weekly working sets per body part (stimulus distribution). */
export function computeWeeklyStimulus(
  workouts: Workout[],
  movements: Movement[]
): { bars: StimulusBar[]; totalSets: number; tier: string; tierTone: string } {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const week = heroFinishedThisWeek(workouts);

  const setsByMuscle: Record<string, number> = {};
  for (const w of week) {
    for (const e of w.entries ?? []) {
      const mv = mvMap.get(e.movementId ?? "");
      if (!mv || isCardioMv(mv)) continue;
      const key = mvMuscleKey(mv);
      let cnt = 0;
      for (const s of e.sets ?? []) {
        if (s.done && !s.warmup) cnt++;
      }
      if (cnt > 0) setsByMuscle[key] = (setsByMuscle[key] ?? 0) + cnt;
    }
  }

  const total = Object.values(setsByMuscle).reduce((a, b) => a + b, 0);
  const bars: StimulusBar[] = Object.entries(setsByMuscle)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, sets]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      sets,
      pct: total > 0 ? Math.round((sets / total) * 100) : 0,
    }));

  // Tier is based on total weekly sets (80 = "high · driving growth" in HTML build)
  let tier = "—";
  let tierTone = "";
  if (total === 0) { tier = "No sets logged this week"; tierTone = ""; }
  else if (total < 20) { tier = "Light · building base"; tierTone = "pos"; }
  else if (total < 40) { tier = "Moderate · productive range"; tierTone = "pos"; }
  else if (total < 60) { tier = "High · driving growth"; tierTone = "med"; }
  else if (total < 80) { tier = "Very high · monitor recovery"; tierTone = "high"; }
  else { tier = "Extreme · consider deload"; tierTone = "high"; }

  return { bars, totalSets: total, tier, tierTone };
}

// ─── PRs ─────────────────────────────────────────────────────────────────────

export type PRBadge = {
  glyph: string;
  label: string;
  value: string;
  sub: string;
};

/**
 * Top 3 PR badges by heaviest working top set.
 * Ports renderPRCard() — HTML build line 21370.
 */
export function computePRs(
  workouts: Workout[],
  movements: Movement[]
): PRBadge[] {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const allFinished = workouts
    .filter((w) => w?.finished)
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

  type PRRecord = { weight: number; reps: number; date: string };
  const bestByMv = new Map<string, PRRecord>();

  for (const w of allFinished) {
    for (const e of w.entries ?? []) {
      if (!e.movementId) continue;
      for (const s of e.sets ?? []) {
        if (!s.done || s.warmup) continue;
        const wt = Number(s.weight) || 0;
        const rp = Number(s.reps) || 0;
        if (wt <= 0 || rp <= 0) continue;
        const cur = bestByMv.get(e.movementId);
        const wins =
          !cur ||
          wt > cur.weight ||
          (wt === cur.weight && rp > cur.reps) ||
          (wt === cur.weight && rp === cur.reps && new Date(w.date ?? 0) > new Date(cur.date));
        if (wins) {
          bestByMv.set(e.movementId, { weight: wt, reps: rp, date: w.date ?? "" });
        }
      }
    }
  }

  return [...bestByMv.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 3)
    .map(([mid, info]) => {
      const mv = mvMap.get(mid);
      const dateStr = info.date
        ? new Date(info.date).toLocaleDateString([], { month: "short", day: "numeric" })
        : "";
      return {
        glyph: "★",
        label: "Top set",
        value: `${Math.round(info.weight)} lb × ${info.reps}`,
        sub: (mv?.name ?? "Movement") + (dateStr ? " · " + dateStr : ""),
      };
    });
}

// ─── Muscle Readiness ─────────────────────────────────────────────────────────
//
// Per-muscle readiness gauge: how recovered is each muscle group and should the
// user train it today? Factors in:
//   - Working sets logged in the last 7 days (volume load)
//   - Days since the muscle was last trained (decay rate)
//   - Avg RPE from the most recent session for that muscle (intensity context)
//
// recovery % = 100 − fatigue %, using the same decay model as computeMuscleFatigue.
// Thresholds: ready ≥ 70 · caution 35–69 · hold < 35

export type MuscleReadinessRow = {
  key: string;
  label: string;
  sets: number;            // working sets in last 7 days
  recoveryPct: number;     // 0–100, higher = more recovered
  status: "ready" | "caution" | "hold";
  daysAgo: number | null;  // null = never trained
  avgRpe: number | null;   // avg RPE from last session this muscle was trained in
  statusLabel: string;     // e.g. "Ready" | "Go light · RPE 8" | "Rest · RPE 9"
  daysStat: string;        // compact display: "today" | "2d ago" | "—"
};

const ALL_MUSCLES_COMBINED = [...MUSCLE_UPPER, ...MUSCLE_LOWER];

export function computeMuscleReadiness(
  workouts: Workout[],
  movements: Movement[]
): { upper: MuscleReadinessRow[]; lower: MuscleReadinessRow[] } {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const weekAgo = Date.now() - 7 * 86400000;

  const setsByMuscle: Record<string, number> = {};
  const lastTsByMuscle: Record<string, number> = {};
  // RPE from the most recent session per muscle
  const lastRpeByMuscle: Record<string, { sum: number; n: number }> = {};

  ALL_MUSCLES_COMBINED.forEach(({ key }) => { setsByMuscle[key] = 0; });

  // Walk all finished workouts, newest-first so first hit per muscle = most recent session
  const sorted = [...workouts]
    .filter((w) => w?.finished)
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  for (const w of sorted) {
    const ts = new Date(w.date ?? w.savedAt ?? 0).getTime();
    if (!isFinite(ts)) continue;

    for (const e of w.entries ?? []) {
      const mv = mvMap.get(e.movementId ?? "");
      if (!mv || isCardioMv(mv)) continue;
      const key = mvMuscleKey(mv);
      if (!ALL_MUSCLES_COMBINED.find((b) => b.key === key)) continue;

      let setCount = 0;
      let rpeSum = 0;
      let rpeN = 0;
      for (const s of e.sets ?? []) {
        if (s.done && !s.warmup) {
          setCount++;
          const r = Number(s.rpe);
          if (r > 0) { rpeSum += r; rpeN++; }
        }
      }

      // Weekly set tally
      if (ts >= weekAgo && setCount > 0) {
        setsByMuscle[key] = (setsByMuscle[key] ?? 0) + setCount;
      }

      // Most-recent-session tracking (newest-first → first write wins per muscle)
      const hasDone = (e.sets ?? []).some((s) => s.done);
      if (hasDone && (!lastTsByMuscle[key] || ts > lastTsByMuscle[key])) {
        lastTsByMuscle[key] = ts;
        if (rpeN > 0) {
          lastRpeByMuscle[key] = { sum: rpeSum, n: rpeN };
        } else {
          delete lastRpeByMuscle[key];
        }
      }
    }
  }

  function buildRow(key: string, label: string): MuscleReadinessRow {
    const sets = setsByMuscle[key] ?? 0;
    const lastTs = lastTsByMuscle[key] ?? null;
    const days = calendarDays(lastTs);
    const isSmall = SMALL_MUSCLES.has(key);

    // Fatigue via same decay model
    let fatiguePct = 0;
    if (sets > 0 && lastTs != null && days != null) {
      const vol = Math.min(100, sets * 6.5);
      fatiguePct = Math.round(vol * decayFactor(days, isSmall));
    }
    const recoveryPct = Math.max(0, 100 - fatiguePct);

    const status: "ready" | "caution" | "hold" =
      recoveryPct >= 70 ? "ready" : recoveryPct >= 35 ? "caution" : "hold";

    // Avg RPE from last session
    const rpeData = lastRpeByMuscle[key];
    const avgRpe = rpeData && rpeData.n > 0
      ? Math.round((rpeData.sum / rpeData.n) * 10) / 10
      : null;

    // Status label with RPE context
    let statusLabel: string;
    if (status === "ready") {
      statusLabel = "Ready";
    } else if (status === "caution") {
      statusLabel = avgRpe != null && avgRpe >= 8
        ? `Go light · RPE ${Math.round(avgRpe)}`
        : "Go light";
    } else {
      statusLabel = avgRpe != null && avgRpe >= 7
        ? `Rest · RPE ${Math.round(avgRpe)}`
        : "Rest";
    }

    // Compact days-since string
    let daysStat: string;
    if (days == null) {
      daysStat = "—";
    } else if (days === 0) {
      daysStat = "today";
    } else if (days === 1) {
      daysStat = "1d ago";
    } else {
      daysStat = `${days}d ago`;
    }

    return { key, label, sets, recoveryPct, status, daysAgo: days, avgRpe, statusLabel, daysStat };
  }

  return {
    upper: MUSCLE_UPPER.map(({ key, label }) => buildRow(key, label)),
    lower: MUSCLE_LOWER.map(({ key, label }) => buildRow(key, label)),
  };
}
