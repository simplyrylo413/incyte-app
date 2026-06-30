"use client";

import type { CassetteTheme } from "@/lib/cassetteTheme";
import type { TimerType } from "./TimerModal";

interface Props {
  theme: CassetteTheme;
  isDark: boolean;
  onToggleTheme: () => void;
  selectedTimer: TimerType | null;
  onSelectTimer: (t: TimerType) => void;
  onClose: () => void;
}

const TIMERS: { id: TimerType; label: string; desc: string }[] = [
  { id: "tabata", label: "Tabata", desc: "20s work / 10s rest" },
  { id: "emom", label: "EMOM", desc: "Every minute on minute" },
  { id: "standard", label: "Standard", desc: "Countdown or stopwatch" },
];

export default function ProfileModal({ theme, isDark, onToggleTheme, selectedTimer, onSelectTimer, onClose }: Props) {
  const labelFont = "JetBrains Mono, monospace";
  const bodyFont = "Helvetica Neue, system-ui, sans-serif";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.appBg, borderRadius: 16, padding: "24px", width: "80%", maxWidth: 280, boxShadow: "0 10px 40px rgba(0,0,0,0.5)", border: `1px solid ${theme.listRule}` }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontFamily: labelFont, fontSize: 11, fontWeight: 800, color: theme.listInk, letterSpacing: 0.5 }}>SETTINGS</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: theme.listInk, fontSize: 20, cursor: "pointer", fontWeight: 800, lineHeight: 1 }}>✕</button>
        </div>

        {/* theme toggle */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <button
            onClick={onToggleTheme}
            style={{
              width: 100, height: 50, borderRadius: 25, cursor: "pointer", padding: "0 6px", border: "none",
              background: isDark ? "linear-gradient(180deg, #3a3a3e, #1f1f22)" : "linear-gradient(180deg, #b8b1a0, #a89c8a)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)",
              margin: "0 auto 10px",
            }}
          >
            <div style={{ fontSize: 18, opacity: isDark ? 1 : 0.3 }}>🌙</div>
            <div style={{ fontSize: 18, opacity: isDark ? 0.3 : 1 }}>☀️</div>
          </button>
          <div style={{ fontFamily: bodyFont, fontSize: 11, color: theme.listInkDim }}>{isDark ? "Dark Mode" : "Light Mode"}</div>
        </div>

        {/* timer selection */}
        <div style={{ paddingTop: 20, borderTop: `1px solid ${theme.listRule}` }}>
          <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: theme.listInk, marginBottom: 12, letterSpacing: 0.5 }}>DEFAULT TIMER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TIMERS.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTimer(t.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: selectedTimer === t.id
                    ? `1.5px solid ${theme.accent}`
                    : `1px solid ${theme.listRule}`,
                  background: selectedTimer === t.id
                    ? (isDark ? "rgba(246,232,74,0.08)" : "rgba(44,95,168,0.08)")
                    : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontFamily: labelFont, fontSize: 9, fontWeight: 800, color: theme.listInk, textAlign: "left" }}>{t.label}</div>
                  <div style={{ fontFamily: bodyFont, fontSize: 9, color: theme.listInkDim, textAlign: "left", marginTop: 2 }}>{t.desc}</div>
                </div>
                <div style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${theme.accent}`, background: selectedTimer === t.id ? theme.accent : "transparent", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
