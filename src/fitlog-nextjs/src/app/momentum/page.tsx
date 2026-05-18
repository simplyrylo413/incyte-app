"use client";

// Insights page — timeline-aware, rules-first, AI-enhanced.
//
// Layout (top → bottom):
//   Page header
//   Timeline badge (Active Session / Completed Today / Training History)
//   ── Current Session / Today's Work card (conditional) ──
//   ── Carousel: Readiness · Stimulus (Trends + Recovery tabs) · PRs · Muscles ──
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
  type TimelineContext,
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

const CAROUSEL_LABELS = ["Readiness", "Stimulus", "PRs", "Muscles"];

// ─── Timeline context helpers ─────────────────────────────────────────────────

const TIMELINE_META: Record<
  TimelineContext,
  { badge: string; badgeClass: string; description: string }
> = {
  CURRENT_ACTIVE_SESSION: {
    badge: "Active Session",
    badgeClass: s.badgeActive,
    description: "Observing current workout",
  },
  TODAY_COMPLETED: {
    badge: "Completed Today",
    badgeClass: s.badgeCompleted,
    description: "Today's session is done",
  },
  NO_TODAY_RECENT_HISTORY: {
    badge: "Training History",
    badgeClass: s.badgeHistory,
    description: "No session today",
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
    // Re-run rules from fresh data, then force-refresh AI
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
          {/* ── Timeline badge ────────────────────────────────────────────── */}
          <div className={s.timelineRow}>
            <span
              className={`${s.timelineBadge} ${TIMELINE_META[insightResult.timelineContext].badgeClass}`}
            >
              {TIMELINE_META[insightResult.timelineContext].badge}
            </span>
            <span className={s.timelineDesc}>
              {TIMELINE_META[insightResult.timelineContext].description}
            </span>
          </div>

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

          {/* ── Section 1: Current Session / Today's Work ─────────────────── */}
          {insightResult.currentSessionInsights && (
            <InsightCard
              section={insightResult.currentSessionInsights}
              accent="session"
            />
          )}

          {/* ── Carousel ──────────────────────────────────────────────────── */}
          <div className={s.carouselWrap}>
            <div className={s.carouselTrack} ref={carouselRef}>
              {/* Slide 0 — Readiness */}
              <div className={s.carouselSlide}>
                <ReadinessCard scores={scores} ai={carouselAi?.readiness ?? null} />
              </div>
              {/* Slide 1 — Stimulus (3-tab: Stimulus · Trends · Recovery) */}
              <div className={s.carouselSlide}>
                <StimulusCard
                  stimulus={stimulus}
                  ai={carouselAi?.stimulus ?? null}
                  trendInsights={insightResult.trendInsights}
                  recoveryOutlook={insightResult.recoveryOutlook}
                />
              </div>
              {/* Slide 2 — PRs */}
              <div className={s.carouselSlide}>
                <PRsCard prs={prs} aiPrs={carouselAi?.prs ?? null} />
              </div>
              {/* Slide 3 — Muscle Readiness */}
              <div className={s.carouselSlide}>
                <MuscleReadinessCard
                  upper={muscleReadiness.upper}
                  lower={muscleReadiness.lower}
                />
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
        </>
      ) : null}
    </div>
  );
}

// ─── InsightCard — shared section renderer ────────────────────────────────────

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

// ─── Stimulus card (carousel) — 3-tab: Stimulus · Trends · Recovery ──────────

function StimulusCard({
  stimulus,
  ai,
  trendInsights,
  recoveryOutlook,
}: {
  stimulus: { bars: StimulusBar[]; totalSets: number; tier: string; tierTone: string };
  ai: import("@/lib/engine/aiInsights").AiStimulus | null;
  trendInsights: { eyebrow: string; headline: string; items: InsightItem[] };
  recoveryOutlook: { eyebrow: string; headline: string; items: InsightItem[] };
}) {
  const [tab, setTab] = useState<"stimulus" | "trends" | "recovery">("stimulus");

  const tierClass =
    stimulus.tierTone === "pos"  ? s.tonePos
    : stimulus.tierTone === "med"  ? s.toneMed
    : stimulus.tierTone === "high" ? s.toneHigh
    : "";

  const toneClass = (tone: InsightItem["tone"]) => {
    switch (tone) {
      case "positive": return s.itemPositive;
      case "caution":  return s.itemCaution;
      case "alert":    return s.itemAlert;
      default:         return s.itemNeutral;
    }
  };

  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>
            {tab === "stimulus" ? "Hypertrophy share" : tab === "trends" ? trendInsights.eyebrow : recoveryOutlook.eyebrow}
          </div>
          <div className={s.heroCardTitle}>
            {tab === "stimulus" ? "Muscle Stimulus" : tab === "trends" ? trendInsights.headline : recoveryOutlook.headline}
          </div>
        </div>
      </div>
      <div className={s.heroInner}>

        {/* 3-tab toggle pill — reuses fatigueTogglePill/Btn which flex: 1 across N buttons */}
        <div className={s.fatigueTogglePill}>
          <button
            type="button"
            className={`${s.fatigueToggleBtn} ${tab === "stimulus" ? s.on : ""}`}
            onClick={() => setTab("stimulus")}
          >
            Stimulus
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

        {/* Stimulus tab */}
        {tab === "stimulus" && (
          <>
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
          </>
        )}

        {/* Trends tab */}
        {tab === "trends" && (
          trendInsights.items.length > 0 ? (
            <ul className={s.insightList}>
              {trendInsights.items.map((item, i) => (
                <li key={i} className={`${s.insightItem} ${toneClass(item.tone)}`}>
                  <span className={s.insightDot} aria-hidden="true" />
                  <span className={s.insightText}>{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={s.stimulusEmpty}>Log sessions to see trend analysis.</div>
          )
        )}

        {/* Recovery tab */}
        {tab === "recovery" && (
          recoveryOutlook.items.length > 0 ? (
            <ul className={s.insightList}>
              {recoveryOutlook.items.map((item, i) => (
                <li key={i} className={`${s.insightItem} ${toneClass(item.tone)}`}>
                  <span className={s.insightDot} aria-hidden="true" />
                  <span className={s.insightText}>{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={s.stimulusEmpty}>Log sessions to generate a recovery outlook.</div>
          )
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
