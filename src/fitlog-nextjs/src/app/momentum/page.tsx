"use client";

// Insights page — cassette-deck hardware aesthetic.
// Data layer (engine logic, AI) unchanged; render replaced with cassette theme.

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { listWorkouts, listMovements } from "@/lib/db";
import type { Workout, Movement } from "@/lib/types";
import {
  computeReadiness,
  computeWeeklyStimulus,
  computePRs,
  computeMuscleReadiness,
  type ReadinessScores,
  type StimulusBar,
  type PRBadge,
} from "@/lib/engine/momentum";
import {
  computeInsightResult,
  type InsightResult,
} from "@/lib/engine/insightEngine";
import {
  enhanceInsightsWithAi,
  invalidateAiTimelineCache,
  aiTimelineAgeLabel,
} from "@/lib/engine/aiTimelineInsights";
import {
  fetchAiInsights,
  invalidateAiCache,
  type AiInsights,
} from "@/lib/engine/aiInsights";
import { getCassetteTheme, type CassetteTheme } from "@/lib/cassetteTheme";
import CassetteNav from "@/components/cassette/CassetteNav";
import ProfileModal from "@/components/cassette/ProfileModal";
import type { TimerType } from "@/components/cassette/TimerModal";

function readIsDark(): boolean {
  try {
    const v = localStorage.getItem("fitlog_theme");
    if (v === "light") return false;
    if (v === "dark") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch { return true; }
}

const CAROUSEL_LABELS = ["Insights", "PRs"];

// ─── Root page ────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [finishedWorkouts, setFinishedWorkouts] = useState<Workout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [insightResult, setInsightResult] = useState<InsightResult | null>(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [aiTimelineLoading, setAiTimelineLoading] = useState(false);
  const [aiTimelineErr, setAiTimelineErr] = useState<string | null>(null);
  const [aiTimelineAge, setAiTimelineAge] = useState<number | null>(null);
  const [carouselAi, setCarouselAi] = useState<AiInsights | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState<TimerType | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const theme = getCassetteTheme(isDark);

  useEffect(() => { setIsDark(readIsDark()); }, []);

  const loadAiTimeline = useCallback(async (result: InsightResult, force = false) => {
    setAiTimelineLoading(true); setAiTimelineErr(null);
    try {
      const enhanced = await enhanceInsightsWithAi(result, { forceRefresh: force });
      setInsightResult(enhanced); setAiEnhanced(true); setAiTimelineAge(Date.now());
    } catch { setAiTimelineErr("AI enhancement unavailable"); }
    finally { setAiTimelineLoading(false); }
  }, []);

  const loadCarouselAi = useCallback(async (wk: Workout[], mv: Movement[], force = false) => {
    try {
      const insights = await fetchAiInsights(wk, mv, { forceRefresh: force });
      setCarouselAi(insights);
    } catch { /* best-effort */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [mv, finished, activeArr] = await Promise.all([
        listMovements(),
        listWorkouts({ finished: true }),
        listWorkouts({ finished: false, limit: 1 }),
      ]);
      const active = activeArr[0] ?? null;
      setMovements(mv); setFinishedWorkouts(finished); setActiveWorkout(active);
      const result = computeInsightResult(finished, mv, active);
      setInsightResult(result);
      loadAiTimeline(result);
      loadCarouselAi(finished, mv);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefreshAi() {
    if (!insightResult) return;
    invalidateAiTimelineCache(); invalidateAiCache();
    setAiEnhanced(false);
    loadAiTimeline(insightResult, true);
    loadCarouselAi(finishedWorkouts, movements, true);
  }

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const track = carouselRef.current;
    if (!track) return;
    const onScroll = () => setCarouselIdx(Math.round(track.scrollLeft / track.clientWidth));
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToCard(idx: number) {
    carouselRef.current?.scrollTo({ left: idx * (carouselRef.current?.clientWidth ?? 0), behavior: "smooth" });
  }

  const scores = computeReadiness(finishedWorkouts, movements);
  const stimulus = computeWeeklyStimulus(finishedWorkouts, movements);
  const prs = computePRs(finishedWorkouts, movements);

  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  return (
    <div style={{ minHeight: "100dvh", background: theme.appBg, paddingBottom: 100 }}>
      <style>{`@keyframes tdBlink{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes tdSpin{to{transform:rotate(360deg)}}`}</style>

      {/* header */}
      <div style={{ padding: "56px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 2, color: theme.listInkDim, marginBottom: 4 }}>TRAINING INTELLIGENCE</div>
          <div style={{ fontFamily: labelFont, fontSize: 22, fontWeight: 800, color: theme.listInk, letterSpacing: 0.5 }}>INSIGHTS</div>
        </div>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, boxShadow: `0 0 8px ${theme.accent}`, display: "inline-block", animation: "tdBlink 2.4s infinite" }} />
      </div>
      <div style={{ height: 1, background: theme.listRule, margin: "0 16px 16px" }} />

      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ fontFamily: labelFont, fontSize: 10, letterSpacing: 1.4, color: theme.listInkDim, textAlign: "center", paddingTop: 40 }}>LOADING…</div>
        ) : err ? (
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: theme.danger ?? "#d9534f", textAlign: "center", paddingTop: 40 }}>{err}</div>
        ) : insightResult ? (
          <>
            {/* warnings */}
            {insightResult.warnings.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {insightResult.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: theme.isLight ? "rgba(217,83,79,0.08)" : "rgba(255,80,80,0.08)", border: `1px solid ${theme.danger ?? "#d9534f"}33`, borderRadius: 7, marginBottom: 6 }}>
                    <span style={{ fontFamily: labelFont, fontSize: 10, fontWeight: 800, color: theme.danger ?? "#d9534f" }}>!</span>
                    <span style={{ fontFamily: bodyFont, fontSize: 11, color: theme.listInk }}>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI status bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: theme.isLight ? "linear-gradient(180deg, #e8e3d6, #d8d3c2)" : "linear-gradient(180deg, #242629, #1c1e22)", border: `1px solid ${theme.listRule}`, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {aiTimelineLoading
                  ? <span style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${theme.accent}`, borderTopColor: "transparent", display: "inline-block", animation: "tdSpin 0.8s linear infinite" }} />
                  : <span style={{ width: 6, height: 6, borderRadius: "50%", background: aiTimelineErr ? (theme.danger ?? "#d9534f") : theme.accent, boxShadow: aiTimelineErr ? "none" : `0 0 5px ${theme.accent}` }} />
                }
                <span style={{ fontFamily: labelFont, fontSize: 8.5, letterSpacing: 1, color: theme.listInkDim }}>
                  {aiTimelineLoading
                    ? "AI ANALYSIS RUNNING…"
                    : aiTimelineErr
                    ? "AI UNAVAILABLE · RULE-BASED MODE"
                    : aiEnhanced && aiTimelineAge
                    ? `AI ENHANCED · ${aiTimelineAgeLabel(aiTimelineAge).toUpperCase()}`
                    : "RULES-BASED INSIGHTS"}
                </span>
              </div>
              {!aiTimelineLoading && (
                <button type="button" onClick={handleRefreshAi} style={{ background: "transparent", border: `1px solid ${theme.listRule}`, color: theme.accent, fontFamily: labelFont, fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 4, padding: "2px 8px", lineHeight: 1.5 }}>↻</button>
              )}
            </div>

            {/* carousel */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <div ref={carouselRef} style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", gap: 12 } as CSSProperties}>
                {/* slide 0: Insights */}
                <div style={{ flex: "0 0 100%", scrollSnapAlign: "start" }}>
                  <InsightsSlide insightResult={insightResult} scores={scores} stimulus={stimulus} carouselAi={carouselAi} theme={theme} />
                </div>
                {/* slide 1: PRs */}
                <div style={{ flex: "0 0 100%", scrollSnapAlign: "start" }}>
                  <PRsSlide prs={prs} aiPrs={carouselAi?.prs ?? null} theme={theme} />
                </div>
              </div>
              {/* dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                {CAROUSEL_LABELS.map((label, i) => (
                  <button key={label} type="button" aria-label={label} onClick={() => scrollToCard(i)}
                    style={{ width: i === carouselIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === carouselIdx ? theme.accent : theme.listRule, border: "none", cursor: "pointer", transition: "all 0.2s", padding: 0 }} />
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {showProfile && (
        <ProfileModal
          theme={theme} isDark={isDark}
          onToggleTheme={() => { const n = !isDark; setIsDark(n); localStorage.setItem("fitlog_theme", n ? "dark" : "light"); }}
          selectedTimer={selectedTimer} onSelectTimer={setSelectedTimer}
          onClose={() => setShowProfile(false)}
        />
      )}

      <CassetteNav theme={theme} onProfile={() => setShowProfile(true)} />
    </div>
  );
}

// ─── Insights slide ───────────────────────────────────────────────────────────

function InsightsSlide({
  insightResult, scores, stimulus, carouselAi, theme,
}: {
  insightResult: InsightResult;
  scores: ReadinessScores;
  stimulus: { bars: StimulusBar[]; totalSets: number; tier: string; tierTone: string };
  carouselAi: AiInsights | null;
  theme: CassetteTheme;
}) {
  const [tab, setTab] = useState<"today" | "trends" | "recovery">("today");
  const { metrics } = insightResult;
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  const cardBg: CSSProperties = {
    background: theme.isLight
      ? "linear-gradient(180deg, #e8e3d6 0%, #d8d3c2 100%)"
      : "linear-gradient(180deg, #242629 0%, #1c1e22 100%)",
    border: `1px solid ${theme.listRule}`,
    borderRadius: 12,
    overflow: "hidden",
  };

  const tabBtn = (active: boolean): CSSProperties => ({
    flex: 1, padding: "7px 0",
    fontFamily: labelFont, fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
    color: active ? (theme.isLight ? "#fff" : "#1a1810") : theme.listInkDim,
    background: active ? theme.accent : "transparent",
    border: "none", borderRadius: 4, cursor: "pointer",
  });

  const statTile = (val: number, label: string, cap?: string): React.ReactNode => (
    <div style={{ flex: 1, padding: "12px 10px", background: theme.isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${theme.listRule}` }}>
      <div style={{ fontFamily: labelFont, fontSize: 7.5, letterSpacing: 1.5, color: theme.listInkDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: 28, color: theme.accent, lineHeight: 1, marginBottom: 4 }}>{val}<span style={{ fontSize: 12 }}>%</span></div>
      <div style={{ height: 3, background: theme.isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ height: "100%", width: `${val}%`, background: theme.accent, borderRadius: 2 }} />
      </div>
      {cap && <div style={{ fontFamily: bodyFont, fontSize: 9.5, color: theme.listInkDim }}>{cap}</div>}
    </div>
  );

  const ai = carouselAi?.readiness ?? null;
  const readinessCap = ai?.readinessCap ?? scores.readinessCap;
  const recoveryCap  = ai?.recoveryCap  ?? scores.recoveryCap;
  const fatigueCap   = ai?.fatigueCap   ?? scores.fatigueCap;

  return (
    <div style={cardBg}>
      {/* card header */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.listRule}` }}>
        <div style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 2, color: theme.listInkDim, marginBottom: 2 }}>{tab === "today" ? "SESSION DATA" : tab === "trends" ? "VOLUME TREND" : "RECOVERY STATUS"}</div>
        <div style={{ fontFamily: labelFont, fontSize: 16, fontWeight: 800, color: theme.listInk }}>INSIGHTS</div>
      </div>

      {/* tab strip */}
      <div style={{ display: "flex", gap: 4, padding: "10px 12px", background: theme.isLight ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.2)" }}>
        {(["today", "trends", "recovery"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={tabBtn(tab === t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 16px", minHeight: 200 }}>
        {tab === "today" && (
          <>
            {scores.title && <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: theme.listInk, marginBottom: 12 }}>{scores.title}</div>}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {statTile(scores.readiness ?? 0, "READINESS", readinessCap)}
              {statTile(scores.recovery, "RECOVERY", recoveryCap)}
              {statTile(scores.fatigue, "FATIGUE", fatigueCap)}
            </div>
            {metrics.currentSessionSets > 0 && (
              <div style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${theme.listRule}` }}>
                {[
                  { v: metrics.currentSessionSets, l: "sets" },
                  { v: metrics.currentSessionAvgRpe?.toFixed(1) ?? "—", l: "avg rpe" },
                  { v: metrics.currentSessionHardSets, l: "hard sets" },
                ].map(({ v, l }) => (
                  <div key={l} style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: 22, color: theme.accent, lineHeight: 1 }}>{v}</div>
                    <div style={{ fontFamily: labelFont, fontSize: 7.5, letterSpacing: 1, color: theme.listInkDim, marginTop: 2 }}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "trends" && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 16 }}>
              <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: 48, color: theme.accent, lineHeight: 1 }}>{stimulus.totalSets}</span>
              <span style={{ fontFamily: labelFont, fontSize: 9, color: theme.listInkDim, letterSpacing: 1 }}>SETS THIS WEEK</span>
              {stimulus.tier && <span style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 800, color: theme.accent, border: `1px solid ${theme.accent}`, padding: "2px 6px", borderRadius: 3 }}>{stimulus.tier.toUpperCase()}</span>}
            </div>
            {stimulus.bars.length === 0 ? (
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: theme.listInkDim }}>Log working sets this week to see stimulus data.</div>
            ) : stimulus.bars.map((bar) => (
              <div key={bar.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: labelFont, fontSize: 8, color: theme.listInkDim, width: 48 }}>{bar.label.substring(0, 5).toUpperCase()}</span>
                <div style={{ flex: 1, height: 4, background: theme.isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${bar.pct}%`, background: theme.accent, borderRadius: 2 }} />
                </div>
                <span style={{ fontFamily: labelFont, fontSize: 9, color: theme.listInk, width: 16, textAlign: "right" }}>{bar.sets}</span>
              </div>
            ))}
          </>
        )}

        {tab === "recovery" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {statTile(metrics.fatigueScore, "FATIGUE")}
              {statTile(metrics.recoveryScore, "RECOVERY")}
            </div>
            {Object.entries(metrics.repeatedExposure72h).filter(([, c]) => c >= 1).length > 0 && (
              <>
                <div style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 1.5, color: theme.listInkDim, marginBottom: 8 }}>MUSCLE EXPOSURE 72H</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(metrics.repeatedExposure72h).filter(([, c]) => c >= 1).map(([key, count]) => {
                    const label = metrics.bodyPartLoads7d.find((b) => b.key === key)?.label ?? key;
                    const isHigh = count >= 2;
                    return (
                      <span key={key} style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 700, padding: "4px 8px", borderRadius: 4, border: `1px solid ${isHigh ? (theme.danger ?? "#d9534f") : theme.listRule}`, color: isHigh ? (theme.danger ?? "#d9534f") : theme.listInk, background: isHigh ? (theme.isLight ? "rgba(217,83,79,0.08)" : "rgba(255,80,80,0.08)") : "transparent" }}>
                        {label} ×{count}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── PRs slide ────────────────────────────────────────────────────────────────

function PRsSlide({ prs, aiPrs, theme }: { prs: PRBadge[]; aiPrs: import("@/lib/engine/aiInsights").AiPR[] | null; theme: CassetteTheme }) {
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  const cardBg: CSSProperties = {
    background: theme.isLight
      ? "linear-gradient(180deg, #e8e3d6 0%, #d8d3c2 100%)"
      : "linear-gradient(180deg, #242629 0%, #1c1e22 100%)",
    border: `1px solid ${theme.listRule}`,
    borderRadius: 12,
    overflow: "hidden",
  };

  return (
    <div style={cardBg}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.listRule}` }}>
        <div style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 2, color: theme.listInkDim, marginBottom: 2 }}>ACHIEVEMENTS</div>
        <div style={{ fontFamily: labelFont, fontSize: 16, fontWeight: 800, color: theme.listInk }}>RECENT PRS</div>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {prs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: 36, color: theme.accent, lineHeight: 1, marginBottom: 8 }}>★</div>
            <div style={{ fontFamily: labelFont, fontSize: 10, letterSpacing: 1.2, color: theme.listInkDim }}>NO PRS YET</div>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.listInkDim, marginTop: 6 }}>Finish a session to seed your first record.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prs.map((badge, i) => {
              const aiPr = aiPrs?.find((p) => p.movement.toLowerCase() === badge.label.toLowerCase()) ?? null;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: theme.isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${theme.listRule}` }}>
                  <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: 24, color: theme.accent, lineHeight: 1, flexShrink: 0 }}>{badge.glyph}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: labelFont, fontSize: 10, fontWeight: 700, color: theme.listInk, marginBottom: 2 }}>{badge.label}</div>
                    <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: 18, color: theme.accent, marginBottom: 2 }}>{badge.value}</div>
                    <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.listInkDim }}>{badge.sub}</div>
                    {aiPr && (
                      <div style={{ marginTop: 6, padding: "6px 8px", background: theme.isLight ? "rgba(44,95,168,0.06)" : "rgba(246,232,74,0.06)", borderRadius: 5, border: `1px solid ${theme.accent}33` }}>
                        <div style={{ fontFamily: labelFont, fontSize: 8.5, fontWeight: 700, color: theme.accent }}>→ {aiPr.nextTarget}</div>
                        <div style={{ fontFamily: bodyFont, fontSize: 9.5, color: theme.listInkDim, marginTop: 2 }}>{aiPr.context}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
