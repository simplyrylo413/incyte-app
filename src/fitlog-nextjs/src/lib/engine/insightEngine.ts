// Timeline-Aware Insight Engine — rules-based, AI-enhanced (optional).
//
// Architecture principle: the rules engine is the source of truth.
// AI is a language enhancement layer only — it NEVER overrides timeline
// classification or produces structurally different output.
//
// Three insight modes (§13-Q AI-readiness):
//   CURRENT_ACTIVE_SESSION — user is actively logging sets right now
//   TODAY_COMPLETED        — user finished a session today
//   NO_TODAY_RECENT_HISTORY — no session today; analyze history + recovery
//
// Rules engine output is a fully-formed InsightResult. AI may rewrite
// the text of each InsightItem without changing the timeline classification,
// section assignments, or tone flags.

import type { Workout, WorkoutEntry, SetEntry, Movement } from "@/lib/types";
import {
  computeReadiness,
  mvMuscleKey,
  MUSCLE_UPPER,
  MUSCLE_LOWER,
} from "@/lib/engine/momentum";

// ─── Public types ─────────────────────────────────────────────────────────────

export type TimelineContext =
  | "CURRENT_ACTIVE_SESSION"
  | "TODAY_COMPLETED"
  | "NO_TODAY_RECENT_HISTORY";

export type InsightTone = "neutral" | "positive" | "caution" | "alert";

export type InsightItem = {
  text: string;
  tone: InsightTone;
};

export type InsightSection = {
  eyebrow: string;   // Mono-caps label (e.g. "Active Session")
  headline: string;  // Display title
  items: InsightItem[];
};

export type BodyPartLoad = {
  key: string;
  label: string;
  sets: number;       // total working sets
  hardSets: number;   // sets at RPE >= 7
  avgRpe: number | null;
};

export type InsightMetrics = {
  // Momentum-engine scores (proxies for quick access)
  readinessScore: number | null;
  recoveryScore: number;
  fatigueScore: number;

  // Current session (active workout or today's finished workout)
  currentSessionSets: number;
  currentSessionHardSets: number;
  currentSessionAvgRpe: number | null;
  currentSessionBodyParts: BodyPartLoad[];

  // 7-day rolling window
  bodyPartLoads7d: BodyPartLoad[];
  hardSets7d: number;
  avgRpe7d: number | null;

  // Trend signals
  rpeTrend: "rising" | "steady" | "falling" | null;
  volumeChangeVsBaseline: Record<string, number>; // bp key → % change this wk vs last wk
  repeatedExposure72h: Record<string, number>;    // bp key → # sessions in past 72h
  upperLowerRatio: { upper: number; lower: number } | null;
};

export type InsightResult = {
  timelineContext: TimelineContext;
  currentSessionInsights: InsightSection | null; // null when no session today/active
  trendInsights: InsightSection;
  recoveryOutlook: InsightSection;
  warnings: string[];
  metrics: InsightMetrics;
};

// ─── Internal utilities ───────────────────────────────────────────────────────

/**
 * Canonical timestamp for a workout row.
 * Prefers savedAt / completed_at over plain `date` string because
 * bare date strings like "2026-05-17" parse as UTC midnight and shift
 * in non-UTC timezones (mirrors listFinishedTodayWorkouts logic in db.ts).
 */
function workoutTs(w: Workout): number {
  const raw = w.savedAt || w.completed_at || w.date;
  return raw ? new Date(raw).getTime() : 0;
}

/**
 * Year-month-day string key in local time.
 * Mirrors the string-key comparison used by listFinishedTodayWorkouts in db.ts
 * to avoid UTC-midnight timezone shifts with bare date strings.
 */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** True if the given timestamp falls on today in local time. */
function isToday(ts: number): boolean {
  return dateKey(new Date(ts)) === dateKey(new Date());
}

/**
 * Maps a muscle key to a display label.
 * Falls back to capitalising the key if not in the known muscle lists.
 */
function muscleLabel(key: string): string {
  const all = [...MUSCLE_UPPER, ...MUSCLE_LOWER];
  return (
    all.find((m) => m.key === key)?.label ??
    key.charAt(0).toUpperCase() + key.slice(1)
  );
}

/**
 * All completed sets — includes warmup (WU) and working (WS).
 * Use for session set counts and presence detection.
 */
function loggedSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.done);
}

/**
 * Strict working sets: done and NOT warmup.
 * Use for volume analysis, hard-set counts, and RPE quality metrics only.
 */
function workingSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.done && !s.warmup);
}

/** Average RPE across an array of sets. Returns null if no RPE data. */
function avgRpeOf(sets: SetEntry[]): number | null {
  const withRpe = sets.filter((s) => Number(s.rpe) > 0);
  if (!withRpe.length) return null;
  const sum = withRpe.reduce((acc, s) => acc + Number(s.rpe), 0);
  return Math.round((sum / withRpe.length) * 10) / 10;
}

/**
 * Aggregate working sets per body part across an array of workouts.
 * Returns a Record<muscleKey, setCount>.
 */
function aggregateSetsByBP(
  workouts: Workout[],
  mvMap: Map<string, Movement>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.skipped) continue;
      const mv = mvMap.get(e.movementId);
      const key = mv ? mvMuscleKey(mv) : "other";
      const n = workingSets(e.sets).length;
      if (n > 0) totals[key] = (totals[key] ?? 0) + n;
    }
  }
  return totals;
}

/**
 * Build BodyPartLoad[] from an array of workouts.
 *
 * `sets` counts ALL completed sets (warmup + working) so entries where the
 * user logged only warmup sets are not silently dropped.
 * `hardSets` and `avgRpe` use working sets only (warmup effort ≠ hypertrophic load).
 */
function bodyPartLoadsFrom(
  workouts: Workout[],
  mvMap: Map<string, Movement>
): BodyPartLoad[] {
  const byKey: Map<
    string,
    { ls: SetEntry[]; ws: SetEntry[]; label: string }
  > = new Map();

  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.skipped) continue;
      const mv = mvMap.get(e.movementId);
      const key = mv ? mvMuscleKey(mv) : "other";
      const label = muscleLabel(key);
      const ls = loggedSets(e.sets);
      if (!ls.length) continue; // nothing completed in this entry
      const ws = workingSets(e.sets);
      if (!byKey.has(key)) byKey.set(key, { ls: [], ws: [], label });
      byKey.get(key)!.ls.push(...ls);
      byKey.get(key)!.ws.push(...ws);
    }
  }

  return [...byKey.entries()].map(([key, { ls, ws, label }]) => ({
    key,
    label,
    sets: ls.length,
    hardSets: ws.filter((s) => Number(s.rpe) >= 7).length,
    avgRpe: avgRpeOf(ws),
  }));
}

// ─── Timeline classification ──────────────────────────────────────────────────

/**
 * Classify what is happening in time so insight language is accurate.
 *
 * Priority:
 *   1. activeWorkout exists (unfinished) → CURRENT_ACTIVE_SESSION
 *      Uses loggedSets (any done set) — does not require working sets,
 *      so warmup-only sets still count as an active session.
 *      A bare active workout with zero sets logs as "session started."
 *   2. A finished workout exists dated today → TODAY_COMPLETED
 *   3. Everything else → NO_TODAY_RECENT_HISTORY
 */
export function classifyTimeline(
  finishedWorkouts: Workout[],
  activeWorkout: Workout | null
): TimelineContext {
  if (activeWorkout) {
    return "CURRENT_ACTIVE_SESSION";
  }

  const hasCompletedToday = finishedWorkouts.some((w) =>
    isToday(workoutTs(w))
  );
  if (hasCompletedToday) return "TODAY_COMPLETED";

  return "NO_TODAY_RECENT_HISTORY";
}

// ─── Trend helpers ────────────────────────────────────────────────────────────

/**
 * Compare avg RPE from the most recent session vs the 4 prior sessions.
 * Returns null when there is insufficient data (< 2 sessions with RPE data).
 */
function computeRpeTrend(
  finishedWorkouts: Workout[]
): "rising" | "steady" | "falling" | null {
  const sorted = [...finishedWorkouts]
    .filter((w) => w.finished)
    .sort((a, b) => workoutTs(b) - workoutTs(a))
    .slice(0, 5);

  const sessionRpes = sorted
    .map((w) => {
      const ws = w.entries.flatMap((e) =>
        e.sets.filter((s) => s.done && !s.warmup && Number(s.rpe) > 0)
      );
      if (!ws.length) return null;
      return ws.reduce((sum, s) => sum + Number(s.rpe), 0) / ws.length;
    })
    .filter((r): r is number => r !== null);

  if (sessionRpes.length < 2) return null;

  const latest = sessionRpes[0];
  const priorAvg =
    sessionRpes.slice(1).reduce((a, b) => a + b, 0) /
    (sessionRpes.length - 1);
  const diff = latest - priorAvg;

  if (diff > 0.5) return "rising";
  if (diff < -0.5) return "falling";
  return "steady";
}

/**
 * Volume change: compare working sets per body part this week vs last week.
 * Returns { muscleKey: percentChange } — only includes muscle groups with
 * meaningful data in at least one of the two windows.
 */
function computeVolumeChangeVsBaseline(
  finishedWorkouts: Workout[],
  mvMap: Map<string, Movement>
): Record<string, number> {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  const thisWeekWorkouts = finishedWorkouts.filter(
    (w) => workoutTs(w) >= now - WEEK
  );
  const prevWeekWorkouts = finishedWorkouts.filter((w) => {
    const ts = workoutTs(w);
    return ts >= now - 2 * WEEK && ts < now - WEEK;
  });

  const thisWeek = aggregateSetsByBP(thisWeekWorkouts, mvMap);
  const prevWeek = aggregateSetsByBP(prevWeekWorkouts, mvMap);

  const allKeys = new Set([...Object.keys(thisWeek), ...Object.keys(prevWeek)]);
  const result: Record<string, number> = {};

  for (const key of allKeys) {
    const tw = thisWeek[key] ?? 0;
    const pw = prevWeek[key] ?? 0;
    if (pw === 0 && tw === 0) continue;
    if (pw === 0) {
      result[key] = 100; // body part appeared this week for the first time
    } else {
      result[key] = Math.round(((tw - pw) / pw) * 100);
    }
  }

  return result;
}

/**
 * Count how many distinct sessions each body part appeared in across the last 72 hours.
 * Includes both finishedWorkouts and the activeWorkout (if any).
 */
function computeRepeatedExposure72h(
  finishedWorkouts: Workout[],
  activeWorkout: Workout | null,
  mvMap: Map<string, Movement>
): Record<string, number> {
  const since72h = Date.now() - 72 * 60 * 60 * 1000;
  const sessions: Workout[] = [
    ...finishedWorkouts.filter((w) => workoutTs(w) >= since72h),
    ...(activeWorkout ? [activeWorkout] : []),
  ];

  const exposure: Record<string, number> = {};
  for (const w of sessions) {
    const bpsInSession = new Set<string>();
    for (const e of w.entries) {
      if (e.skipped) continue;
      const mv = mvMap.get(e.movementId);
      if (!mv) continue;
      const key = mvMuscleKey(mv);
      // Use loggedSets — warmup sets still represent real tissue stress
      const hasDone = e.sets.some((s) => s.done);
      if (hasDone) bpsInSession.add(key);
    }
    for (const key of bpsInSession) {
      exposure[key] = (exposure[key] ?? 0) + 1;
    }
  }

  return exposure;
}

// ─── Insight generators ───────────────────────────────────────────────────────

function generateCurrentSessionInsights(
  ctx: TimelineContext,
  bpLoads: BodyPartLoad[],
  metrics: InsightMetrics
): InsightSection {
  const isActive = ctx === "CURRENT_ACTIVE_SESSION";
  const prefix = isActive ? "Current session" : "Today's session";
  const items: InsightItem[] = [];
  const totalSets = metrics.currentSessionSets;
  const hardSets = metrics.currentSessionHardSets;
  const avgRpe = metrics.currentSessionAvgRpe;

  // Empty session
  if (totalSets === 0) {
    items.push({
      text: isActive
        ? "Session started — no sets logged yet."
        : "Session recorded with no completed sets.",
      tone: "neutral",
    });
    return {
      eyebrow: isActive ? "Active Session" : "Completed Today",
      headline: isActive ? "Session in progress" : "Session complete",
      items,
    };
  }

  // Total logged sets (warmup + working)
  items.push({
    text: `${prefix}: ${totalSets} set${totalSets !== 1 ? "s" : ""} logged.`,
    tone: "neutral",
  });

  // Hard set proportion
  if (hardSets > 0 && totalSets > 0) {
    const hardPct = Math.round((hardSets / totalSets) * 100);
    if (hardPct >= 70) {
      items.push({
        text: `${hardSets} of ${totalSets} sets at RPE 7+ — ${isActive ? "intensity is elevated" : "high-intensity session"}.`,
        tone: "caution",
      });
    } else if (hardSets >= 2) {
      items.push({
        text: `${hardSets} hard set${hardSets !== 1 ? "s" : ""} at RPE 7+ across ${prefix.toLowerCase()}.`,
        tone: "neutral",
      });
    }
  }

  // Dominant body parts (top 2)
  const topBPs = [...bpLoads]
    .filter((bp) => bp.key !== "cardio")
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 2);
  if (topBPs.length > 0) {
    const names = topBPs.map((bp) => bp.label).join(" and ");
    items.push({
      text: `${names} ${topBPs.length > 1 ? "carry" : "carries"} most of ${isActive ? "today's" : "today's completed"} workload.`,
      tone: "neutral",
    });
  }

  // Posterior chain accumulation
  const posteriorKeys = new Set(["hamstrings", "glutes", "back"]);
  const posteriorSets = bpLoads
    .filter((bp) => posteriorKeys.has(bp.key))
    .reduce((sum, bp) => sum + bp.sets, 0);
  if (posteriorSets >= 5) {
    items.push({
      text: `Posterior-chain stimulus is ${isActive ? "accumulating" : "high — hamstrings, glutes, and back contributed"}.`,
      tone: posteriorSets >= 10 ? "caution" : "neutral",
    });
  }

  // RPE context
  if (avgRpe !== null) {
    const rpeStr = avgRpe.toFixed(1);
    if (avgRpe >= 9) {
      items.push({
        text: `Avg RPE ${rpeStr} — very high intensity ${isActive ? "for this session" : "in today's session"}.`,
        tone: "alert",
      });
    } else if (avgRpe >= 8) {
      items.push({
        text: `Avg RPE ${rpeStr} — ${isActive ? "session fatigue is elevated" : "today's session fatigue is elevated"}.`,
        tone: "caution",
      });
    } else if (avgRpe >= 7) {
      items.push({
        text: `Avg RPE ${rpeStr} — solid working intensity ${isActive ? "so far" : "across today's session"}.`,
        tone: "neutral",
      });
    } else {
      items.push({
        text: `Avg RPE ${rpeStr} — controlled stimulus, effort is moderate.`,
        tone: "positive",
      });
    }
  }

  // Compare this session's body-part volume vs 7d baseline per session
  // Rough baseline: 7d sets / 3 sessions ≈ typical single-session load
  const baseline7d = metrics.bodyPartLoads7d;
  for (const bp of bpLoads.slice(0, 2)) {
    const base = baseline7d.find((b) => b.key === bp.key);
    if (base && base.sets >= 3) {
      const avgPerSession = base.sets / 3;
      if (bp.sets > avgPerSession * 1.4) {
        items.push({
          text: `${bp.label} volume today is above your recent session average.`,
          tone: "caution",
        });
        break; // one comparison note is enough
      }
    }
  }

  const headline = isActive
    ? `${totalSets} set${totalSets !== 1 ? "s" : ""} in progress`
    : `${totalSets} set${totalSets !== 1 ? "s" : ""} · session complete`;

  return {
    eyebrow: isActive ? "Active Session" : "Completed Today",
    headline,
    items,
  };
}

function generateTrendInsights(
  finishedWorkouts: Workout[],
  metrics: InsightMetrics
): InsightSection {
  const items: InsightItem[] = [];
  const totalSets7d = metrics.bodyPartLoads7d.reduce(
    (sum, bp) => sum + bp.sets,
    0
  );

  if (totalSets7d === 0) {
    items.push({
      text: "No working sets logged in the last 7 days.",
      tone: "neutral",
    });
    return {
      eyebrow: "Trend Analysis",
      headline: "Last 7 days",
      items,
    };
  }

  // Overall weekly volume
  items.push({
    text: `${totalSets7d} working set${totalSets7d !== 1 ? "s" : ""} across the last 7 days.`,
    tone: "neutral",
  });

  // Volume changes vs prior week — only show significant changes
  const changes = Object.entries(metrics.volumeChangeVsBaseline)
    .filter(([, pct]) => Math.abs(pct) >= 20)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);

  for (const [key, pct] of changes) {
    const label = muscleLabel(key);
    const dir = pct > 0 ? "increased" : "decreased";
    const absPct = Math.abs(Math.round(pct));
    items.push({
      text: `${label} volume ${dir} ${absPct}% compared to last week.`,
      tone: pct > 40 ? "caution" : "neutral",
    });
  }

  // RPE trend
  if (metrics.rpeTrend === "rising") {
    items.push({
      text: "Avg RPE is trending upward across recent sessions — intensity is accumulating.",
      tone: "caution",
    });
  } else if (metrics.rpeTrend === "falling") {
    items.push({
      text: "Avg RPE is trending lower — session intensity is easing.",
      tone: "positive",
    });
  }

  // Repeated exposure within 72h
  const repeated = Object.entries(metrics.repeatedExposure72h)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);
  for (const [key, count] of repeated.slice(0, 2)) {
    items.push({
      text: `${muscleLabel(key)} trained ${count}× in the last 72 hours.`,
      tone: count >= 3 ? "caution" : "neutral",
    });
  }

  // Upper/lower split
  const ul = metrics.upperLowerRatio;
  if (ul && ul.upper + ul.lower > 0) {
    const total = ul.upper + ul.lower;
    const upperPct = Math.round((ul.upper / total) * 100);
    const lowerPct = 100 - upperPct;
    if (upperPct >= 70) {
      items.push({
        text: `Upper body dominates this week — ${upperPct}% upper / ${lowerPct}% lower.`,
        tone: "neutral",
      });
    } else if (lowerPct >= 70) {
      items.push({
        text: `Lower body dominates this week — ${lowerPct}% lower / ${upperPct}% upper.`,
        tone: "neutral",
      });
    }
  }

  // Hard set proportion over 7 days
  const totalHard = metrics.hardSets7d;
  if (totalHard > 0 && totalSets7d > 0) {
    const hardPct = Math.round((totalHard / totalSets7d) * 100);
    if (hardPct >= 65) {
      items.push({
        text: `${hardPct}% of this week's sets were at RPE 7+ — high-intensity training block.`,
        tone: "caution",
      });
    }
  }

  // Ensure there's always at least something analytical even with sparse data
  if (items.length === 1) {
    const topBP = [...metrics.bodyPartLoads7d].sort((a, b) => b.sets - a.sets)[0];
    if (topBP) {
      items.push({
        text: `${topBP.label} leads this week with ${topBP.sets} working set${topBP.sets !== 1 ? "s" : ""}.`,
        tone: "neutral",
      });
    }
  }

  return {
    eyebrow: "Trend Analysis",
    headline: "Last 7 days",
    items,
  };
}

function generateRecoveryOutlook(
  ctx: TimelineContext,
  metrics: InsightMetrics
): InsightSection {
  const items: InsightItem[] = [];
  const hasHistory =
    metrics.fatigueScore > 0 ||
    metrics.currentSessionSets > 0 ||
    metrics.bodyPartLoads7d.length > 0;

  if (!hasHistory) {
    items.push({
      text: "Log sessions to generate a recovery outlook.",
      tone: "neutral",
    });
    return {
      eyebrow: "Recovery Outlook",
      headline: "Next session",
      items,
    };
  }

  // Overall fatigue prognosis
  if (metrics.fatigueScore >= 75) {
    items.push({
      text: "Accumulated fatigue is high — next session performance may be reduced.",
      tone: "alert",
    });
    items.push({
      text: "Consider a lower-volume or deload session next.",
      tone: "caution",
    });
  } else if (metrics.fatigueScore >= 50) {
    items.push({
      text: "Moderate fatigue accumulated — full intensity may not be available next session.",
      tone: "caution",
    });
  } else if (metrics.fatigueScore > 0 && metrics.fatigueScore < 25) {
    items.push({
      text: "Fatigue levels are low — next session readiness is expected to be high.",
      tone: "positive",
    });
  }

  // Today's load → tomorrow prediction (only if trained today)
  if (
    ctx === "CURRENT_ACTIVE_SESSION" ||
    ctx === "TODAY_COMPLETED"
  ) {
    const heavyBPs = metrics.currentSessionBodyParts
      .filter((bp) => bp.sets >= 4)
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 2);

    if (heavyBPs.length > 0) {
      const names = heavyBPs.map((bp) => bp.label).join(" and ");
      items.push({
        text: `${names} recovery may be reduced tomorrow based on today's load.`,
        tone: "caution",
      });
    }

    if (
      metrics.currentSessionAvgRpe !== null &&
      metrics.currentSessionAvgRpe >= 8.5
    ) {
      items.push({
        text: "High RPE today — allow adequate recovery before the next session.",
        tone: "caution",
      });
    }
  }

  // Repeated-exposure recovery note
  const highExposure = Object.entries(metrics.repeatedExposure72h)
    .filter(([, count]) => count >= 2)
    .map(([key]) => muscleLabel(key))
    .slice(0, 2);
  if (highExposure.length > 0) {
    const names = highExposure.join(" and ");
    items.push({
      text: `Consider reducing ${names} volume next session — trained multiple times in 72 hours.`,
      tone: "caution",
    });
  }

  // Recovery score context (days-since proxy)
  if (metrics.recoveryScore >= 80 && ctx === "NO_TODAY_RECENT_HISTORY") {
    items.push({
      text: "Rest time since last session is adequate — estimated next-session readiness is solid.",
      tone: "positive",
    });
  } else if (
    metrics.recoveryScore < 50 &&
    ctx === "NO_TODAY_RECENT_HISTORY"
  ) {
    items.push({
      text: "Limited rest since last session — next session readiness may be reduced.",
      tone: "caution",
    });
  }

  // RPE trend forecast
  if (metrics.rpeTrend === "rising") {
    items.push({
      text: "RPE is trending upward — if performance drops next session, consider reducing load.",
      tone: "caution",
    });
  }

  // Ensure at least one item
  if (items.length === 0) {
    items.push({
      text: "Recovery looks manageable — monitor how you feel going into the next session.",
      tone: "neutral",
    });
  }

  return {
    eyebrow: "Recovery Outlook",
    headline: "Next session",
    items,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute the full timeline-aware InsightResult.
 *
 * @param finishedWorkouts  All finished (historical) workouts.
 * @param movements         Full movement library for muscle-key resolution.
 * @param activeWorkout     The in-progress (unfinished) workout, or null.
 */
export function computeInsightResult(
  finishedWorkouts: Workout[],
  movements: Movement[],
  activeWorkout: Workout | null
): InsightResult {
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));

  // ── 1. Timeline classification ──────────────────────────────────────────────
  const timelineContext = classifyTimeline(finishedWorkouts, activeWorkout);

  // ── 2. Current workout reference ────────────────────────────────────────────
  // The "current" workout is the active one, or the most-recent finished today.
  const currentWorkout: Workout | null =
    activeWorkout ??
    finishedWorkouts
      .filter((w) => isToday(workoutTs(w)))
      .sort((a, b) => workoutTs(b) - workoutTs(a))[0] ??
    null;

  // ── 3. Readiness/recovery/fatigue (reuse momentum engine) ──────────────────
  const readinessData = computeReadiness(finishedWorkouts, movements);

  // ── 4. Current session body-part loads ──────────────────────────────────────
  const currentBPLoads: BodyPartLoad[] = currentWorkout
    ? bodyPartLoadsFrom([currentWorkout], mvMap)
    : [];

  // All completed sets (warmup + working) → session display count
  const currentLS: SetEntry[] = currentWorkout
    ? currentWorkout.entries.flatMap((e) => loggedSets(e.sets))
    : [];
  // Working sets only → quality metrics (hard sets, RPE)
  const currentWS: SetEntry[] = currentWorkout
    ? currentWorkout.entries.flatMap((e) => workingSets(e.sets))
    : [];

  const currentSessionSets = currentLS.length;          // all done sets shown to user
  const currentSessionHardSets = currentWS.filter(      // working-set RPE ≥ 7 only
    (s) => Number(s.rpe) >= 7
  ).length;
  const currentSessionAvgRpe = avgRpeOf(currentWS);     // working-set quality signal

  // ── 5. 7-day rolling window ──────────────────────────────────────────────────
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const since7d = Date.now() - WEEK_MS;
  const workouts7d = finishedWorkouts.filter((w) => workoutTs(w) >= since7d);
  const bpLoads7d = bodyPartLoadsFrom(workouts7d, mvMap);

  const allWS7d = workouts7d.flatMap((w) =>
    w.entries.flatMap((e) => workingSets(e.sets))
  );
  const hardSets7d = allWS7d.filter((s) => Number(s.rpe) >= 7).length;
  const avgRpe7d = avgRpeOf(allWS7d);

  // ── 6. Trend signals ────────────────────────────────────────────────────────
  const rpeTrend = computeRpeTrend(finishedWorkouts);
  const volumeChangeVsBaseline = computeVolumeChangeVsBaseline(
    finishedWorkouts,
    mvMap
  );
  const repeatedExposure72h = computeRepeatedExposure72h(
    finishedWorkouts,
    activeWorkout,
    mvMap
  );

  // ── 7. Upper/lower ratio ────────────────────────────────────────────────────
  const upperKeys = new Set(MUSCLE_UPPER.map((m) => m.key));
  const lowerKeys = new Set(MUSCLE_LOWER.map((m) => m.key));
  const upperSets = bpLoads7d
    .filter((bp) => upperKeys.has(bp.key))
    .reduce((s, bp) => s + bp.sets, 0);
  const lowerSets = bpLoads7d
    .filter((bp) => lowerKeys.has(bp.key))
    .reduce((s, bp) => s + bp.sets, 0);
  const upperLowerRatio =
    upperSets > 0 || lowerSets > 0
      ? { upper: upperSets, lower: lowerSets }
      : null;

  // ── 8. Assemble metrics ─────────────────────────────────────────────────────
  const metrics: InsightMetrics = {
    readinessScore: readinessData.readiness,
    recoveryScore: readinessData.recovery,
    fatigueScore: readinessData.fatigue,
    currentSessionSets,
    currentSessionHardSets,
    currentSessionAvgRpe,
    currentSessionBodyParts: currentBPLoads,
    bodyPartLoads7d: bpLoads7d,
    hardSets7d,
    avgRpe7d,
    rpeTrend,
    volumeChangeVsBaseline,
    repeatedExposure72h,
    upperLowerRatio,
  };

  // ── 9. Generate sections ────────────────────────────────────────────────────
  const currentSessionInsights =
    timelineContext !== "NO_TODAY_RECENT_HISTORY" && currentWorkout
      ? generateCurrentSessionInsights(
          timelineContext,
          currentBPLoads,
          metrics
        )
      : null;

  const trendInsights = generateTrendInsights(finishedWorkouts, metrics);
  const recoveryOutlook = generateRecoveryOutlook(timelineContext, metrics);

  // ── 10. Warnings (surface critical flags separately) ────────────────────────
  const warnings: string[] = [];
  if (metrics.fatigueScore >= 75) {
    warnings.push(
      "Weekly fatigue is very high — monitor for performance decline."
    );
  }
  for (const [key, count] of Object.entries(repeatedExposure72h)) {
    if (count >= 3) {
      warnings.push(
        `${muscleLabel(key)} has been trained ${count}× in 72 hours — consider additional recovery.`
      );
    }
  }

  return {
    timelineContext,
    currentSessionInsights,
    trendInsights,
    recoveryOutlook,
    warnings,
    metrics,
  };
}
