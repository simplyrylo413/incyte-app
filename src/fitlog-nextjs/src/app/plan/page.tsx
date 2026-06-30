"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { listMovements, listPlans, listWorkouts, upsertPlan, deletePlan } from "@/lib/db";
import MovementPickerSheet from "@/components/MovementPickerSheet/MovementPickerSheet";
import type { Movement, PlanItem, Workout } from "@/lib/types";
import {
  buildDowStats, calcEtaMins, fmtEta, planItemSets,
  DOW_NAMES, DOW_LETTERS, type DowStats,
} from "@/lib/engine/plan";
import { getCassetteTheme, type CassetteTheme } from "@/lib/cassetteTheme";
import CassetteNav from "@/components/cassette/CassetteNav";
import ProfileModal from "@/components/cassette/ProfileModal";
import type { TimerType } from "@/components/cassette/TimerModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddSheet  = { dow: number } | null;
type EditSheet = { plan: PlanItem; mv: Movement } | null;

type ProgBadge =
  | { kind: "pr"; weight: number }
  | { kind: "up"; lbs: number }
  | null;

type WinItem = {
  mid: string;
  name: string;
  kind: "pr" | "up";
  detail: string;
  badge: string;
};

// ─── Per-movement history ─────────────────────────────────────────────────────

type MvHistory = { sessions: Array<{ topWeight: number; date: Date }> };

function buildMvHistory(workouts: Workout[]): Map<string, MvHistory> {
  const map = new Map<string, MvHistory>();
  for (const w of workouts) {
    if (!w.finished) continue;
    const wDate = new Date(w.date || w.savedAt || 0);
    for (const e of w.entries) {
      if (!e.movementId) continue;
      const done    = (e.sets ?? []).filter((s) => s.done && !s.warmup);
      const weights = done.map((s) => Number(s.weight) || 0).filter((n) => n > 0);
      if (!weights.length) continue;
      const top = Math.max(...weights);
      if (!map.has(e.movementId)) map.set(e.movementId, { sessions: [] });
      map.get(e.movementId)!.sessions.push({ topWeight: top, date: wDate });
    }
  }
  for (const h of map.values()) h.sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  return map;
}

function deriveProgBadge(mid: string, history: Map<string, MvHistory>): ProgBadge {
  const h = history.get(mid);
  if (!h || h.sessions.length < 2) return null;
  const allTime = Math.max(...h.sessions.map((s) => s.topWeight));
  const latest  = h.sessions[0].topWeight;
  const prev    = h.sessions[1].topWeight;
  if (latest >= allTime && latest > prev) return { kind: "pr", weight: latest };
  if (latest > prev) return { kind: "up", lbs: latest - prev };
  return null;
}

function buildRecentWins(plans: PlanItem[], movements: Movement[], history: Map<string, MvHistory>): WinItem[] {
  const mvMap = new Map(movements.map((m) => [m.id, m]));
  const plannedMids = new Set(plans.map((p) => p.mid));
  const wins: WinItem[] = [];
  for (const [mid, h] of history) {
    if (!plannedMids.has(mid)) continue;
    const mv = mvMap.get(mid);
    if (!mv || h.sessions.length < 2) continue;
    const badge = deriveProgBadge(mid, history);
    if (!badge) continue;
    wins.push({
      mid, name: mv.name, kind: badge.kind,
      detail: badge.kind === "pr" ? `${badge.weight} lbs · all-time best` : `Up ${badge.lbs} lbs from last session`,
      badge: badge.kind === "pr" ? "★ PR" : `↑ +${badge.lbs} lbs`,
    });
  }
  wins.sort((a, b) => (a.kind === "pr" ? -1 : 1) - (b.kind === "pr" ? -1 : 1));
  return wins.slice(0, 3);
}

function buildMuscleBalance(plans: PlanItem[], movements: Movement[]): Array<{ label: string; count: number; pct: number }> {
  const mvMap = new Map(movements.map((m) => [m.id, m]));
  const groups: Record<string, Set<number>> = { Push: new Set(), Pull: new Set(), Legs: new Set(), Core: new Set() };
  const PUSH = new Set(["chest","shoulders","triceps","tricepts"]);
  const PULL = new Set(["back","biceps","bicepts"]);
  const LEGS = new Set(["quads","hamstrings","glutes","calves"]);
  const CORE = new Set(["core","waist"]);
  for (const p of plans) {
    const mv = mvMap.get(p.mid);
    if (!mv) continue;
    const key = (mv.muscle ?? mv.bodyPart ?? "").toLowerCase();
    if (PUSH.has(key)) groups.Push.add(p.dow);
    else if (PULL.has(key)) groups.Pull.add(p.dow);
    else if (LEGS.has(key)) groups.Legs.add(p.dow);
    else if (CORE.has(key)) groups.Core.add(p.dow);
  }
  const max = Math.max(1, ...Object.values(groups).map((s) => s.size));
  return Object.entries(groups).map(([label, days]) => ({ label, count: days.size, pct: Math.round((days.size / max) * 100) }));
}

// ─── Theme helpers ────────────────────────────────────────────────────────────

function readIsDark(): boolean {
  try {
    const s = localStorage.getItem("fitlog_theme");
    if (s === "light") return false;
    if (s === "dark") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch { return true; }
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans,     setPlans]     = useState<PlanItem[]>([]);
  const [workouts,  setWorkouts]  = useState<Workout[]>([]);
  const [selDow,    setSelDow]    = useState(() => new Date().getDay());
  const [addSheet,  setAddSheet]  = useState<AddSheet>(null);
  const [editSheet, setEditSheet] = useState<EditSheet>(null);
  const [isDark,    setIsDark]    = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState<TimerType | null>(null);
  const theme = getCassetteTheme(isDark);

  useEffect(() => { setIsDark(readIsDark()); }, []);

  const load = useCallback(async () => {
    try {
      const [mv, pl, wk] = await Promise.all([listMovements(), listPlans(), listWorkouts({ finished: true })]);
      setMovements(mv); setPlans(pl); setWorkouts(wk as Workout[]); setErr(null);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const handleAddMovement = useCallback(async (mv: Movement, dow: number) => {
    const newPlan: PlanItem = { id: crypto.randomUUID(), mid: mv.id, dow, sets: 3, reps: "", rpe: "", notes: "", order: plans.filter((p) => p.dow === dow).length };
    setPlans((prev) => [...prev, newPlan]); setAddSheet(null); await upsertPlan(newPlan);
  }, [plans]);

  const handleSavePlan = useCallback(async (updated: PlanItem) => {
    setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p)); setEditSheet(null); await upsertPlan(updated);
  }, []);

  const handleRemovePlan = useCallback(async (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id)); setEditSheet(null); await deletePlan(id);
  }, []);

  const dowStats      = useMemo(() => buildDowStats(plans, movements, workouts), [plans, movements, workouts]);
  const mvHistory     = useMemo(() => buildMvHistory(workouts), [workouts]);
  const recentWins    = useMemo(() => buildRecentWins(plans, movements, mvHistory), [plans, movements, mvHistory]);
  const muscleBalance = useMemo(() => buildMuscleBalance(plans, movements), [plans, movements]);

  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  return (
    <div style={{ minHeight: "100dvh", background: theme.appBg, paddingBottom: 100 }}>
      <style>{`@keyframes tdBlink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {/* header */}
      <div style={{ padding: "56px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 2, color: theme.listInkDim, marginBottom: 4 }}>WEEKLY</div>
          <div style={{ fontFamily: labelFont, fontSize: 22, fontWeight: 800, color: theme.listInk, letterSpacing: 0.5 }}>PLAN</div>
        </div>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, boxShadow: `0 0 8px ${theme.accent}`, display: "inline-block", animation: "tdBlink 2.4s infinite" }} />
      </div>
      <div style={{ height: 1, background: theme.listRule, margin: "0 16px 16px" }} />

      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ fontFamily: labelFont, fontSize: 10, letterSpacing: 1.4, color: theme.listInkDim, textAlign: "center", paddingTop: 40 }}>LOADING…</div>
        ) : err ? (
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: theme.danger ?? "#d9534f", textAlign: "center", paddingTop: 40 }}>{err}</div>
        ) : (
          <>
            {recentWins.length > 0 && <RecentWinsCard wins={recentWins} theme={theme} />}
            <RingWeekStrip stats={dowStats} selDow={selDow} onSelect={setSelDow} theme={theme} />
            <MuscleBalanceCard rows={muscleBalance} theme={theme} />
            <DayView
              dow={selDow} stats={dowStats[selDow]} plans={plans} movements={movements} mvHistory={mvHistory}
              onAdd={() => setAddSheet({ dow: selDow })}
              onEdit={(plan, mv) => setEditSheet({ plan, mv })}
              theme={theme}
            />
          </>
        )}
      </div>

      {addSheet && (
        <MovementPickerSheet
          title="Add to plan"
          movements={movements}
          onAddToPlan={(mv, dow) => handleAddMovement(mv, dow)}
          defaultDow={addSheet.dow}
          onClose={() => setAddSheet(null)}
          onFavoriteToggled={(id, next) => setMovements((prev) => prev.map((m) => m.id === id ? { ...m, favorite: next } : m))}
        />
      )}

      {editSheet && (
        <EditPlanSheet
          plan={editSheet.plan} mv={editSheet.mv}
          onSave={handleSavePlan} onRemove={handleRemovePlan} onClose={() => setEditSheet(null)}
          theme={theme}
        />
      )}

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

// ─── Recent wins ──────────────────────────────────────────────────────────────

function RecentWinsCard({ wins, theme }: { wins: WinItem[]; theme: CassetteTheme }) {
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";
  return (
    <div style={{ background: theme.isLight ? "linear-gradient(180deg, #e8e3d6, #d8d3c2)" : "linear-gradient(180deg, #242629, #1c1e22)", border: `1px solid ${theme.listRule}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 800, letterSpacing: 2, color: theme.accent, marginBottom: 12 }}>RECENT PERFORMANCE</div>
      {wins.map((w) => (
        <div key={w.mid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${theme.listRule}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: labelFont, fontSize: 10, fontWeight: 700, color: theme.listInk }}>{w.name}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.listInkDim, marginTop: 2 }}>{w.detail}</div>
          </div>
          <span style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: w.kind === "pr" ? theme.accent : theme.listInk, background: w.kind === "pr" ? (theme.isLight ? "rgba(44,95,168,0.1)" : "rgba(246,232,74,0.12)") : "transparent", padding: "3px 7px", borderRadius: 4, border: `1px solid ${w.kind === "pr" ? theme.accent : theme.listRule}` }}>{w.badge}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Ring week strip ──────────────────────────────────────────────────────────

function RingWeekStrip({ stats, selDow, onSelect, theme }: { stats: DowStats[]; selDow: number; onSelect: (d: number) => void; theme: CassetteTheme }) {
  const labelFont = "JetBrains Mono, monospace";
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {stats.map((st) => {
        const active = selDow === st.dow;
        const frac = st.mvCount > 0 ? st.doneCount / st.mvCount : 0;
        const circ = 100.53;
        const offset = circ * (1 - frac);
        return (
          <button key={st.dow} type="button" onClick={() => onSelect(st.dow)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", background: active ? (theme.isLight ? "rgba(44,95,168,0.12)" : "rgba(246,232,74,0.08)") : (theme.isLight ? "linear-gradient(180deg, #e8e3d6, #d8d3c2)" : "linear-gradient(180deg, #2a2a2e, #1e1e22)"), border: active ? `1.5px solid ${theme.accent}` : `1px solid ${theme.listRule}`, borderRadius: 8, cursor: "pointer" }}>
            <div style={{ position: "relative", width: 32, height: 32 }}>
              <svg viewBox="0 0 40 40" fill="none" width="32" height="32">
                {st.isRest
                  ? <circle cx="20" cy="20" r="16" stroke={theme.listInkDim} strokeOpacity="0.3" strokeWidth="2" strokeDasharray="5 4" />
                  : <circle cx="20" cy="20" r="16" stroke={theme.listInkDim} strokeOpacity="0.2" strokeWidth="2.5" />
                }
                {!st.isRest && frac > 0 && (
                  <circle cx="20" cy="20" r="16" stroke={theme.accent} strokeWidth="2.5"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
                )}
              </svg>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: active ? theme.accent : theme.listInk }}>{st.allDone ? "✓" : DOW_LETTERS[st.dow]}</span>
            </div>
            <span style={{ fontFamily: labelFont, fontSize: 7, letterSpacing: 0.8, color: active ? theme.accent : theme.listInkDim }}>{st.isRest ? "—" : st.allDone ? "done" : `${st.mvCount}`}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Muscle balance ───────────────────────────────────────────────────────────

function MuscleBalanceCard({ rows, theme }: { rows: Array<{ label: string; count: number; pct: number }>; theme: CassetteTheme }) {
  const allZero = rows.every((r) => r.count === 0);
  if (allZero) return null;
  const max = Math.max(...rows.map((r) => r.count));
  const labelFont = "JetBrains Mono, monospace";
  return (
    <div style={{ background: theme.isLight ? "linear-gradient(180deg, #e8e3d6, #d8d3c2)" : "linear-gradient(180deg, #242629, #1c1e22)", border: `1px solid ${theme.listRule}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 800, letterSpacing: 2, color: theme.listInkDim, marginBottom: 12 }}>MUSCLE BALANCE — THIS WEEK</div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 700, color: theme.listInkDim, width: 36, letterSpacing: 0.5 }}>{r.label.toUpperCase()}</span>
          <div style={{ flex: 1, height: 4, background: theme.isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${r.pct}%`, background: r.count > 0 && r.count < max / 2 ? (theme.danger ?? "#d9534f") : theme.accent, borderRadius: 2 }} />
          </div>
          <span style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 700, color: r.count > 0 && r.count < max / 2 ? (theme.danger ?? "#d9534f") : theme.listInk, width: 20, textAlign: "right" }}>{r.count > 0 ? `${r.count}×` : "—"}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function DayView({ dow, stats, plans, movements, mvHistory, onAdd, onEdit, theme }: {
  dow: number; stats: DowStats; plans: PlanItem[]; movements: Movement[];
  mvHistory: Map<string, MvHistory>; onAdd: () => void;
  onEdit: (plan: PlanItem, mv: Movement) => void; theme: CassetteTheme;
}) {
  const mvMap = useMemo(() => new Map<string, Movement>(movements.map((m) => [m.id, m])), [movements]);
  const dayPlans = useMemo(() => plans.filter((p) => p.dow === dow && mvMap.has(p.mid)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [plans, dow, mvMap]);
  const totalSets = dayPlans.reduce((a, p) => a + planItemSets(p), 0);
  const eta = fmtEta(calcEtaMins(totalSets, dayPlans.length));
  const todayDow = new Date().getDay();
  const diff = (dow - todayDow + 7) % 7;
  const d = new Date(); d.setDate(d.getDate() + diff);
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  return (
    <div style={{ background: theme.isLight ? "linear-gradient(180deg, #e8e3d6, #d8d3c2)" : "linear-gradient(180deg, #242629, #1c1e22)", border: `1px solid ${theme.listRule}`, borderRadius: 10, overflow: "hidden" }}>
      {/* day header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.listRule}` }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: labelFont, fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: theme.listInk }}>{DOW_NAMES[dow].toUpperCase()}</span>
            {stats.isToday && <span style={{ fontFamily: labelFont, fontSize: 7, fontWeight: 800, letterSpacing: 1.5, color: theme.isLight ? "#fff" : "#1a1810", background: theme.accent, padding: "2px 6px", borderRadius: 3 }}>TODAY</span>}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.listInkDim }}>
            {stats.isRest ? "Rest day" : `${dateLabel} · ${dayPlans.length} movement${dayPlans.length !== 1 ? "s" : ""}${eta ? ` · ${eta}` : ""}`}
          </div>
        </div>
        <button type="button" onClick={onAdd}
          style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: theme.accent, background: "transparent", border: `1px solid ${theme.accent}`, borderRadius: 5, padding: "6px 12px", cursor: "pointer" }}>
          + ADD
        </button>
      </div>

      {/* movement list */}
      <div>
        {dayPlans.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: labelFont, fontSize: 9, letterSpacing: 1.4, color: theme.listInkDim, marginBottom: 6 }}>{stats.isRest ? "REST DAY" : "NOTHING PLANNED YET"}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.listInkDim }}>{stats.isRest ? "Tap + Add to turn this into a training day." : "Tap + Add to build this session."}</div>
          </div>
        ) : (
          dayPlans.map((plan) => {
            const mv    = mvMap.get(plan.mid)!;
            const badge = deriveProgBadge(plan.mid, mvHistory);
            return <PlanMvRow key={plan.id} plan={plan} mv={mv} badge={badge} onEdit={() => onEdit(plan, mv)} theme={theme} />;
          })
        )}
      </div>
    </div>
  );
}

// ─── Plan movement row ────────────────────────────────────────────────────────

function PlanMvRow({ plan, mv, badge, onEdit, theme }: { plan: PlanItem; mv: Movement; badge: ProgBadge; onEdit: () => void; theme: CassetteTheme }) {
  const sets  = planItemSets(plan);
  const reps  = plan.reps ? `${plan.reps} reps` : "";
  const equip = mv.equipmentType ?? "";
  const meta  = [`${sets} sets`, reps, equip].filter(Boolean).join(" · ");
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  return (
    <button type="button" onClick={onEdit} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "transparent", border: "none", borderBottom: `1px solid ${theme.listRule}`, cursor: "pointer" }}>
      {/* accent stripe */}
      <span style={{ width: 3, height: 32, borderRadius: 2, background: badge ? theme.accent : theme.listRule, flexShrink: 0 }} />
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontFamily: labelFont, fontSize: 11, fontWeight: 700, color: theme.listInk, marginBottom: 2 }}>{mv.name}</div>
        <div style={{ fontFamily: bodyFont, fontSize: 10, color: theme.listInkDim }}>{meta}</div>
      </div>
      {badge?.kind === "pr" && <span style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 800, color: theme.accent, border: `1px solid ${theme.accent}`, padding: "2px 6px", borderRadius: 3 }}>★ PR</span>}
      {badge?.kind === "up" && <span style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 800, color: theme.listInk, border: `1px solid ${theme.listRule}`, padding: "2px 6px", borderRadius: 3 }}>↑ +{badge.lbs}</span>}
      <span style={{ fontFamily: labelFont, fontSize: 16, color: theme.listInkDim }}>›</span>
    </button>
  );
}

// ─── Edit plan sheet ──────────────────────────────────────────────────────────

function EditPlanSheet({ plan, mv, onSave, onRemove, onClose, theme }: {
  plan: PlanItem; mv: Movement; onSave: (u: PlanItem) => void;
  onRemove: (id: string) => void; onClose: () => void; theme: CassetteTheme;
}) {
  const [sets,          setSets]          = useState(String(planItemSets(plan)));
  const [reps,          setReps]          = useState(plan.reps ?? "");
  const [note,          setNote]          = useState(plan.notes ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont  = "Helvetica Neue, system-ui, sans-serif";

  const inputStyle: CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 6, outline: "none",
    fontFamily: labelFont, fontSize: 11, fontWeight: 700, color: theme.listInk,
    background: theme.isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${theme.listRule}`,
    boxSizing: "border-box",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: theme.isLight ? "linear-gradient(180deg, #e2ddcc, #cdc7b4)" : "linear-gradient(180deg, #242629, #16181c)", borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: "0 -10px 30px rgba(0,0,0,0.5)", padding: "16px 16px 32px" }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: theme.listRule, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontFamily: labelFont, fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: theme.listInk }}>{mv.name}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: theme.listInk, fontSize: 20, cursor: "pointer", fontWeight: 800 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {[
            { label: "SETS",  type: "number", value: sets,  set: setSets,  placeholder: "" },
            { label: "REPS",  type: "text",   value: reps,  set: setReps,  placeholder: "e.g. 8–10" },
            { label: "NOTE",  type: "text",   value: note,  set: setNote,  placeholder: "Optional cue…" },
          ].map(({ label, type, value, set, placeholder }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: labelFont, fontSize: 8, fontWeight: 800, letterSpacing: 1.5, color: theme.listInkDim, width: 36 }}>{label}</span>
              <input type={type} value={value} placeholder={placeholder}
                onChange={(e) => set(e.target.value)}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => onSave({ ...plan, sets: Number(sets) > 0 ? Number(sets) : 3, reps, notes: note })}
            style={{ flex: 1.4, padding: "14px 0", borderRadius: 7, cursor: "pointer", background: theme.accent, border: "none", fontFamily: labelFont, fontSize: 10, letterSpacing: 1.6, fontWeight: 800, color: theme.isLight ? "#fff" : "#1a1810" }}>
            SAVE
          </button>
          {confirmRemove
            ? <button type="button" onClick={() => onRemove(plan.id)}
                style={{ flex: 1, padding: "14px 0", borderRadius: 7, cursor: "pointer", background: theme.danger ?? "#d9534f", border: "none", fontFamily: labelFont, fontSize: 9, letterSpacing: 1.2, fontWeight: 800, color: "#fff" }}>CONFIRM REMOVE</button>
            : <button type="button" onClick={() => setConfirmRemove(true)}
                style={{ flex: 1, padding: "14px 0", borderRadius: 7, cursor: "pointer", background: "transparent", border: `1px solid ${theme.listRule}`, fontFamily: labelFont, fontSize: 10, letterSpacing: 1.4, fontWeight: 700, color: theme.listInkDim }}>REMOVE</button>
          }
        </div>
      </div>
    </div>
  );
}
