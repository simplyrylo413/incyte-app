"use client";

import { useState, useEffect, CSSProperties } from "react";
import type { CassetteTheme } from "@/lib/cassetteTheme";

export type TimerType = "tabata" | "emom" | "standard";

interface Props {
  theme: CassetteTheme;
  timerType: TimerType;
  onClose: () => void;
}

function hwBtn(theme: CassetteTheme, accent = false): CSSProperties {
  return {
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "JetBrains Mono, monospace",
    fontWeight: 800,
    fontSize: 10,
    letterSpacing: 1.4,
    border: theme.isLight
      ? "1px solid rgba(40,38,30,0.2)"
      : `1px solid ${theme.listRule}`,
    background: theme.isLight
      ? "linear-gradient(180deg, #d4cdb8, #c5bea3)"
      : theme.hwKeyBg,
    boxShadow: theme.isLight
      ? "inset 0 1px 0 rgba(255,255,255,0.8)"
      : theme.hwKeyInset,
    color: accent
      ? theme.accent
      : theme.isLight
      ? "#1a1810"
      : theme.listInk,
  };
}

export default function TimerModal({ theme, timerType, onClose }: Props) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [isRest, setIsRest] = useState(false);
  const [emomDuration, setEmomDuration] = useState(5);
  const [emomElapsed, setEmomElapsed] = useState(0);
  const [tabataWork, setTabataWork] = useState(20);
  const [tabataRest, setTabataRest] = useState(10);
  const [standardCountType, setStandardCountType] = useState<"up" | "down">("down");
  const [standardDuration, setStandardDuration] = useState(120);
  const [setupMode, setSetupMode] = useState(true);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (timerType === "tabata") {
        setTime((t) => {
          if (t > 0) return t - 1;
          setIsRest((r) => {
            const nextRest = !r;
            setTime(nextRest ? tabataRest : tabataWork);
            if (nextRest) setRounds((n) => n + 1);
            return nextRest;
          });
          return 0;
        });
      } else if (timerType === "emom") {
        setEmomElapsed((e) => {
          if (e >= emomDuration * 60) { setIsRunning(false); return e; }
          setTime((t) => (t === 0 ? 60 : t - 1));
          return e + 1;
        });
      } else {
        if (standardCountType === "down") {
          setTime((t) => {
            if (t <= 0) { setIsRunning(false); return 0; }
            return t - 1;
          });
        } else {
          setTime((t) => {
            if (t >= standardDuration) { setIsRunning(false); return t; }
            return t + 1;
          });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, timerType, isRest, emomDuration, tabataWork, tabataRest, standardCountType, standardDuration]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const monoFont = '"Share Tech Mono", "VT323", monospace';
  const labelFont = "JetBrains Mono, monospace";

  const lcdStyle: CSSProperties = {
    fontFamily: monoFont,
    color: theme.accent,
    textShadow: theme.isLight ? "none" : theme.lcdShadow,
    lineHeight: 1,
    fontWeight: 700,
  };

  function startTimer() {
    if (timerType === "tabata") setTime(tabataWork);
    else if (timerType === "standard") setTime(standardCountType === "down" ? standardDuration : 0);
    setSetupMode(false);
  }

  const controlBtn: CSSProperties = {
    ...hwBtn(theme, true),
    flex: 1,
    padding: "14px 0",
    borderRadius: 8,
    fontSize: 11,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 110,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 320,
          background: theme.appBg,
          borderRadius: 24,
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
          border: `1px solid ${theme.listRule}`,
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: labelFont, fontSize: 11, fontWeight: 800, color: theme.accent, letterSpacing: 1.6 }}>
            {timerType.toUpperCase()}
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: theme.listInk, fontSize: 20, cursor: "pointer", fontWeight: 800, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* SETUP: Tabata */}
        {setupMode && timerType === "tabata" && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 700, color: theme.listInkDim, marginBottom: 16, letterSpacing: 1.2 }}>CUSTOMIZE INTERVALS</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {[
                { label: "WORK", value: tabataWork, set: setTabataWork },
                { label: "REST", value: tabataRest, set: setTabataRest },
              ].map(({ label, value, set }) => (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: label === "WORK" ? theme.accent : theme.listInkDim }}>{label}</div>
                  <button onClick={() => set(Math.max(1, value - 1))} style={{ ...hwBtn(theme), width: "100%", padding: "8px 0", fontSize: 16 }}>−</button>
                  <div style={{ width: "100%", background: theme.isLight ? "linear-gradient(180deg, #c5bea3, #b5ae93)" : "#050607", borderRadius: 6, boxShadow: theme.isLight ? "inset 0 2px 6px rgba(0,0,0,0.15)" : "inset 0 2px 6px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56 }}>
                    <span style={{ ...lcdStyle, fontSize: 40 }}>{value}</span>
                  </div>
                  <button onClick={() => set(value + 1)} style={{ ...hwBtn(theme), width: "100%", padding: "8px 0", fontSize: 16 }}>+</button>
                </div>
              ))}
            </div>
            <button onClick={startTimer} style={{ ...hwBtn(theme, true), width: "100%", padding: "14px 0", borderRadius: 8, fontSize: 11 }}>
              SET TIMER
            </button>
          </div>
        )}

        {/* SETUP: EMOM */}
        {setupMode && timerType === "emom" && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 700, color: theme.listInkDim, marginBottom: 16, letterSpacing: 1.2 }}>SET DURATION</div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setEmomDuration(Math.max(1, emomDuration - 1))} style={{ ...hwBtn(theme), width: 50, fontSize: 18, fontWeight: 700 }}>−</button>
              <div style={{ flex: 1, background: theme.isLight ? "linear-gradient(180deg, #c5bea3, #b5ae93)" : "#050607", borderRadius: 6, boxShadow: theme.isLight ? "inset 0 2px 6px rgba(0,0,0,0.15)" : "inset 0 2px 6px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 72 }}>
                <span style={{ ...lcdStyle, fontSize: 48 }}>{emomDuration}</span>
              </div>
              <button onClick={() => setEmomDuration(emomDuration + 1)} style={{ ...hwBtn(theme), width: 50, fontSize: 18, fontWeight: 700 }}>+</button>
            </div>
            <div style={{ fontFamily: labelFont, fontSize: 9, color: theme.listInkDim, marginBottom: 20, letterSpacing: 1.2 }}>MINUTES</div>
            <button onClick={() => setSetupMode(false)} style={{ ...hwBtn(theme, true), width: "100%", padding: "14px 0", borderRadius: 8, fontSize: 11 }}>
              SET TIMER
            </button>
          </div>
        )}

        {/* SETUP: Standard */}
        {setupMode && timerType === "standard" && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 700, color: theme.listInkDim, marginBottom: 12, letterSpacing: 1.2 }}>MODE</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["down", "up"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setStandardCountType(mode)}
                  style={{
                    ...hwBtn(theme, standardCountType === mode),
                    flex: 1,
                    padding: "12px 0",
                    border: standardCountType === mode
                      ? `1.5px solid ${theme.accent}`
                      : `1px solid ${theme.isLight ? "rgba(40,38,30,0.2)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {mode === "down" ? "COUNT DOWN" : "COUNT UP"}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 700, color: theme.listInkDim, marginBottom: 12, letterSpacing: 1.2 }}>DURATION (MINUTES)</div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 20 }}>
              <button onClick={() => setStandardDuration(Math.max(60, standardDuration - 60))} style={{ ...hwBtn(theme), width: 50, fontSize: 18, fontWeight: 700 }}>−</button>
              <div style={{ flex: 1, background: theme.isLight ? "linear-gradient(180deg, #c5bea3, #b5ae93)" : "#050607", borderRadius: 6, boxShadow: theme.isLight ? "inset 0 2px 6px rgba(0,0,0,0.15)" : "inset 0 2px 6px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 72 }}>
                <span style={{ ...lcdStyle, fontSize: 40 }}>{Math.round(standardDuration / 60)}</span>
              </div>
              <button onClick={() => setStandardDuration(standardDuration + 60)} style={{ ...hwBtn(theme), width: 50, fontSize: 18, fontWeight: 700 }}>+</button>
            </div>
            <button onClick={startTimer} style={{ ...hwBtn(theme, true), width: "100%", padding: "14px 0", borderRadius: 8, fontSize: 11 }}>
              SET TIMER
            </button>
          </div>
        )}

        {/* RUNNING */}
        {!setupMode && (
          <>
            {timerType === "tabata" && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, textAlign: "center", opacity: isRest ? 0.5 : 1, transition: "opacity 0.3s" }}>
                  <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: theme.accent, marginBottom: 8, letterSpacing: 1.2 }}>WORK</div>
                  <div style={{ ...lcdStyle, fontSize: 56 }}>{isRest ? "--" : pad(time)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", opacity: isRest ? 1 : 0.5, transition: "opacity 0.3s" }}>
                  <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: theme.listInkDim, marginBottom: 8, letterSpacing: 1.2 }}>REST</div>
                  <div style={{ fontFamily: monoFont, fontSize: 56, fontWeight: 700, color: theme.listInkDim, lineHeight: 1 }}>{isRest ? pad(time) : pad(tabataRest)}</div>
                </div>
              </div>
            )}

            {timerType !== "tabata" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...lcdStyle, fontSize: 88 }}>{pad(time)}</div>
              </div>
            )}

            {timerType === "tabata" && (
              <div style={{ marginBottom: 20, padding: "12px", background: theme.isLight ? "rgba(0,0,0,0.04)" : "rgba(246,232,74,0.05)", borderRadius: 8, border: `1px solid ${theme.isLight ? "rgba(0,0,0,0.1)" : "rgba(246,232,74,0.2)"}` }}>
                <div style={{ fontFamily: labelFont, fontSize: 8, color: theme.listInkDim, letterSpacing: 1.4, marginBottom: 4 }}>ROUND</div>
                <div style={{ fontFamily: labelFont, fontSize: 28, fontWeight: 700, color: theme.accent }}>{rounds} / 8</div>
              </div>
            )}

            {timerType === "emom" && (
              <div style={{ marginBottom: 20, padding: "12px", background: theme.isLight ? "rgba(0,0,0,0.04)" : "rgba(246,232,74,0.05)", borderRadius: 8, border: `1px solid ${theme.isLight ? "rgba(0,0,0,0.1)" : "rgba(246,232,74,0.2)"}` }}>
                <div style={{ fontFamily: labelFont, fontSize: 8, color: theme.listInkDim, letterSpacing: 1.4, marginBottom: 4 }}>ELAPSED</div>
                <div style={{ fontFamily: labelFont, fontSize: 28, fontWeight: 700, color: theme.accent }}>{Math.floor(emomElapsed / 60)}:{pad(emomElapsed % 60)}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <button onClick={() => setIsRunning(!isRunning)} style={controlBtn}>
                {isRunning ? "⏸ PAUSE" : "▶ START"}
              </button>
              <button
                onClick={() => { setTime(timerType === "tabata" ? tabataWork : timerType === "standard" && standardCountType === "down" ? standardDuration : 0); setIsRunning(false); setRounds(0); setIsRest(false); setEmomElapsed(0); }}
                style={{ ...controlBtn, color: theme.listInk }}
              >
                ⟲ RESET
              </button>
            </div>

            <button
              onClick={onClose}
              style={{ width: "100%", padding: "12px 0", borderRadius: 8, cursor: "pointer", background: "transparent", border: `1px dashed ${theme.listRule}`, color: theme.listInkDim, fontFamily: labelFont, fontSize: 9, fontWeight: 700, letterSpacing: 1.4 }}
            >
              CLOSE
            </button>
          </>
        )}
      </div>
    </div>
  );
}
