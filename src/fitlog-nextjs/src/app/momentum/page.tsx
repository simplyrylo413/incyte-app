"use client";

// Phase 5 Momentum / Insights screen.
// Visual parity target: src/fitlog-mobile.html #view-insights (mobile351 baseline).
// Cards: Readiness · Recovery Map · Muscle Stimulus · PRs — all collapsible.

import { useCallback, useEffect, useState } from "react";
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

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

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

  const scores = computeReadiness(workouts, movements);
  const stimulus = computeWeeklyStimulus(workouts, movements);
  const prs = computePRs(workouts, movements);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.subline}>Momentum</div>
        <h1 className={s.headline}>Insights</h1>
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
        <div className={s.cardList}>
          <ReadinessCard scores={scores} />
          <FatigueCard workouts={workouts} movements={movements} />
          <StimulusCard stimulus={stimulus} />
          <PRsCard prs={prs} />
        </div>
      )}
    </div>
  );
}

// ─── Readiness card ───────────────────────────────────────────────────────────

function ReadinessCard({ scores }: { scores: ReadinessScores }) {
  const [collapsed, setCollapsed] = useState(false);
  const [recOpen, setRecOpen] = useState(false);

  const toneClass =
    scores.recTone === "high" ? s.toneHigh
    : scores.recTone === "med" ? s.toneMed
    : scores.recTone === "pos" ? s.tonePos
    : "";

  return (
    <section className={`${s.heroCard} ${s.readinessCard} ${collapsed ? s.heroCardCollapsed : ""}`}>
      <button
        className={s.heroCardHead}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        type="button"
      >
        <div>
          <div className={s.heroCardTitle}>{scores.title}</div>
        </div>
        <span className={s.heroCardChev} aria-hidden="true">▼</span>
      </button>

      <div className={s.heroCardBody}>
        <div className={s.heroInner}>
          {/* 3-stat grid */}
          <div className={s.readinessGrid}>
            {/* Readiness */}
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
              <div className={s.readinessStatCaption}>
                {scores.readinessCap}
              </div>
            </div>

            {/* Recovery */}
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
              <div className={s.readinessStatCaption}>
                {scores.recoveryCap}
              </div>
            </div>

            {/* Fatigue */}
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
              <div className={s.readinessStatCaption}>
                {scores.fatigueCap}
              </div>
            </div>
          </div>

          {/* Training recommendation — collapsible */}
          <div
            className={`${s.rdRecommendation} ${recOpen ? "" : s.rdRecCollapsed}`}
          >
            <button
              type="button"
              className={`${s.rdRecHead} ${recOpen ? s.rdRecOpen : ""}`}
              onClick={() => setRecOpen((o) => !o)}
              aria-expanded={recOpen}
            >
              <span className={s.rdRecTri} aria-hidden="true">▶</span>
              <span className={s.rdRecLabel}>Recommendation:</span>
              <span className={`${s.rdRecAction} ${toneClass}`}>
                {scores.recAction}
              </span>
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
  const [collapsed, setCollapsed] = useState(true);
  const [tab, setTab] = useState<"upper" | "lower">("upper");

  const rows = computeMuscleFatigue(workouts, movements, tab);

  return (
    <section className={`${s.heroCard} ${collapsed ? s.heroCardCollapsed : ""}`}>
      <button
        className={s.heroCardHead}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        type="button"
      >
        <div>
          <div className={s.heroCardEyebrow}>Body fatigue</div>
          <div className={s.heroCardTitle}>Recovery map</div>
        </div>
        <span className={s.heroCardChev} aria-hidden="true">▼</span>
      </button>

      <div className={s.heroCardBody}>
        <div className={s.heroInner}>
          {/* Upper / Lower toggle pill */}
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
  const [collapsed, setCollapsed] = useState(true);

  const tierClass =
    stimulus.tierTone === "pos" ? s.tonePos
    : stimulus.tierTone === "med" ? s.toneMed
    : stimulus.tierTone === "high" ? s.toneHigh
    : "";

  return (
    <section className={`${s.heroCard} ${collapsed ? s.heroCardCollapsed : ""}`}>
      <button
        className={s.heroCardHead}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        type="button"
      >
        <div>
          <div className={s.heroCardEyebrow}>Hypertrophy share</div>
          <div className={s.heroCardTitle}>Muscle Stimulus</div>
        </div>
        <span className={s.heroCardChev} aria-hidden="true">▼</span>
      </button>

      <div className={s.heroCardBody}>
        <div className={s.heroInner}>
          <div className={s.stimulusHero}>
            <div>
              <span className={s.stimulusNum}>{stimulus.totalSets}</span>
              <span className={s.stimulusSuffix}>sets</span>
            </div>
            <div className={s.stimulusLabel}>Weekly sets</div>
            <div className={`${s.stimulusTier} ${tierClass}`}>
              {stimulus.tier}
            </div>
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
      </div>
    </section>
  );
}

// ─── PRs card ─────────────────────────────────────────────────────────────────

function PRsCard({ prs }: { prs: PRBadge[] }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={`${s.heroCard} ${collapsed ? s.heroCardCollapsed : ""}`}>
      <button
        className={s.heroCardHead}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        type="button"
      >
        <div>
          <div className={s.heroCardEyebrow}>Achievements</div>
          <div className={s.heroCardTitle}>Recent PRs</div>
        </div>
        <span className={s.heroCardChev} aria-hidden="true">▼</span>
      </button>

      <div className={s.heroCardBody}>
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
      </div>
    </section>
  );
}
