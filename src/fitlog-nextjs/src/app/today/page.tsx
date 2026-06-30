"use client";

// Phase 3 Today screen — hardware cassette-deck redesign.
// Data layer (Supabase) unchanged from Phase 3 baseline; render replaced with
// the cassette-deck hardware UI from the standalone prototype (today-screen.jsx).

import { useEffect, useRef, useState, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  listMovements,
  listWorkouts,
  listFinishedTodayWorkouts,
  listPlans,
  upsertWorkout,
} from "@/lib/db";
import { tryGetDeviceId } from "@/lib/device";
import type { Movement, Workout, WorkoutEntry, PlanItem } from "@/lib/types";
import MovementPickerSheet from "@/components/MovementPickerSheet/MovementPickerSheet";
import {
  todayHeadline,
  todayDateLabel,
  filterTodaysPlan,
  filterFinishedToday,
  calcDayStats,
  buildTodayItems,
  groupByBodyPart,
  itemProgress,
  type TodayItem,
} from "@/lib/engine/today";
import { getCassetteTheme, type CassetteTheme } from "@/lib/cassetteTheme";
import TimerModal, { type TimerType } from "@/components/cassette/TimerModal";
import ProfileModal from "@/components/cassette/ProfileModal";

// ─── localStorage helpers ─────────────────────────────────────────────────────

const todayKey = () => `hiddenPlanIds_${new Date().toISOString().slice(0, 10)}`;

function getHiddenForToday(): Set<string> {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function addHiddenForToday(planId: string) {
  try {
    const ids = getHiddenForToday();
    ids.add(planId);
    localStorage.setItem(todayKey(), JSON.stringify([...ids]));
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    localStorage.removeItem(`hiddenPlanIds_${yesterday}`);
  } catch { /* ignore */ }
}

function readTheme(): "dark" | "light" {
  try {
    const s = localStorage.getItem("fitlog_theme");
    if (s === "light") return "light";
    if (s === "dark") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch { return "dark"; }
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [finishedToday, setFinishedToday] = useState<Workout[]>([]);

  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Cassette theme
  const [isDark, setIsDark] = useState(true);
  const theme = getCassetteTheme(isDark);

  // Modals
  const [showProfile, setShowProfile] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState<TimerType | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ planId: string; name: string } | null>(null);

  // Clock
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    setIsDark(readTheme() === "dark");
    const tick = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const [mv, pl, wkts, ft] = await Promise.all([
        listMovements(),
        listPlans(),
        listWorkouts({ finished: false, limit: 1 }),
        listFinishedTodayWorkouts(),
      ]);
      const todayStr = new Date().toISOString().slice(0, 10);
      const candidate = wkts[0] ?? null;
      const isFromToday = !!candidate?.date && candidate.date.slice(0, 10) === todayStr;
      setMovements(mv);
      setPlans(pl);
      setActiveWorkout(isFromToday ? candidate : null);
      setFinishedToday(filterFinishedToday(ft));
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const mvMap = new Map<string, Movement>(movements.map((m) => [m.id, m]));
  const hiddenPlanIds = getHiddenForToday();
  const todayPlan = filterTodaysPlan(plans).filter((p) => !hiddenPlanIds.has(p.id));
  const activeEntries: WorkoutEntry[] = activeWorkout?.entries ?? [];
  const sessionDoneToday = !activeWorkout && finishedToday.length > 0;

  const stats = calcDayStats(todayPlan, activeEntries, mvMap, finishedToday);
  const { remaining } = buildTodayItems({ planItems: todayPlan, activeEntries, finishedToday, mvMap, sessionDoneToday });

  const completedEntries: Array<{ entry: WorkoutEntry; workout: Workout }> = [];
  for (const wk of finishedToday) {
    for (const e of wk.entries ?? []) completedEntries.push({ entry: e, workout: wk });
  }
  const completedMids = new Set(completedEntries.map((c) => c.entry.movementId));
  const remainingFiltered = remaining.filter((item) => !completedMids.has(item.mid));
  const grouped = groupByBodyPart(remainingFiltered);
  const inProgress = !!activeWorkout && activeEntries.length > 0;

  // ── Session mutation helpers ───────────────────────────────────────────────
  function getOrBuildSession(): Workout {
    if (activeWorkout) return activeWorkout;
    const deviceId = tryGetDeviceId();
    return { id: crypto.randomUUID(), device_id: deviceId ?? undefined, date: new Date().toISOString(), finished: false, entries: [] };
  }

  const handleAddMovement = useCallback(async (mv: Movement) => {
    const session = getOrBuildSession();
    const planId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEntry: WorkoutEntry = {
      movementId: mv.id,
      planId,
      name: mv.name,
      muscle: mv.muscle ?? mv.bodyPart ?? "",
      equipmentType: mv.equipmentType ?? "unspecified",
      canonicalMovement: mv.canonicalMovement ?? mv.name,
      sets: Array.from({ length: mv.defaultSets ?? 3 }, () => ({ done: false })),
    };
    const updated: Workout = { ...session, entries: [...session.entries, newEntry] };
    setActiveWorkout(updated);
    setAddSheetOpen(false);
    await upsertWorkout(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkout]);

  const handleRemoveEntry = useCallback(async (planId: string) => {
    if (activeWorkout) {
      const hasEntry = activeWorkout.entries.some((e) => e.planId === planId);
      if (hasEntry) {
        const entries = activeWorkout.entries.filter((e) => e.planId !== planId);
        const updated = { ...activeWorkout, entries };
        setActiveWorkout(updated);
        await upsertWorkout(updated);
        return;
      }
    }
    addHiddenForToday(planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }, [activeWorkout]);

  function handleMovementTap(item: TodayItem) {
    const mv = item.mv;
    const planItem = plans.find((p) => p.id === item.planId);
    const lastSet = item.entry?.sets?.[item.entry.sets.length - 1];
    const params = new URLSearchParams();
    params.set("mid", item.mid);
    params.set("planId", item.planId);
    params.set("name", mv?.name ?? "Movement");
    if (mv?.bodyPart || mv?.muscle) params.set("bodypart", String(mv.bodyPart ?? mv.muscle));
    if (lastSet?.weight != null && lastSet.weight !== "") params.set("weight", String(lastSet.weight));
    if (lastSet?.reps != null && lastSet.reps !== "") params.set("reps", String(lastSet.reps));
    if (lastSet?.rpe != null && lastSet.rpe !== "") params.set("rpe", String(lastSet.rpe));
    const setsCount = planItem?.sets ?? item.entry?.sets?.length;
    if (setsCount) params.set("sets", String(setsCount));
    params.set("rest", "90");
    window.location.href = `/workout-alt.html?${params}`;
  }

  function handleStartWorkout() {
    if (remainingFiltered.length === 0) return;
    handleMovementTap(remainingFiltered[0]);
  }

  const activeMids = new Set(activeEntries.map((e) => e.movementId));

  // ── Style helpers ──────────────────────────────────────────────────────────
  const monoFont = '"Share Tech Mono", "VT323", monospace';
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont = "Helvetica Neue, system-ui, sans-serif";
  const panelBg = theme.isLight
    ? "linear-gradient(180deg, #d2cdbc 0%, #bdb7a4 100%)"
    : "linear-gradient(180deg, #24262a 0%, #16181c 100%)";
  const panelShadow = theme.isLight
    ? "inset 0 1.5px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.25)"
    : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.5)";

  // ── Render ────────────────────────────────────────────────────────────────

  const today = new Date();
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dayLabel = `${dayNames[today.getDay()]} · ${monthNames[today.getMonth()]} ${today.getDate()}`;

  return (
    <>
      {/* inject keyframes once */}
      <style>{`
        @keyframes tdSheet { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tdBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes tdPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      `}</style>

      <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column", background: theme.appBg, fontFamily: bodyFont, position: "relative" }}>

        {/* scroll region — leaves room for fixed nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "56px 16px 160px", WebkitOverflowScrolling: "touch" } as CSSProperties}>

          {/* status row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontFamily: labelFont, fontSize: 9, letterSpacing: 2.5, fontWeight: 800, color: theme.listInk }}>INCYTE</span>
            <span style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 1.6, color: theme.listInkDim }}>{dayLabel}{currentTime ? ` · ${currentTime}` : ""}</span>
          </div>

          {/* hero */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: bodyFont, fontSize: 38, fontWeight: 800, color: theme.listInk, letterSpacing: -1, lineHeight: 0.98, marginBottom: 10 }}>
              Today&apos;s<br />
              <span style={{ color: theme.accent }}>session.</span>
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: theme.listInkDim, lineHeight: 1.4 }}>
              {loading ? "Loading…" : err ? "Sync error — pull to retry." : remainingFiltered.length === 0 && completedEntries.length === 0 ? "Build today's session below." : inProgress ? "Session in progress." : `${remainingFiltered.length} movement${remainingFiltered.length !== 1 ? "s" : ""} planned.`}
            </div>
          </div>

          {/* LCD stat bar */}
          {!loading && !err && (remainingFiltered.length > 0 || inProgress) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[
                { label: "EXERCISES", value: String(remainingFiltered.length), dim: false },
                { label: "SETS", value: String(stats.totalSets), dim: false },
                { label: "EST", value: `${stats.planMinutes}m`, dim: false },
                { label: "COMPLETE", value: `${stats.completePct}%`, dim: stats.completePct === 0 },
              ].map(({ label, value, dim }) => (
                <div key={label} style={{ flex: 1, background: "#020203", border: "1px solid #1a1d20", borderRadius: 5, padding: "7px 8px 8px", position: "relative", overflow: "hidden", boxShadow: "inset 0 3px 8px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.12)" }}>
                  <div aria-hidden style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.3) 2px 3px)", pointerEvents: "none", mixBlendMode: "multiply" }} />
                  <div style={{ fontFamily: labelFont, fontSize: 6.5, letterSpacing: 1.4, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: monoFont, fontSize: 20, lineHeight: "20px", color: dim ? "rgba(246,232,74,0.3)" : theme.lcdInk, textShadow: dim ? "none" : theme.lcdShadow }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* progress bar when in progress */}
          {inProgress && stats.completePct > 0 && (
            <div style={{ position: "relative", height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${stats.completePct}%`, background: theme.accent, boxShadow: `0 0 8px ${theme.accentDim}` }} />
            </div>
          )}

          {/* muscle group chips + start button when movements planned */}
          {!loading && !err && remainingFiltered.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {/* body-part chips */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {grouped.map(([bp]) => (
                  <span key={bp} style={{ position: "relative", fontFamily: labelFont, fontSize: 9.5, letterSpacing: 1.2, fontWeight: 800, padding: "9px 14px", borderRadius: 7, color: "#1a1810", background: theme.accent, boxShadow: "0 0 10px rgba(246,232,74,0.3), inset 0 1px 0 rgba(255,255,255,0.5)" }}>
                    <span aria-hidden style={{ position: "absolute", top: 5, right: 5, width: 4, height: 4, borderRadius: "50%", background: "#1a1810" }} />
                    {bp.toUpperCase()}
                  </span>
                ))}
              </div>

              {/* START / RESUME button */}
              <button
                onClick={handleStartWorkout}
                style={{ position: "relative", width: "100%", padding: "15px 0", borderRadius: 7, cursor: "pointer", background: "linear-gradient(180deg, #3a3a3e 0%, #2c2c30 50%, #1f1f22 100%)", border: "1px solid #0a0a0b", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.55)", fontFamily: labelFont, fontSize: 12, letterSpacing: 2.5, fontWeight: 800, color: theme.accent, textShadow: "0 0 8px rgba(246,232,74,0.5)" }}
              >
                <span aria-hidden style={{ position: "absolute", top: 0, left: 8, right: 8, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.06))" }} />
                {inProgress ? "► RESUME WORKOUT" : "► START WORKOUT"}
              </button>
            </div>
          )}

          {/* movement list */}
          {!loading && !err && (
            <div style={{ marginTop: 8 }}>
              {grouped.length === 0 && completedEntries.length === 0 ? (
                <EmptyState theme={theme} onAdd={() => setAddSheetOpen(true)} />
              ) : (
                <>
                  {grouped.map(([bp, items]) => (
                    <div key={bp} style={{ marginBottom: 14 }}>
                      {/* section header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: bodyFont, fontSize: 8, letterSpacing: 2, fontWeight: 800, color: theme.accent }}>{bp.toUpperCase()}</span>
                        <span style={{ flex: 1, height: 1, background: theme.listRule }} />
                        <span style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 1, fontWeight: 700, color: theme.listInkDim }}>{String(items.length).padStart(2, "0")}</span>
                      </div>

                      {/* movement rows */}
                      {items.map((item) => {
                        const { done, total } = itemProgress(item);
                        const name = item.mv?.name ?? item.entry?.name ?? "—";
                        const isComplete = total > 0 && done === total;
                        const planItem = plans.find((p) => p.id === item.planId);
                        const setsLabel = planItem ? `${planItem.sets ?? total} × ${planItem.reps ?? "?"}` : `${total} sets`;

                        return (
                          <div key={item.planId} style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 6, opacity: isComplete ? 0.5 : 1 }}>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", background: inProgress && done > 0 ? theme.rowNowBg : theme.rowDefaultBg, borderRadius: 5, border: `1px solid ${inProgress && done > 0 ? theme.rowNowBorder : theme.rowDefaultBorder}`, boxShadow: theme.rowInset }}>
                              {/* play/done indicator + name */}
                              <button
                                onClick={() => handleMovementTap(item)}
                                aria-label={`Start ${name}`}
                                style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                              >
                                {isComplete ? (
                                  <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: theme.listInkDim, color: theme.appBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>✓</span>
                                ) : (
                                  <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", border: `1.5px solid ${theme.accent}`, background: theme.appBg, color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, paddingLeft: 1, boxShadow: `0 0 8px ${theme.accentDim}` }}>▶</span>
                                )}
                                <span style={{ flex: 1, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: theme.listInk, textDecoration: isComplete ? "line-through" : "none" }}>{name}</span>
                              </button>

                              {/* sets/reps label */}
                              <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 600, color: theme.accent, textShadow: `0 0 7px ${theme.accentDim}`, flexShrink: 0 }}>{setsLabel}</span>

                              {/* remove button */}
                              {!item.fromHistory && (
                                <button
                                  onClick={() => setDeleteConfirm({ planId: item.planId, name })}
                                  aria-label="Remove movement"
                                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 4, marginLeft: 2, background: theme.keyOnBg, border: `1px solid ${theme.keyOnBorder}`, boxShadow: theme.keyOnInset, cursor: "pointer", color: theme.danger, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* completed movements strip */}
                  {completedEntries.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: bodyFont, fontSize: 8, letterSpacing: 2, fontWeight: 800, color: theme.success }}>DONE</span>
                        <span style={{ flex: 1, height: 1, background: theme.listRule }} />
                        <span style={{ fontFamily: labelFont, fontSize: 8, color: theme.listInkDim }}>{String(completedEntries.length).padStart(2, "0")}</span>
                      </div>
                      {completedEntries.map(({ entry }, i) => (
                        <div key={`done-${i}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", background: theme.rowDefaultBg, borderRadius: 5, border: `1px solid ${theme.rowDefaultBorder}`, boxShadow: theme.rowInset, marginBottom: 6, opacity: 0.55 }}>
                          <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: theme.success, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>✓</span>
                          <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: theme.listInk, textDecoration: "line-through" }}>{entry.name ?? entry.movementId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* add movement button */}
              {!loading && !err && (grouped.length > 0 || completedEntries.length > 0) && (
                <button
                  onClick={() => setAddSheetOpen(true)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, padding: "13px 0", borderRadius: 8, cursor: "pointer", background: "transparent", border: `1px dashed ${theme.listRule}` }}
                >
                  <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: "50%", border: `1.5px solid ${theme.accent}`, color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, boxShadow: `0 0 8px ${theme.accentDim}` }}>+</span>
                  <span style={{ fontFamily: labelFont, fontSize: 10, letterSpacing: 1.6, fontWeight: 800, color: theme.listInk }}>ADD MOVEMENT</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── fixed bottom hardware nav ── */}
        <HardwareNav theme={theme} currentTime={currentTime} onProfile={() => setShowProfile(true)} />

        {/* ── Modals ── */}
        {showProfile && (
          <ProfileModal
            theme={theme}
            isDark={isDark}
            onToggleTheme={() => {
              const next = !isDark;
              setIsDark(next);
              try { localStorage.setItem("fitlog_theme", next ? "dark" : "light"); } catch { /* */ }
              if (typeof document !== "undefined") {
                document.body.classList.toggle("theme-dark", next);
                document.body.classList.toggle("theme-light", !next);
              }
            }}
            selectedTimer={selectedTimer}
            onSelectTimer={(t) => { setSelectedTimer(t); setShowTimer(true); setShowProfile(false); }}
            onClose={() => setShowProfile(false)}
          />
        )}

        {showTimer && selectedTimer && (
          <TimerModal theme={theme} timerType={selectedTimer} onClose={() => setShowTimer(false)} />
        )}

        {/* delete confirmation bottom sheet */}
        {deleteConfirm && (
          <DeleteSheet
            theme={theme}
            name={deleteConfirm.name}
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={() => { handleRemoveEntry(deleteConfirm.planId); setDeleteConfirm(null); }}
          />
        )}

        {/* add movement sheet */}
        {addSheetOpen && (
          <MovementPickerSheet
            title="Add to today"
            movements={movements}
            excludeMids={activeMids}
            onAdd={(mv) => { handleAddMovement(mv); }}
            onClose={() => setAddSheetOpen(false)}
            onFavoriteToggled={(id, next) =>
              setMovements((prev) => prev.map((m) => m.id === id ? { ...m, favorite: next } : m))
            }
          />
        )}
      </div>
    </>
  );
}

// ─── Hardware bottom nav ──────────────────────────────────────────────────────

function HardwareNav({ theme, currentTime, onProfile }: { theme: CassetteTheme; currentTime: string; onProfile: () => void }) {
  const labelFont = "JetBrains Mono, monospace";
  const tabs = [
    { id: "today", label: "TODAY", href: "/today" },
    { id: "insights", label: "INSIGHTS", href: "/momentum" },
    { id: "plan", label: "PLAN", href: "/plan" },
    { id: "profile", label: "PROFILE", href: null },
  ];

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: theme.navChassis, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.6), 0 -10px 24px rgba(0,0,0,0.25)", zIndex: 40 }}>
      {/* time strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 4px" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        ))}
        <span style={{ fontFamily: labelFont, fontSize: 7.5, letterSpacing: 1.4, color: theme.navLabel, padding: "0 10px" }}>{currentTime || "--:--"}</span>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>

      {/* tab row */}
      <div style={{ display: "flex", gap: 6, padding: "0 12px 6px" }}>
        {tabs.map((t) => {
          const isActive = typeof window !== "undefined" && (t.href ? window.location.pathname === t.href : false);
          return (
            <button
              key={t.id}
              onClick={() => t.href ? (window.location.href = t.href) : onProfile()}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px", background: isActive ? theme.navKeyActive : theme.navKey, border: "none", borderRadius: 4, cursor: "pointer", boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,0.35)" : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4)" }}
            >
              <NavIcon id={t.id} color={isActive ? theme.navKeyInkActive : theme.navKeyInk} />
              <span style={{ fontFamily: labelFont, fontSize: 6.5, letterSpacing: 1.2, fontWeight: 800, color: isActive ? theme.navKeyInkActive : theme.navLabel }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavIcon({ id, color }: { id: string; color: string }) {
  const s: CSSProperties = { width: 16, height: 16, color };
  if (id === "today") return <svg style={s} viewBox="0 0 16 16" fill={color}><polygon points="4,2 14,8 4,14" /></svg>;
  if (id === "insights") return <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5"><rect x="1" y="9" width="3" height="6" /><rect x="6" y="5" width="3" height="10" /><rect x="11" y="1" width="3" height="14" /></svg>;
  if (id === "plan") return <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.5" /><circle cx="8" cy="8" r="0.8" fill={color} /></svg>;
  return <svg style={s} viewBox="0 0 16 16" fill={color}><circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ theme, onAdd }: { theme: CassetteTheme; onAdd: () => void }) {
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont = "Helvetica Neue, system-ui, sans-serif";

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
      {[
        { onClick: onAdd, kind: "plus", t: "BUILD YOUR OWN", s: "Add movement", ch: "CH·01 MAN" },
      ].map((b) => (
        <button
          key={b.kind}
          onClick={b.onClick}
          style={{ flex: 1, cursor: "pointer", position: "relative", overflow: "hidden", background: theme.isLight ? "linear-gradient(180deg, #ece7d8 0%, #ddd6c4 55%, #ccc4b0 100%)" : "linear-gradient(180deg, #3a3a3e 0%, #2c2c30 50%, #1f1f22 100%)", border: theme.isLight ? "1px solid rgba(40,38,30,0.18)" : "1px solid #0a0a0b", borderRadius: 8, boxShadow: theme.isLight ? "inset 0 1px 0 rgba(255,255,255,0.8), 0 3px 8px rgba(0,0,0,0.16)" : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.55)", padding: "16px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
        >
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: labelFont, fontSize: 6.5, letterSpacing: 1, fontWeight: 800, color: theme.accent }}>{b.ch}</span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: theme.accent, boxShadow: `0 0 4px ${theme.accent}`, animation: "tdBlink 1.4s infinite" }} />
          </div>
          <span style={{ width: 50, height: 50, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${theme.accent}`, background: theme.accent, boxShadow: `0 0 14px ${theme.accentDim}, inset 0 0 10px rgba(255,255,255,0.25)` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#1a1810" style={{ animation: "tdPulse 2.4s ease-in-out infinite" }}><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" /></svg>
          </span>
          <span style={{ fontFamily: labelFont, fontSize: 10, letterSpacing: 1.4, fontWeight: 800, color: theme.isLight ? "rgba(20,18,10,0.9)" : "rgba(255,255,255,0.92)" }}>{b.t}</span>
          <span style={{ fontFamily: bodyFont, fontSize: 11, color: theme.listInkDim }}>{b.s}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Delete confirmation bottom sheet ─────────────────────────────────────────

function DeleteSheet({ theme, name, onCancel, onConfirm }: { theme: CassetteTheme; name: string; onCancel: () => void; onConfirm: () => void }) {
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont = "Helvetica Neue, system-ui, sans-serif";

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: theme.isLight ? "linear-gradient(180deg, #e2ddcc, #cdc7b4)" : "linear-gradient(180deg, #242629, #16181c)", borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: "0 -10px 30px rgba(0,0,0,0.5)", padding: "16px 16px 32px", animation: "tdSheet 0.24s ease-out" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.danger, boxShadow: `0 0 6px ${theme.danger}` }} />
          <span style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 2, fontWeight: 800, color: theme.danger }}>REMOVE MOVEMENT</span>
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 18, fontWeight: 800, color: theme.listInk, marginBottom: 4 }}>Remove {name}?</div>
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: theme.listInkDim, marginBottom: 18 }}>This removes it from today&apos;s plan.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "13px 0", borderRadius: 7, cursor: "pointer", background: "transparent", border: `1px solid ${theme.listRule}`, fontFamily: labelFont, fontSize: 10, letterSpacing: 1.6, fontWeight: 700, color: theme.listInk }}>CANCEL</button>
          <button onClick={onConfirm} style={{ flex: 1.4, padding: "13px 0", borderRadius: 7, cursor: "pointer", background: theme.danger, border: "none", fontFamily: labelFont, fontSize: 10, letterSpacing: 1.6, fontWeight: 800, color: "#fff" }}>✕ REMOVE</button>
        </div>
      </div>
    </div>
  );
}
