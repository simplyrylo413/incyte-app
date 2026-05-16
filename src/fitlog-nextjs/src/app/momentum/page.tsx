"use client";

// Momentum / Insights — horizontal snap-scroll carousel.
// Visual parity: src/mobile351.html .insights-carousel-wrap (lines 9041–9193).
// 4 cards: Readiness · Recovery Map · Muscle Stimulus · PRs
// Cards are always expanded in carousel mode (no collapse toggle).

import { useCallback, useEffect, useRef, useState } from "react";
import { listWorkouts, listMovements } from "@/lib/db";
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
import s from "./MomentumPage.module.css";

const CARD_LABELS = ["Readiness", "Recovery", "Stimulus", "PRs"];

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [mv, wk] = await Promise.all([
        listMovements(),
        listWorkouts({ finished: true }),
      ]);
      setMovements(mv);
      setWorkouts(wk);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const scores   = computeReadiness(workouts, movements);
  const stimulus = computeWeeklyStimulus(workouts, movements);
  const prs      = computePRs(workouts, movements);

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
          {/* ── Carousel ────────────────────────────────────────────────── */}
          <div className={s.carouselWrap}>
            <div className={s.carouselTrack} ref={trackRef}>
              <div className={s.carouselSlide}>
                <ReadinessCard scores={scores} />
              </div>
              <div className={s.carouselSlide}>
                <FatigueCard workouts={workouts} movements={movements} />
              </div>
              <div className={s.carouselSlide}>
                <StimulusCard stimulus={stimulus} />
              </div>
              <div className={s.carouselSlide}>
                <PRsCard prs={prs} />
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

function ReadinessCard({ scores }: { scores: ReadinessScores }) {
  const [recOpen, setRecOpen] = useState(false);

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

        {/* Training recommendation — collapsible */}
        <div className={`${s.rdRecommendation} ${recOpen ? "" : s.rdRecCollapsed}`}>
          <button
            type="button"
            className={`${s.rdRecHead} ${recOpen ? s.rdRecOpen : ""}`}
            onClick={() => setRecOpen((o) => !o)}
            aria-expanded={recOpen}
          >
            <span className={s.rdRecTri} aria-hidden="true">▶</span>
            <span className={s.rdRecLabel}>Recommendation:</span>
            <span className={`${s.rdRecAction} ${toneClass}`}>{scores.recAction}</span>
          </button>
          <div className={s.rdRecBody}>
            <ul className={s.rdRecBullets}>
              {scores.recBullets.map((b, i) => (
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
}: {
  workouts: Workout[];
  movements: Movement[];
}) {
  const [tab, setTab] = useState<"upper" | "lower">("upper");
  const rows = computeMuscleFatigue(workouts, movements, tab);

  return (
    <section className={s.heroCard}>
      <div className={s.heroCardHead}>
        <div>
          <div className={s.heroCardEyebrow}>Body fatigue</div>
          <div className={s.heroCardTitle}>Recovery map</div>
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

        <div className={s.fatigueRows}>
          {rows.map((row) => (
            <FatigueRow key={row.key} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FatigueRow({ row }: { row: MuscleFatigueRow }) {
  const daysLabel =
    row.daysAgo == null ? "—"
    : row.daysAgo === 0 ? "today"
    : `${row.daysAgo}d ago`;

  return (
    <div className={s.fatigueRow}>
      <span className={s.fatigueRowName}>{row.label}</span>
      <div className={s.fatigueBarWrap}>
        <div
          className={`${s.fatigueBarFill} ${s[row.tier]}`}
          style={{ width: `${row.pct}%` }}
        />
      </div>
      <span className={s.fatiguePct}>
        {row.pct > 0 ? `${row.pct}%` : daysLabel}
      </span>
    </div>
  );
}

// ─── Muscle Stimulus card ─────────────────────────────────────────────────────

function StimulusCard({
  stimulus,
}: {
  stimulus: { bars: StimulusBar[]; totalSets: number; tier: string; tierTone: string };
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
      </div>
    </section>
  );
}

// ─── PRs card ─────────────────────────────────────────────────────────────────

function PRsCard({ prs }: { prs: PRBadge[] }) {
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
            {prs.map((badge, i) => (
              <div key={i} className={s.prBadge}>
                <span className={s.prGlyph}>{badge.glyph}</span>
                <span className={s.prLabel}>{badge.label}</span>
                <span className={s.prValue}>{badge.value}</span>
                <span className={s.prSub}>{badge.sub}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
