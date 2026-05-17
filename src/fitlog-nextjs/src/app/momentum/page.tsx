"use client";

// Momentum / Insights — horizontal snap-scroll carousel.
// Visual parity: src/mobile351.html .insights-carousel-wrap (lines 9041–9193).
// 4 cards: Readiness · Recovery Map · Muscle Stimulus · PRs
// Cards are always expanded in carousel mode (no collapse toggle).
// AI insights powered by OpenAI via Supabase Edge Function (§13-Q AI-readiness).

import { useCallback, useEffect, useRef, useState } from "react";
import { listWorkouts, listMovements } from "@/lib/db";
import type { Workout, Movement } from "@/lib/types";
import {
  computeReadiness,
  computeMuscleFatigue,
  computeWeeklyStimulus,
  computePRs,
  computeMuscleReadiness,
  type ReadinessScores,
  type MuscleFatigueRow,
  type MuscleReadinessRow,
  type StimulusBar,
  type PRBadge,
} from "@/lib/engine/momentum";
import {
  fetchAiInsights,
  invalidateAiCache,
  ageLabel,
  type AiInsights,
  type AiRecovery,
} from "@/lib/engine/aiInsights";
import s from "./MomentumPage.module.css";

const CARD_LABELS = ["Readiness", "Recovery", "Stimulus", "PRs", "Muscles"];

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // AI state — loaded after workout data, gracefully degrades on error
  const [ai, setAi] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mv, wk] = await Promise.all([
        listMovements(),
        listWorkouts({ finished: true }),
      ]);
      setMovements(mv);
      setWorkouts(wk);
      setErr(null);
      // Kick off AI load in the background — don't block the page render
      loadAi(wk, mv);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAi = useCallback(async (
    wk: Workout[],
    mv: Movement[],
    force = false
  ) => {
    setAiLoading(true);
    setAiErr(null);
    try {
      const insights = await fetchAiInsights(wk, mv, { forceRefresh: force });
      setAi(insights);
    } catch (e) {
      setAiErr(String(e));
    } finally {
      setAiLoading(false);
    }
  }, []);

  function handleRefreshAi() {
    invalidateAiCache();
    loadAi(workouts, movements, true);
  }

  useEffect(() => { load(); }, [load]);

  // Track scroll position → active dot
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const idx = Math.round(track.scrollLeft / track.clientWidth);
      setActiveIdx(idx);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToCard(idx: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
  }

  const scores          = computeReadiness(workouts, movements);
  const stimulus        = computeWeeklyStimulus(workouts, movements);
  const prs             = computePRs(workouts, movements);
  const muscleReadiness = computeMuscleReadiness(workouts, movements);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.headInner}>
          <h1 className={s.headline}>Insights</h1>
          <div className={s.subline}>Readiness · Fatigue · Stimulus · PRs</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "24px", color: "#5e6a82", fontSize: 13 }}>
          Loading…
        </div>
      ) : err ? (
        <div style={{ padding: "24px", color: "#b08092", fontSize: 13 }}>
          {err}
        </div>
      ) : (
        <>
          {/* ── AI status bar ───────────────────────────────────────────── */}
          <div className={s.aiBar}>
            <span className={s.aiBarLabel}>
              {aiLoading ? (
                <span className={s.aiBarSpinner} aria-label="Generating AI insights" />
              ) : (
                <span className={s.aiBarDot} data-ok={!aiErr} aria-hidden="true" />
              )}
              {aiLoading
                ? "AI analysis running…"
                : aiErr
                ? "AI unavailable · rule-based mode"
                : ai
                ? `AI insights · ${ageLabel(ai.generatedAt)}`
                : "AI insights loading"}
            </span>
            {!aiLoading && (
              <button
                type="button"
                className={s.aiBarRefresh}
                onClick={handleRefreshAi}
                aria-label="Refresh AI insights"
              >
                ↻
              </button>
            )}
          </div>

          {/* ── Carousel ────────────────────────────────────────────────── */}
          <div className={s.carouselWrap}>
            <div className={s.carouselTrack} ref={trackRef}>
              <div className={s.carouselSlide}>
                <ReadinessCard scores={scores} ai={ai?.readiness ?? null} />
              </div>
              <div className={s.carouselSlide}>
                <FatigueCard
                  workouts={workouts}
                  movements={movements}
                  aiRecovery={ai?.recovery ?? null}
                />
              </div>
              <div className={s.carouselSlide}>
                <StimulusCard stimulus={stimulus} ai={ai?.stimulus ?? null} />
              </div>
              <div className={s.carouselSlide}>
                <PRsCard prs={prs} aiPrs={ai?.prs ?? null} />
              </div>
              <div className={s.carouselSlide}>
                <MuscleReadinessCard
                  upper={muscleReadiness.upper}
                  lower={muscleReadiness.lower}
                />
              </div>
            </div>

            {/* ── Dot pagination ──────────────────────────────────────── */}
            <div className={s.dots}>
              {CARD_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className={`${s.dot} ${activeIdx === i ? s.dotActive : ""}`}
                  onClick={() => scrollToCard(i)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Readiness card ───────────────────────────────────────────────────────────

function ReadinessCard({
  scores,
  ai,
}: {
  scores: ReadinessScores;
  ai: import("@/lib/engine/aiInsights").AiReadiness | null;
}) {
  const [recOpen, setRecOpen] = useState(false);

  // Use AI recommendation if available, fall back to rule-based
  const recAction = ai?.recommendation ?? scores.recAction;
  const recBullets = ai?.bullets ?? scores.recBullets;

  const toneClass =
    scores.recTone === "high" ? s.toneHigh
    : scores.recTone === "med" ? s.toneMed
    : scores.recTone === "pos" ? s.tonePos
    : "";

  return (
    <section className={`${s.heroCard} ${s.readinessCard}`}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardTitle}>{scores.title}</div>
        </div>
      </div>

      <div className={s.heroInner}>
        {/* 3-stat grid */}
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
              <div
                className={s.readinessBarFill}
                style={{ width: `${scores.readiness ?? 0}%` }}
              />
            </div>
            <div className={s.readinessStatCaption}>{scores.readinessCap}</div>
          </div>

          <div className={s.readinessStat}>
            <div className={s.readinessStatLabel}>Recovery</div>
            <div className={s.readinessStatNumRow}>
              <span className={s.readinessStatValue}>{scores.recovery}</span>
              <span className={s.readinessStatSuffix}>%</span>
            </div>
            <div className={s.readinessBar}>
              <div
                className={s.readinessBarFill}
                style={{ width: `${scores.recovery}%` }}
              />
            </div>
            <div className={s.readinessStatCaption}>{scores.recoveryCap}</div>
          </div>

          <div className={s.readinessStat}>
            <div className={s.readinessStatLabel}>Fatigue</div>
            <div className={s.readinessStatNumRow}>
              <span className={s.readinessStatValue}>{scores.fatigue}</span>
              <span className={s.readinessStatSuffix}>%</span>
            </div>
            <div className={s.readinessBar}>
              <div
                className={s.readinessBarFill}
                style={{ width: `${scores.fatigue}%` }}
              />
            </div>
            <div className={s.readinessStatCaption}>{scores.fatigueCap}</div>
          </div>
        </div>

        {/* AI summary — shown above the recommendation when AI is available */}
        {ai?.summary && (
          <div className={s.aiSummary}>{ai.summary}</div>
        )}

        {/* Training recommendation — collapsible */}
        <div className={`${s.rdRecommendation} ${recOpen ? "" : s.rdRecCollapsed}`}>
          <button
            type="button"
            className={`${s.rdRecHead} ${recOpen ? s.rdRecOpen : ""}`}
            onClick={() => setRecOpen((o) => !o)}
            aria-expanded={recOpen}
          >
            <span className={s.rdRecTri} aria-hidden="true">▶</span>
            <span className={s.rdRecLabel}>{ai ? "AI:" : "Recommendation:"}</span>
            <span className={`${s.rdRecAction} ${toneClass}`}>{recAction}</span>
          </button>
          <div className={s.rdRecBody}>
            <ul className={s.rdRecBullets}>
              {recBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Fatigue / Recovery Map card ──────────────────────────────────────────────

function FatigueCard({
  workouts,
  movements,
  aiRecovery,
}: {
  workouts: Workout[];
  movements: Movement[];
  aiRecovery: AiRecovery | null;
}) {
  const [tab, setTab] = useState<"upper" | "lower">("upper");
  const rows = computeMuscleFatigue(workouts, movements, tab);
  const sectionLabel = tab === "upper" ? "Upper body" : "Lower · Cardio";

  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>Body fatigue</div>
          <div className={s.heroCardTitle}>Recovery map</div>
        </div>
      </div>

      <div className={s.heroInner}>
        {/* Toggle pill — mirrors .fatigue-toggle-pill */}
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
            Lower · Cardio
          </button>
        </div>

        {/* Glass column — mirrors .fatigue-col */}
        <div className={s.fatigueCol}>
          {/* Section header — mirrors .fatigue-col-label */}
          <div className={s.fatigueColHeader}>
            <span>{sectionLabel}</span>
            <span className={s.fatigueColRightLabel}>% Fatigued</span>
          </div>
          {/* 2-column grid — mirrors .fatigue-col-body */}
          <div className={s.fatigueColBody}>
            {rows.map((row) => (
              <FatigueRow
                key={row.key}
                row={row}
                aiAdvice={aiRecovery?.[row.key] ?? null}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FatigueRow({
  row,
  aiAdvice,
}: {
  row: MuscleFatigueRow;
  aiAdvice: import("@/lib/engine/aiInsights").AiRecoveryEntry | null;
}) {
  const daysLabel =
    row.daysAgo == null ? "—"
    : row.daysAgo === 0 ? "today"
    : `${row.daysAgo}d ago`;

  const valLabel = row.pct > 0 ? `${row.pct}%` : daysLabel;

  return (
    <div className={s.fatigueRow}>
      <span className={s.fatigueRowName}>
        <span className={s.fatigueChev} aria-hidden="true">▶</span>
        {row.label}
      </span>
      <div className={s.fatigueBarWrap}>
        <div
          className={`${s.fatigueBarFill} ${s[row.tier]}`}
          style={{ width: `${row.pct}%` }}
        />
      </div>
      <span className={s.fatigueRowVal}>{valLabel}</span>
      {aiAdvice && (
        <span className={`${s.fatigueAiAdvice} ${s[`aiTone${aiAdvice.tone.charAt(0).toUpperCase() + aiAdvice.tone.slice(1)}`]}`}>
          {aiAdvice.advice}
        </span>
      )}
    </div>
  );
}

// ─── Muscle Stimulus card ─────────────────────────────────────────────────────

function StimulusCard({
  stimulus,
  ai,
}: {
  stimulus: { bars: StimulusBar[]; totalSets: number; tier: string; tierTone: string };
  ai: import("@/lib/engine/aiInsights").AiStimulus | null;
}) {
  const tierClass =
    stimulus.tierTone === "pos" ? s.tonePos
    : stimulus.tierTone === "med" ? s.toneMed
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
            Log working sets this week to see your stimulus distribution.
          </div>
        ) : (
          <div className={s.stimulusBars}>
            {stimulus.bars.map((bar) => (
              <div key={bar.key} className={s.stimulusBarRow}>
                <span className={s.stimulusBarName}>{bar.label}</span>
                <div className={s.stimulusBarTrack}>
                  <div
                    className={s.stimulusBarFill}
                    style={{ width: `${bar.pct}%` }}
                  />
                </div>
                <span className={s.stimulusSets}>{bar.sets}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI analysis block */}
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

// ─── PRs card ─────────────────────────────────────────────────────────────────

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
              const aiPr = aiPrs?.find(
                (p) => p.movement.toLowerCase() === badge.label.toLowerCase()
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

// ─── Muscle Readiness card ────────────────────────────────────────────────────

function MuscleReadinessCard({
  upper,
  lower,
}: {
  upper: MuscleReadinessRow[];
  lower: MuscleReadinessRow[];
}) {
  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>Recovery status</div>
          <div className={s.heroCardTitle}>Muscle Readiness</div>
        </div>
      </div>

      <div className={s.heroInner}>
        {/* Upper body */}
        <p className={s.mrSectionLabel}>Upper</p>
        <div className={s.mrGrid}>
          {upper.map((row) => (
            <MrTile key={row.key} row={row} />
          ))}
        </div>

        {/* Divider */}
        <div className={s.mrDivider} />

        {/* Lower body */}
        <p className={s.mrSectionLabel}>Lower</p>
        <div className={s.mrGrid}>
          {lower.map((row) => (
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
        <span className={`${s.mrPill} ${s[row.status]}`}>
          {row.statusLabel}
        </span>
        <span className={s.mrTileStat}>{row.daysStat}</span>
      </div>
    </div>
  );
}
