"use client";

// Insights page — timeline-aware, rules-first, AI-enhanced.
//
// Layout (top → bottom):
//   Page header
//   Status banner (Option A "Signal" — dot + mono label + stats pill)
//   Warnings strip
//   Carousel: Insights · Readiness · Stimulus · PRs · Muscles
//   AI status bar
//
// Data flow:
//   1. Load movements + finished workouts + active (unfinished) workout in parallel.
//   2. Run computeInsightResult() synchronously → rules-based InsightResult.
//   3. Render sections immediately with rules output.
//   4. Fire enhanceInsightsWithAi() in background → overlay AI language if successful.
//   5. Existing carousel (Readiness / Stimulus / PRs / Muscles) loads below.
//
// AI fallback: if AI fails for any reason, the page shows rules output unchanged.

import { useCallback, useEffect, useRef, useState } from "react";
import { listWorkouts, listMovements } from "@/lib/db";
import type { Workout, Movement } from "@/lib/types";
import {
  computeReadiness,
  computeWeeklyStimulus,
  computePRs,
  computeMuscleReadiness,
  type ReadinessScores,
  type MuscleReadinessRow,
  type StimulusBar,
  type PRBadge,
} from "@/lib/engine/momentum";
import {
  computeInsightResult,
  type InsightResult,
  type InsightItem,
  type InsightSection,
  type TimelineContext,
  type BodyPartLoad,
} from "@/lib/engine/insightEngine";
import {
  enhanceInsightsWithAi,
  invalidateAiTimelineCache,
  aiTimelineAgeLabel,
} from "@/lib/engine/aiTimelineInsights";
import {
  fetchAiInsights,
  invalidateAiCache,
  ageLabel,
  type AiInsights,
} from "@/lib/engine/aiInsights";
import s from "./MomentumPage.module.css";

const CAROUSEL_LABELS = ["Insights", "Stimulus", "PRs"];

// ─── Timeline context helpers ─────────────────────────────────────────────────

const STATUS_META: Record<
  TimelineContext,
  { label: string; dotClass: string }
> = {
  CURRENT_ACTIVE_SESSION: {
    label: "Active Session",
    dotClass: s.active,
  },
  TODAY_COMPLETED: {
    label: "Completed Today",
    dotClass: s.done,
  },
  NO_TODAY_RECENT_HISTORY: {
    label: "Training History",
    dotClass: s.history,
  },
};

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [finishedWorkouts, setFinishedWorkouts] = useState<Workout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);

  // Timeline-aware insight state
  const [insightResult, setInsightResult] = useState<InsightResult | null>(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [aiTimelineLoading, setAiTimelineLoading] = useState(false);
  const [aiTimelineErr, setAiTimelineErr] = useState<string | null>(null);
  const [aiTimelineAge, setAiTimelineAge] = useState<number | null>(null);

  // Carousel AI (existing readiness/stimulus/PRs AI)
  const [carouselAi, setCarouselAi] = useState<AiInsights | null>(null);
  const [carouselAiLoading, setCarouselAiLoading] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // ── Data load ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [mv, finished, activeArr] = await Promise.all([
        listMovements(),
        listWorkouts({ finished: true }),
        listWorkouts({ finished: false, limit: 1 }),
      ]);
      const active = activeArr[0] ?? null;

      setMovements(mv);
      setFinishedWorkouts(finished);
      setActiveWorkout(active);

      // Compute rules-based insights synchronously
      const result = computeInsightResult(finished, mv, active);
      setInsightResult(result);

      // Fire AI enhancement in background (non-blocking)
      loadAiTimeline(result);
      loadCarouselAi(finished, mv);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAiTimeline = useCallback(
    async (result: InsightResult, force = false) => {
      setAiTimelineLoading(true);
      setAiTimelineErr(null);
      try {
        const enhanced = await enhanceInsightsWithAi(result, { forceRefresh: force });
        setInsightResult(enhanced);
        setAiEnhanced(true);
        setAiTimelineAge(Date.now());
      } catch {
        setAiTimelineErr("AI enhancement unavailable");
      } finally {
        setAiTimelineLoading(false);
      }
    },
    []
  );

  const loadCarouselAi = useCallback(
    async (wk: Workout[], mv: Movement[], force = false) => {
      setCarouselAiLoading(true);
      try {
        const insights = await fetchAiInsights(wk, mv, { forceRefresh: force });
        setCarouselAi(insights);
      } catch {
        // Carousel AI is best-effort — silent failure
      } finally {
        setCarouselAiLoading(false);
      }
    },
    []
  );

  function handleRefreshAi() {
    if (!insightResult) return;
    invalidateAiTimelineCache();
    invalidateAiCache();
    setAiEnhanced(false);
    loadAiTimeline(insightResult, true);
    loadCarouselAi(finishedWorkouts, movements, true);
  }

  useEffect(() => {
    load();
  }, [load]);

  // Carousel dot tracking
  useEffect(() => {
    const track = carouselRef.current;
    if (!track) return;
    const onScroll = () => {
      setCarouselIdx(Math.round(track.scrollLeft / track.clientWidth));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToCard(idx: number) {
    const track = carouselRef.current;
    if (!track) return;
    track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
  }

  // Carousel scores (recomputed from finished workouts for carousel cards)
  const scores = computeReadiness(finishedWorkouts, movements);
  const stimulus = computeWeeklyStimulus(finishedWorkouts, movements);
  const prs = computePRs(finishedWorkouts, movements);
  const muscleReadiness = computeMuscleReadiness(finishedWorkouts, movements);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className={s.head}>
        <div className={s.headInner}>
          <h1 className={s.headline}>Insights</h1>
          <div className={s.subline}>Training Intelligence</div>
        </div>
      </div>

      {loading ? (
        <div className={s.loadingState}>Loading…</div>
      ) : err ? (
        <div className={s.errorState}>{err}</div>
      ) : insightResult ? (
        <>
          {/* ── Warnings ──────────────────────────────────────────────────── */}
          {insightResult.warnings.length > 0 && (
            <div className={s.warningsWrap}>
              {insightResult.warnings.map((w, i) => (
                <div key={i} className={s.warningItem}>
                  <span className={s.warningIcon} aria-hidden="true">!</span>
                  <span className={s.warningText}>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── AI status bar ──────────────────────────────────────────────── */}
          <div className={s.aiBar}>
            <span className={s.aiBarLabel}>
              {aiTimelineLoading ? (
                <span className={s.aiBarSpinner} aria-label="Generating AI insights" />
              ) : (
                <span
                  className={s.aiBarDot}
                  data-ok={!aiTimelineErr}
                  aria-hidden="true"
                />
              )}
              {aiTimelineLoading
                ? "AI analysis running…"
                : aiTimelineErr
                ? "AI unavailable · rule-based mode"
                : aiEnhanced && aiTimelineAge
                ? `AI enhanced · ${aiTimelineAgeLabel(aiTimelineAge)}`
                : "Rules-based insights"}
            </span>
            {!aiTimelineLoading && (
              <button
                type="button"
                className={s.aiBarRefresh}
                onClick={handleRefreshAi}
                aria-label="Refresh insights"
              >
                ↻
              </button>
            )}
          </div>

          {/* ── Carousel ──────────────────────────────────────────────────── */}
          <div className={s.carouselWrap}>
            <div className={s.carouselTrack} ref={carouselRef}>
              {/* Slide 0 — Insights (Today | Trends | Recovery) */}
              <div className={s.carouselSlide}>
                <InsightsCard insightResult={insightResult} scores={scores} ai={carouselAi?.readiness ?? null} />
              </div>
              {/* Slide 1 — Stimulus */}
              <div className={s.carouselSlide}>
                <StimulusCard
                  stimulus={stimulus}
                  ai={carouselAi?.stimulus ?? null}
                />
              </div>
              {/* Slide 2 — PRs */}
              <div className={s.carouselSlide}>
                <PRsCard prs={prs} aiPrs={carouselAi?.prs ?? null} />
              </div>
            </div>
            <div className={s.dots}>
              {CAROUSEL_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className={`${s.dot} ${carouselIdx === i ? s.dotActive : ""}`}
                  onClick={() => scrollToCard(i)}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Status banner (Option A "Signal") ───────────────────────────────────────

function StatusBanner({ insightResult }: { insightResult: InsightResult }) {
  const { timelineContext, metrics } = insightResult;
  const meta = STATUS_META[timelineContext];

  const showStatsPill =
    timelineContext !== "NO_TODAY_RECENT_HISTORY" &&
    metrics.currentSessionSets > 0;

  const rpe =
    metrics.currentSessionAvgRpe != null
      ? metrics.currentSessionAvgRpe.toFixed(1)
      : null;

  return (
    <div className={s.statusBanner}>
      <span className={`${s.statusDot} ${meta.dotClass}`} aria-hidden="true" />
      <span className={s.statusLabel}>{meta.label}</span>
      {showStatsPill && (
        <span className={s.statusStatsPill}>
          {metrics.currentSessionSets} SETS
          {rpe != null ? ` · RPE ${rpe}` : ""}
        </span>
      )}
    </div>
  );
}

// ─── InsightsCard — 3-tab: Today | Trends | Recovery ─────────────────────────

function InsightsCard({
  insightResult,
  scores,
  ai,
}: {
  insightResult: InsightResult;
  scores: ReadinessScores;
  ai: import("@/lib/engine/aiInsights").AiReadiness | null;
}) {
  const [tab, setTab] = useState<"today" | "trends" | "recovery">("today");
  const { metrics, timelineContext } = insightResult;

  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>
            {tab === "today" ? "Session data" : tab === "trends" ? "Volume trend" : "Recovery status"}
          </div>
          <div className={s.heroCardTitle}>Insights</div>
        </div>
      </div>
      <div className={s.heroInner} style={{ minHeight: 248, maxHeight: 248, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {/* 3-tab toggle */}
        <div className={s.fatigueTogglePill}>
          <button
            type="button"
            className={`${s.fatigueToggleBtn} ${tab === "today" ? s.on : ""}`}
            onClick={() => setTab("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={`${s.fatigueToggleBtn} ${tab === "trends" ? s.on : ""}`}
            onClick={() => setTab("trends")}
          >
            Trends
          </button>
          <button
            type="button"
            className={`${s.fatigueToggleBtn} ${tab === "recovery" ? s.on : ""}`}
            onClick={() => setTab("recovery")}
          >
            Recovery
          </button>
        </div>

        {tab === "today" && <InsightsTodayTab metrics={metrics} timelineContext={timelineContext} scores={scores} ai={ai} />}
        {tab === "trends" && <InsightsTrendsTab metrics={metrics} />}
        {tab === "recovery" && <InsightsRecoveryTab metrics={metrics} />}
      </div>
    </section>
  );
}

// ── Today tab ─────────────────────────────────────────────────────────────────

function InsightsTodayTab({
  metrics,
  timelineContext,
  scores,
  ai,
}: {
  metrics: InsightResult["metrics"];
  timelineContext: TimelineContext;
  scores: ReadinessScores;
  ai: import("@/lib/engine/aiInsights").AiReadiness | null;
}) {
  const noData =
    timelineContext === "NO_TODAY_RECENT_HISTORY" &&
    metrics.currentSessionSets === 0;

  if (noData) {
    return (
      <div className={s.stimulusEmpty}>
        No session today — log a workout to see session data.
      </div>
    );
  }

  const totalSets = metrics.currentSessionSets;
  const avgRpe = metrics.currentSessionAvgRpe;
  const hardSets = metrics.currentSessionHardSets;

  // Readiness captions (prefer AI-enhanced, fall back to rules)
  const readinessCap = ai?.readinessCap ?? scores.readinessCap;
  const recoveryCap  = ai?.recoveryCap  ?? scores.recoveryCap;
  const fatigueCap   = ai?.fatigueCap   ?? scores.fatigueCap;

  // Top 5 body parts by sets
  const sorted = [...metrics.currentSessionBodyParts]
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 5);
  const maxSets = sorted[0]?.sets ?? 1;

  return (
    <>
      {/* Readiness headline from scores */}
      {scores.title && (
        <div className={s.readinessHeadline}>{scores.title}</div>
      )}

      {/* Readiness / Recovery / Fatigue tiles — absorbed from ReadinessCard */}
      <div className={s.statTiles}>
        <div className={s.statTile}>
          <span className={s.statTileLabel}>Readiness</span>
          <div className={s.statTileValue}>
            {scores.readiness != null ? scores.readiness : "—"}
            {scores.readiness != null && <span className={s.statTileValueSuffix}>%</span>}
          </div>
          <div className={s.readinessBar}>
            <div className={s.readinessBarFill} style={{ width: `${scores.readiness ?? 0}%` }} />
          </div>
          <div className={s.statTileCaption}>{readinessCap}</div>
        </div>
        <div className={s.statTile}>
          <span className={s.statTileLabel}>Recovery</span>
          <div className={s.statTileValue}>
            {scores.recovery}<span className={s.statTileValueSuffix}>%</span>
          </div>
          <div className={s.readinessBar}>
            <div className={s.readinessBarFill} style={{ width: `${scores.recovery}%` }} />
          </div>
          <div className={s.statTileCaption}>{recoveryCap}</div>
        </div>
        <div className={s.statTile}>
          <span className={s.statTileLabel}>Fatigue</span>
          <div className={s.statTileValue}>
            {scores.fatigue}<span className={s.statTileValueSuffix}>%</span>
          </div>
          <div className={s.readinessBar}>
            <div className={s.readinessBarFill} style={{ width: `${scores.fatigue}%` }} />
          </div>
          <div className={s.statTileCaption}>{fatigueCap}</div>
        </div>
      </div>

      {/* Session stats — secondary row */}
      {totalSets > 0 && (
        <div className={s.sessionStatRow}>
          <span className={s.sessionStatItem}>
            <span className={s.sessionStatVal}>{totalSets}</span>
            <span className={s.sessionStatLbl}>sets</span>
          </span>
          <span className={s.sessionStatDot} aria-hidden="true">·</span>
          <span className={s.sessionStatItem}>
            <span className={s.sessionStatVal}>
              {avgRpe != null ? avgRpe.toFixed(1) : "—"}
            </span>
            <span className={s.sessionStatLbl}>avg RPE</span>
          </span>
          <span className={s.sessionStatDot} aria-hidden="true">·</span>
          <span className={s.sessionStatItem}>
            <span className={s.sessionStatVal}>{hardSets}</span>
            <span className={s.sessionStatLbl}>hard sets</span>
          </span>
        </div>
      )}

      {/* Volume by muscle */}
      {sorted.length > 0 && (
        <>
          <div className={s.muscleBarsEyebrow}>Volume by muscle</div>
          <div className={s.muscleBars}>
            {sorted.map((bp) => (
              <div key={bp.key} className={s.muscleBarRow}>
                <span className={s.muscleBarName}>{bp.label}</span>
                <div className={s.muscleBarTrack}>
                  <div
                    className={s.muscleBarFill}
                    style={{ width: `${(bp.sets / maxSets) * 100}%` }}
                  />
                </div>
                <span className={s.muscleBarCount}>{bp.sets}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Trends tab ────────────────────────────────────────────────────────────────

function InsightsTrendsTab({ metrics }: { metrics: InsightResult["metrics"] }) {
  const sorted7d = [...metrics.bodyPartLoads7d]
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 5);
  const maxSets7d = sorted7d[0]?.sets ?? 1;
  const totalSets7d = metrics.bodyPartLoads7d.reduce((sum, bp) => sum + bp.sets, 0);

  // Analysis note
  let noteText: string | null = null;
  if (metrics.rpeTrend === "rising") {
    noteText = "Avg RPE trending upward across recent sessions — intensity is accumulating.";
  } else if (metrics.rpeTrend === "falling") {
    noteText = "Avg RPE trending lower — effort is easing across recent sessions.";
  } else if (totalSets7d > 0) {
    noteText = `${totalSets7d} sets this week. Volume distribution is stable.`;
  }

  if (sorted7d.length === 0) {
    return (
      <div className={s.stimulusEmpty}>No session data in the last 7 days.</div>
    );
  }

  return (
    <>
      <div className={s.muscleBarsEyebrow}>Volume vs last week</div>
      <div className={s.muscleBars}>
        {sorted7d.map((bp) => {
          const deltaRaw = metrics.volumeChangeVsBaseline[bp.key];
          let deltaLabel: string;
          let deltaClass: string;
          if (deltaRaw === undefined || deltaRaw === null) {
            deltaLabel = "New";
            deltaClass = s.deltaNew;
          } else if (deltaRaw > 0) {
            deltaLabel = `+${Math.round(deltaRaw)}%`;
            deltaClass = s.deltaUp;
          } else {
            deltaLabel = `${Math.round(deltaRaw)}%`;
            deltaClass = s.deltaDown;
          }

          return (
            <div key={bp.key} className={s.muscleBarRow}>
              <span className={s.muscleBarName}>{bp.label}</span>
              <div className={`${s.muscleBarTrack} ${s.hasDelta}`}>
                <div
                  className={s.muscleBarFill}
                  style={{ width: `${(bp.sets / maxSets7d) * 100}%` }}
                />
              </div>
              <span className={`${s.muscleBarDelta} ${deltaClass}`}>{deltaLabel}</span>
            </div>
          );
        })}
      </div>
      {noteText && (
        <div className={s.insightNote}>{noteText}</div>
      )}
    </>
  );
}

// ── Recovery tab ──────────────────────────────────────────────────────────────

function InsightsRecoveryTab({ metrics }: { metrics: InsightResult["metrics"] }) {
  const { fatigueScore, recoveryScore, repeatedExposure72h } = metrics;

  // Fatigue sub-label
  let fatigueSub: string;
  let fatigueSubClass: string;
  if (fatigueScore >= 75) {
    fatigueSub = "high";
    fatigueSubClass = s.subAlert;
  } else if (fatigueScore >= 50) {
    fatigueSub = "moderate";
    fatigueSubClass = s.subWarn;
  } else {
    fatigueSub = "low";
    fatigueSubClass = s.subOk;
  }

  // Recovery sub-label
  let recoverySub: string;
  if (recoveryScore >= 70) {
    recoverySub = "adequate";
  } else if (recoveryScore >= 40) {
    recoverySub = "building";
  } else {
    recoverySub = "limited";
  }

  // Repeated exposure chips
  const exposureEntries = Object.entries(repeatedExposure72h).filter(
    ([, count]) => count >= 1
  );

  // Analysis note
  let noteText: string | null = null;
  let noteWarn = false;

  if (fatigueScore >= 75) {
    noteText = "High accumulated fatigue — next session performance may be reduced.";
    noteWarn = true;
  } else {
    // Check for any key with count >= 2
    const highExposure = exposureEntries.find(([, count]) => count >= 2);
    if (highExposure) {
      // Find label from bodyPartLoads7d or currentSessionBodyParts
      const [key, count] = highExposure;
      const bpLabel =
        metrics.bodyPartLoads7d.find((bp) => bp.key === key)?.label ??
        metrics.currentSessionBodyParts.find((bp) => bp.key === key)?.label ??
        key;
      noteText = `${bpLabel} trained ${count}× in 72h — consider reducing volume next session.`;
      noteWarn = true;
    } else if (fatigueScore < 30) {
      noteText = "Fatigue is low — readiness for the next session looks solid.";
    } else {
      noteText = "Monitor readiness going into the next session.";
    }
  }

  return (
    <>
      {/* 2-tile row: Fatigue / Recovery */}
      <div className={s.statTiles2}>
        <div className={s.statTile}>
          <span className={s.statTileLabel}>Fatigue</span>
          <div className={s.statTileValue}>
            {fatigueScore}
            <span className={s.statTileValueSuffix}>%</span>
          </div>
          <span className={`${s.statTileSub} ${fatigueSubClass}`}>{fatigueSub}</span>
        </div>
        <div className={s.statTile}>
          <span className={s.statTileLabel}>Recovery</span>
          <div className={s.statTileValue}>
            {recoveryScore}
            <span className={s.statTileValueSuffix}>%</span>
          </div>
          <span className={s.statTileSub}>{recoverySub}</span>
        </div>
      </div>

      {/* Muscle exposure 72h */}
      <div className={s.muscleBarsEyebrow}>Muscle exposure 72h</div>
      {exposureEntries.length === 0 ? (
        <div className={s.stimulusEmpty}>
          No repeated muscle exposure in the last 72 hours.
        </div>
      ) : (
        <div className={s.exposureChips}>
          {exposureEntries.map(([key, count]) => {
            const label =
              metrics.bodyPartLoads7d.find((bp) => bp.key === key)?.label ??
              metrics.currentSessionBodyParts.find((bp) => bp.key === key)?.label ??
              key;
            const isHigh = count >= 2;
            return (
              <span
                key={key}
                className={`${s.exposureChip} ${isHigh ? s.exposureHigh : ""}`}
              >
                {label} ×{count}
              </span>
            );
          })}
        </div>
      )}

      {/* Analysis note */}
      {noteText && (
        <div className={`${s.insightNote} ${noteWarn ? s.insightNoteWarn : ""}`}>
          {noteText}
        </div>
      )}
    </>
  );
}

// ─── InsightCard — kept for reference, no longer rendered ────────────────────

function InsightCard({
  section,
  accent,
}: {
  section: { eyebrow: string; headline: string; items: InsightItem[] };
  accent: "session" | "trend" | "recovery";
}) {
  const toneClass = (tone: InsightItem["tone"]) => {
    switch (tone) {
      case "positive": return s.itemPositive;
      case "caution":  return s.itemCaution;
      case "alert":    return s.itemAlert;
      default:         return s.itemNeutral;
    }
  };

  return (
    <section className={`${s.insightCard} ${s[`insightCard_${accent}`]}`}>
      <div className={s.insightCardHead}>
        <div className={s.insightCardEyebrow}>{section.eyebrow}</div>
        <div className={s.insightCardTitle}>{section.headline}</div>
      </div>
      {section.items.length > 0 && (
        <ul className={s.insightList}>
          {section.items.map((item, i) => (
            <li key={i} className={`${s.insightItem} ${toneClass(item.tone)}`}>
              <span className={s.insightDot} aria-hidden="true" />
              <span className={s.insightText}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Readiness card (carousel) ────────────────────────────────────────────────

function ReadinessCard({
  scores,
  ai,
}: {
  scores: ReadinessScores;
  ai: import("@/lib/engine/aiInsights").AiReadiness | null;
}) {
  const recAction    = ai?.recommendation ?? scores.recAction;
  const recBullets   = ai?.bullets        ?? scores.recBullets;
  const readinessCap = ai?.readinessCap   ?? scores.readinessCap;
  const recoveryCap  = ai?.recoveryCap    ?? scores.recoveryCap;
  const fatigueCap   = ai?.fatigueCap     ?? scores.fatigueCap;

  const toneClass =
    scores.recTone === "high" ? s.toneHigh
    : scores.recTone === "med"  ? s.toneMed
    : scores.recTone === "pos"  ? s.tonePos
    : "";

  return (
    <section className={`${s.heroCard} ${s.readinessCard}`}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardTitle}>{scores.title}</div>
        </div>
      </div>
      <div className={s.heroInner}>
        <div className={s.readinessGrid}>
          <div className={s.readinessStat}>
            <div className={s.readinessStatLabel}>Readiness</div>
            <div className={s.readinessStatNumRow}>
              <span className={s.readinessStatValue}>
                {scores.readiness != null ? scores.readiness : "—"}
              </span>
              {scores.readiness != null && (
                <span className={s.readinessStatSuffix}>%</span>
              )}
            </div>
            <div className={s.readinessBar}>
              <div className={s.readinessBarFill} style={{ width: `${scores.readiness ?? 0}%` }} />
            </div>
            <div className={s.readinessStatCaption}>{readinessCap}</div>
          </div>

          <div className={s.readinessStat}>
            <div className={s.readinessStatLabel}>Recovery</div>
            <div className={s.readinessStatNumRow}>
              <span className={s.readinessStatValue}>{scores.recovery}</span>
              <span className={s.readinessStatSuffix}>%</span>
            </div>
            <div className={s.readinessBar}>
              <div className={s.readinessBarFill} style={{ width: `${scores.recovery}%` }} />
            </div>
            <div className={s.readinessStatCaption}>{recoveryCap}</div>
          </div>

          <div className={s.readinessStat}>
            <div className={s.readinessStatLabel}>Fatigue</div>
            <div className={s.readinessStatNumRow}>
              <span className={s.readinessStatValue}>{scores.fatigue}</span>
              <span className={s.readinessStatSuffix}>%</span>
            </div>
            <div className={s.readinessBar}>
              <div className={s.readinessBarFill} style={{ width: `${scores.fatigue}%` }} />
            </div>
            <div className={s.readinessStatCaption}>{fatigueCap}</div>
          </div>
        </div>

        <div className={s.rdRecommendation}>
          <div className={s.rdRecHead}>
            <span className={s.rdRecLabel}>{ai ? "AI:" : "Recommendation:"}</span>
            <span className={`${s.rdRecAction} ${toneClass}`}>{recAction}</span>
          </div>
          <p className={s.rdRecPara}>{recBullets.join(" ")}</p>
        </div>
      </div>
    </section>
  );
}

// ─── Stimulus card (carousel) — single view, no tabs ─────────────────────────

function StimulusCard({
  stimulus,
  ai,
}: {
  stimulus: { bars: StimulusBar[]; totalSets: number; tier: string; tierTone: string };
  ai: import("@/lib/engine/aiInsights").AiStimulus | null;
}) {
  const tierClass =
    stimulus.tierTone === "pos"  ? s.tonePos
    : stimulus.tierTone === "med"  ? s.toneMed
    : stimulus.tierTone === "high" ? s.toneHigh
    : "";

  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>Hypertrophy share</div>
          <div className={s.heroCardTitle}>Muscle Stimulus</div>
        </div>
      </div>
      <div className={s.heroInner}>
        <div className={s.stimulusHero}>
          <div>
            <span className={s.stimulusNum}>{stimulus.totalSets}</span>
            <span className={s.stimulusSuffix}>sets</span>
          </div>
          <div className={s.stimulusLabel}>Weekly sets</div>
          <div className={`${s.stimulusTier} ${tierClass}`}>{stimulus.tier}</div>
        </div>

        {stimulus.bars.length === 0 ? (
          <div className={s.stimulusEmpty}>
            Log working sets this week to see stimulus distribution.
          </div>
        ) : (
          <div className={s.stimulusBars}>
            {stimulus.bars.map((bar) => (
              <div key={bar.key} className={s.stimulusBarRow}>
                <span className={s.stimulusBarName}>{bar.label}</span>
                <div className={s.stimulusBarTrack}>
                  <div className={s.stimulusBarFill} style={{ width: `${bar.pct}%` }} />
                </div>
                <span className={s.stimulusSets}>{bar.sets}</span>
              </div>
            ))}
          </div>
        )}

        {ai && (
          <div className={s.aiBlock}>
            <p className={s.aiBlockText}>{ai.summary}</p>
            {ai.adjustments.length > 0 && (
              <ul className={s.aiBlockList}>
                {ai.adjustments.map((adj, i) => (
                  <li key={i}>{adj}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── PRs card (carousel) ──────────────────────────────────────────────────────

function PRsCard({
  prs,
  aiPrs,
}: {
  prs: PRBadge[];
  aiPrs: import("@/lib/engine/aiInsights").AiPR[] | null;
}) {
  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>Achievements</div>
          <div className={s.heroCardTitle}>Recent PRs</div>
        </div>
      </div>
      <div className={s.heroInner}>
        {prs.length === 0 ? (
          <div className={s.prList}>
            <div className={s.prBadge}>
              <span className={s.prGlyph}>★</span>
              <span className={s.prLabel}>Top set</span>
              <span className={s.prValue}>No PRs yet</span>
              <span className={s.prSub}>
                Finish a session to seed your first record.
              </span>
            </div>
          </div>
        ) : (
          <div className={s.prList}>
            {prs.map((badge, i) => {
              const aiPr =
                aiPrs?.find(
                  (p) =>
                    p.movement.toLowerCase() === badge.label.toLowerCase()
                ) ?? null;
              return (
                <div key={i} className={s.prBadge}>
                  <span className={s.prGlyph}>{badge.glyph}</span>
                  <span className={s.prLabel}>{badge.label}</span>
                  <span className={s.prValue}>{badge.value}</span>
                  <span className={s.prSub}>{badge.sub}</span>
                  {aiPr && (
                    <div className={s.prAiWrap}>
                      <span className={s.prAiTarget}>→ {aiPr.nextTarget}</span>
                      <span className={s.prAiContext}>{aiPr.context}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Muscle Readiness card (carousel) ────────────────────────────────────────

function MuscleReadinessCard({
  upper,
  lower,
}: {
  upper: MuscleReadinessRow[];
  lower: MuscleReadinessRow[];
}) {
  const [tab, setTab] = useState<"upper" | "lower">("upper");
  const rows = tab === "upper" ? upper : lower;

  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>Recovery status</div>
          <div className={s.heroCardTitle}>Muscle Readiness</div>
        </div>
      </div>
      <div className={s.heroInner}>
        <div className={s.fatigueTogglePill}>
          <button
            type="button"
            className={`${s.fatigueToggleBtn} ${tab === "upper" ? s.on : ""}`}
            onClick={() => setTab("upper")}
          >
            Upper body
          </button>
          <button
            type="button"
            className={`${s.fatigueToggleBtn} ${tab === "lower" ? s.on : ""}`}
            onClick={() => setTab("lower")}
          >
            Lower body
          </button>
        </div>
        <div className={s.mrGrid}>
          {rows.map((row) => (
            <MrTile key={row.key} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MrTile({ row }: { row: MuscleReadinessRow }) {
  return (
    <div className={s.mrTile}>
      <div className={s.mrTileName}>{row.label}</div>
      <div className={s.mrBarTrack}>
        <div
          className={`${s.mrBarFill} ${s[row.status]}`}
          style={{ width: `${row.recoveryPct}%` }}
        />
      </div>
      <div className={s.mrTileBottom}>
        <span className={`${s.mrPill} ${s[row.status]}`}>{row.statusLabel}</span>
        <span className={s.mrTileStat}>{row.daysStat}</span>
      </div>
    </div>
  );
}
