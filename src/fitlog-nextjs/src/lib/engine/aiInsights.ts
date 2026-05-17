// INCYTE AI Insights — client-side engine.
// Calls the Supabase Edge Function `ai-insights` which proxies OpenAI.
// API key never touches the client (§13-P security rule).
//
// Cache strategy: localStorage, 30-minute TTL.
// Each call costs ~$0.001–0.003 on gpt-4o-mini; cache keeps it negligible.

import { createClient } from "@/lib/supabase/client";
import type { Workout, Movement } from "@/lib/types";
import {
  computeReadiness,
  computeMuscleFatigue,
  computeWeeklyStimulus,
  computePRs,
  type ReadinessScores,
  type MuscleFatigueRow,
  type StimulusBar,
  type PRBadge,
} from "@/lib/engine/momentum";

// ─── Public types ─────────────────────────────────────────────────────────────

export type AiReadiness = {
  summary: string;
  recommendation: string;
  bullets: string[];
  readinessCap: string; // ≤8 words, replaces rule-based caption under Readiness bar
  recoveryCap: string;  // ≤8 words, replaces rule-based caption under Recovery bar
  fatigueCap: string;   // ≤8 words, replaces rule-based caption under Fatigue bar
};

export type AiRecoveryEntry = {
  advice: string;
  tone: "low" | "med" | "high";
};

export type AiRecovery = Record<string, AiRecoveryEntry>;

export type AiStimulus = {
  summary: string;
  adjustments: string[];
};

export type AiPR = {
  movement: string;
  nextTarget: string;
  context: string;
};

export type AiWeightRec = {
  movement: string;
  current: number;
  suggested: number;
  unit: string;
  rationale: string;
};

export type AiInsights = {
  readiness: AiReadiness;
  recovery: AiRecovery;
  stimulus: AiStimulus;
  prs: AiPR[];
  weight_recommendations: AiWeightRec[];
  generatedAt: number; // unix ms — used for TTL + display
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = "incyte_ai_insights_v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function getCached(): AiInsights | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiInsights;
    if (Date.now() - parsed.generatedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCache(insights: AiInsights) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(insights));
  } catch {
    /* storage full — no-op */
  }
}

/** Force-expire the cache so next load re-fetches. Call after finishing a workout. */
export function invalidateAiCache() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch { /* no-op */ }
}

// ─── Payload builder ──────────────────────────────────────────────────────────
// Trims data to fit the model's context budget: last 3 weeks, working sets only.

function buildPayload(
  workouts: Workout[],
  readiness: ReadinessScores,
  upper: MuscleFatigueRow[],
  lower: MuscleFatigueRow[],
  stimulus: { bars: StimulusBar[]; totalSets: number; tier: string },
  prs: PRBadge[]
) {
  const threeWeeksAgo = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const recentWorkouts = workouts
    .filter((w) => w.finished && new Date(w.date).getTime() >= threeWeeksAgo)
    .slice(0, 20)
    .map((w) => ({
      date: w.date.slice(0, 10),
      entries: w.entries
        .filter((e) => !e.skipped)
        .map((e) => ({
          name: e.name ?? "",
          muscle: e.muscle ?? "",
          sets: e.sets
            .filter((s) => s.done && !s.warmup)
            .map((s) => ({
              ...(s.weight != null && s.weight !== "" ? { weight: s.weight } : {}),
              ...(s.reps != null && s.reps !== "" ? { reps: s.reps } : {}),
              ...(s.rpe != null && s.rpe !== "" ? { rpe: s.rpe } : {}),
            })),
        }))
        .filter((e) => e.sets.length > 0),
    }))
    .filter((w) => w.entries.length > 0);

  return {
    readiness: {
      score: readiness.readiness,
      recovery: readiness.recovery,
      fatigue: readiness.fatigue,
      recAction: readiness.recAction,
    },
    muscle_fatigue: {
      upper: upper.map((r) => ({
        key: r.key,
        label: r.label,
        pct: r.pct,
        daysAgo: r.daysAgo,
        tier: r.tier,
      })),
      lower: lower.map((r) => ({
        key: r.key,
        label: r.label,
        pct: r.pct,
        daysAgo: r.daysAgo,
        tier: r.tier,
      })),
    },
    stimulus: {
      totalSets: stimulus.totalSets,
      bars: stimulus.bars.map((b) => ({ label: b.label, sets: b.sets, pct: b.pct })),
    },
    prs: prs.map((p) => ({ label: p.label, value: p.value, sub: p.sub })),
    recent_workouts: recentWorkouts,
  };
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchAiInsights(
  workouts: Workout[],
  movements: Movement[],
  opts: { forceRefresh?: boolean } = {}
): Promise<AiInsights> {
  if (!opts.forceRefresh) {
    const cached = getCached();
    if (cached) return cached;
  }

  // Compute all engine outputs (same calls as the page, kept in sync)
  const readiness = computeReadiness(workouts, movements);
  const upper = computeMuscleFatigue(workouts, movements, "upper");
  const lower = computeMuscleFatigue(workouts, movements, "lower");
  const stimulus = computeWeeklyStimulus(workouts, movements);
  const prs = computePRs(workouts, movements);

  const payload = buildPayload(workouts, readiness, upper, lower, stimulus, prs);

  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<AiInsights>("ai-insights", {
    body: payload,
  });

  if (error) throw new Error(`AI insights: ${error.message}`);
  if (!data) throw new Error("AI insights: empty response");

  const insights: AiInsights = { ...data, generatedAt: Date.now() };
  setCache(insights);
  return insights;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** How long ago the cached insights were generated, formatted as a string. */
export function ageLabel(generatedAt: number): string {
  const mins = Math.floor((Date.now() - generatedAt) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
