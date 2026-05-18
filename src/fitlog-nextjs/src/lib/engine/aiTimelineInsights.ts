// AI enhancement layer for timeline-aware Insight Engine.
//
// Takes the deterministic InsightResult from insightEngine.ts and asks the
// Supabase Edge Function (ai-insights) to improve the language quality.
//
// Hard contract: AI CANNOT change:
//   - timelineContext classification
//   - which section an insight appears in
//   - tone flags assigned by the rules engine
//   - any numeric fact (sets, RPE values, percentages)
//
// On ANY failure (network, timeout, invalid JSON, edge function error):
//   → return the original rules-based InsightResult unchanged.
//
// Cache: localStorage key `incyte_ai_timeline_v1`, 20-minute TTL.
// The cache key encodes the timelineContext so stale cached output from
// a prior context never bleeds into a different context.

import { createClient } from "@/lib/supabase/client";
import type { InsightResult, InsightSection, InsightItem } from "./insightEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

type AiSectionEnhancement = {
  headline: string;
  items: string[];
};

type AiTimelineCache = {
  timelineContext: string; // context at generation time — used for cache validity
  currentSession: AiSectionEnhancement | null;
  trends: AiSectionEnhancement;
  recovery: AiSectionEnhancement;
  generatedAt: number;
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = "incyte_ai_timeline_v1";
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 min

function getCached(expectedCtx: string): AiTimelineCache | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiTimelineCache;
    // Invalidate if context changed (e.g., user finished their workout)
    if (parsed.timelineContext !== expectedCtx) return null;
    if (Date.now() - parsed.generatedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCache(data: AiTimelineCache): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full — silently skip
  }
}

/** Force-expire the AI timeline cache. Call after finishing a workout. */
export function invalidateAiTimelineCache(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // no-op
  }
}

/** Human-readable age of cached timeline insights. */
export function aiTimelineAgeLabel(generatedAt: number): string {
  const mins = Math.floor((Date.now() - generatedAt) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the request body sent to the ai-insights Edge Function.
 * The payload includes the rules output plus strict natural-language
 * constraints that prevent the AI from violating the timeline contract.
 */
function buildPayload(result: InsightResult): Record<string, unknown> {
  const { timelineContext, currentSessionInsights, trendInsights, recoveryOutlook, metrics } = result;

  return {
    action: "timeline_insights",
    timelineContext,
    rulesOutput: {
      currentSession: currentSessionInsights
        ? {
            headline: currentSessionInsights.headline,
            items: currentSessionInsights.items.map((i) => i.text),
          }
        : null,
      trends: {
        headline: trendInsights.headline,
        items: trendInsights.items.map((i) => i.text),
      },
      recovery: {
        headline: recoveryOutlook.headline,
        items: recoveryOutlook.items.map((i) => i.text),
      },
    },
    metrics: {
      fatigueScore: metrics.fatigueScore,
      recoveryScore: metrics.recoveryScore,
      readinessScore: metrics.readinessScore,
      currentSessionSets: metrics.currentSessionSets,
      currentSessionHardSets: metrics.currentSessionHardSets,
      currentSessionAvgRpe: metrics.currentSessionAvgRpe,
      avgRpe7d: metrics.avgRpe7d,
      rpeTrend: metrics.rpeTrend,
    },
    // Hard constraints passed inline so the edge function can include them
    // in the system prompt without modification.
    constraints: [
      "You are a clinical, direct training coach. Avoid motivational filler, emoji, or generic fitness language.",
      "The timelineContext field tells you WHEN the work happened. Respect it absolutely.",
      "CURRENT_ACTIVE_SESSION: The user is actively logging sets RIGHT NOW. Use present-tense observational language ONLY. NEVER say 'train light today', 'rest today', 'avoid this today', or any future-training advice inside the currentSession section.",
      "TODAY_COMPLETED: The session is done. Phrase as 'Today's session created...' or 'Today's work resulted in...' NOT as future advice.",
      "NO_TODAY_RECENT_HISTORY: No session today. You may use forward-looking language in the recovery section only.",
      "currentSession items = observational facts about what happened. trendInsights items = historical analysis. recoveryOutlook items = forward-looking estimate only.",
      "Never mix future advice into currentSession. Never mix current-session observations into recoveryOutlook.",
      "Enhance language quality but preserve every numeric fact from rulesOutput exactly.",
      "Keep each item to 1-2 sentences. Return only valid JSON.",
      "Return JSON exactly: { currentSession: { headline: string, items: string[] } | null, trends: { headline: string, items: string[] }, recovery: { headline: string, items: string[] } }",
    ],
  };
}

// ─── Apply enhancement ────────────────────────────────────────────────────────

/**
 * Merge AI-rewritten strings back into the InsightResult, preserving all
 * structural properties (tone, eyebrow, etc.) from the rules output.
 */
function applyEnhancement(
  original: InsightResult,
  cache: AiTimelineCache
): InsightResult {
  function mergeItems(
    aiItems: string[],
    originalItems: InsightItem[]
  ): InsightItem[] {
    // Align by index; use original tone for items that exist in both.
    return aiItems.map((text, i) => ({
      text,
      tone: originalItems[i]?.tone ?? "neutral",
    }));
  }

  function mergeSection(
    original: InsightSection,
    ai: AiSectionEnhancement
  ): InsightSection {
    return {
      ...original,
      headline: ai.headline,
      items: mergeItems(ai.items, original.items),
    };
  }

  return {
    ...original,
    currentSessionInsights:
      original.currentSessionInsights && cache.currentSession
        ? mergeSection(original.currentSessionInsights, cache.currentSession)
        : original.currentSessionInsights,
    trendInsights: mergeSection(original.trendInsights, cache.trends),
    recoveryOutlook: mergeSection(original.recoveryOutlook, cache.recovery),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Optionally enhance an InsightResult with AI-improved language.
 *
 * Always returns an InsightResult. Falls back to the rules-based result on
 * any error — callers should never need to handle rejection.
 *
 * @param result        The rules-based InsightResult to enhance.
 * @param opts.forceRefresh  Skip cache and re-fetch from the edge function.
 * @returns             Enhanced InsightResult (or original on failure).
 */
export async function enhanceInsightsWithAi(
  result: InsightResult,
  opts: { forceRefresh?: boolean } = {}
): Promise<InsightResult> {
  const ctx = result.timelineContext;

  // Check cache first (unless force-refreshing)
  if (!opts.forceRefresh) {
    const cached = getCached(ctx);
    if (cached) return applyEnhancement(result, cached);
  }

  try {
    const supabase = createClient();
    const payload = buildPayload(result);

    const { data, error } = await supabase.functions.invoke("ai-insights", {
      body: payload,
    });

    if (error) throw new Error(`AI timeline: ${error.message}`);
    if (!data) throw new Error("AI timeline: empty response");

    // Validate the returned structure minimally
    const d = data as Partial<AiTimelineCache>;
    if (
      typeof d.trends?.headline !== "string" ||
      !Array.isArray(d.trends?.items) ||
      typeof d.recovery?.headline !== "string" ||
      !Array.isArray(d.recovery?.items)
    ) {
      throw new Error("AI timeline: invalid response shape");
    }

    const cache: AiTimelineCache = {
      timelineContext: ctx,
      currentSession: d.currentSession ?? null,
      trends: d.trends,
      recovery: d.recovery,
      generatedAt: Date.now(),
    };

    setCache(cache);
    return applyEnhancement(result, cache);
  } catch (err) {
    // Graceful degradation — rules-based output is always valid
    console.warn("[aiTimelineInsights] falling back to rules:", err);
    return result;
  }
}
