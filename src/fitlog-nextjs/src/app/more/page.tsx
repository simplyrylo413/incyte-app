"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/db";
import { getCassetteTheme } from "@/lib/cassetteTheme";
import CassetteNav from "@/components/cassette/CassetteNav";
import ProfileModal from "@/components/cassette/ProfileModal";
import type { TimerType } from "@/components/cassette/TimerModal";

const THEME_KEY = "fitlog_theme";

function readIsDark(): boolean {
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === "light") return false;
    if (s === "dark") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch { return true; }
}

export default function MorePage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState<TimerType | null>(null);
  const theme = getCassetteTheme(isDark);

  useEffect(() => { setIsDark(readIsDark()); }, []);

  function handleToggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    document.body.classList.toggle("theme-dark", next);
    document.body.classList.toggle("theme-light", !next);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const labelFont = "JetBrains Mono, monospace";
  const bodyFont = "Helvetica Neue, system-ui, sans-serif";

  function hwCard(style?: React.CSSProperties): React.CSSProperties {
    return {
      background: theme.isLight
        ? "linear-gradient(180deg, #ece7d8 0%, #ddd6c4 55%, #ccc4b0 100%)"
        : "linear-gradient(180deg, #3a3a3e 0%, #2c2c30 50%, #1f1f22 100%)",
      border: theme.isLight ? "1px solid rgba(40,38,30,0.18)" : "1px solid #0a0a0b",
      borderRadius: 8,
      boxShadow: theme.isLight
        ? "inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.14)"
        : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.55)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 16px",
      width: "100%",
      textDecoration: "none",
      ...style,
    };
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: labelFont,
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 2,
    color: theme.listInkDim,
    marginBottom: 8,
    marginTop: 20,
  };

  const rowTitle: React.CSSProperties = {
    fontFamily: labelFont,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    color: theme.listInk,
    marginBottom: 2,
  };

  const rowSub: React.CSSProperties = {
    fontFamily: bodyFont,
    fontSize: 11,
    color: theme.listInkDim,
  };

  const chev: React.CSSProperties = {
    marginLeft: "auto",
    fontFamily: labelFont,
    fontSize: 16,
    color: theme.listInkDim,
    flexShrink: 0,
  };

  return (
    <div style={{ minHeight: "100dvh", background: theme.appBg, paddingBottom: 100 }}>
      <style>{`
        @keyframes tdBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* chassis header */}
      <div style={{ padding: "56px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: labelFont, fontSize: 8, letterSpacing: 2, color: theme.listInkDim, marginBottom: 4 }}>INCYTE</div>
          <div style={{ fontFamily: labelFont, fontSize: 22, fontWeight: 800, color: theme.listInk, letterSpacing: 0.5 }}>MORE</div>
        </div>
        {/* status LED */}
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, boxShadow: `0 0 8px ${theme.accent}`, display: "inline-block", animation: "tdBlink 2.4s infinite" }} />
      </div>

      {/* top hairline */}
      <div style={{ height: 1, background: theme.listRule, margin: "0 16px 4px" }} />

      <div style={{ padding: "0 16px" }}>

        {/* Workouts */}
        <div style={sectionLabel}>WORKOUTS</div>
        <Link href="/history" style={hwCard()}>
          <span style={{ color: theme.accent, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={rowTitle}>HISTORY</div>
            <div style={rowSub}>All finished sessions</div>
          </div>
          <span style={chev}>›</span>
        </Link>

        {/* Library */}
        <div style={sectionLabel}>LIBRARY</div>
        <Link href="/movements" style={hwCard()}>
          <span style={{ color: theme.accent, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5v14M18 5v14M3 9h3M18 9h3M3 15h3M18 15h3M9 12h6"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={rowTitle}>MOVEMENTS</div>
            <div style={rowSub}>Browse and manage your library</div>
          </div>
          <span style={chev}>›</span>
        </Link>

        {/* Appearance */}
        <div style={sectionLabel}>APPEARANCE</div>
        <button type="button" onClick={handleToggleTheme} style={hwCard({ cursor: "pointer" }) as React.CSSProperties}>
          <span style={{ color: theme.accent, flexShrink: 0 }}>
            {isDark
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            }
          </span>
          <div style={{ flex: 1 }}>
            <div style={rowTitle}>THEME</div>
            <div style={rowSub}>{isDark ? "Dark mode — tap to switch" : "Light mode — tap to switch"}</div>
          </div>
          <span style={{ fontFamily: labelFont, fontSize: 16, color: theme.accent }}>{isDark ? "🌙" : "☀️"}</span>
        </button>

        {/* Account */}
        <div style={sectionLabel}>ACCOUNT</div>
        <button type="button" onClick={handleSignOut} style={hwCard({ cursor: "pointer" }) as React.CSSProperties}>
          <span style={{ color: theme.danger ?? "#d9534f", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ ...rowTitle, color: theme.danger ?? "#d9534f" }}>SIGN OUT</div>
            <div style={rowSub}>End your current session</div>
          </div>
        </button>

        {/* version stamp */}
        <div style={{ fontFamily: labelFont, fontSize: 7.5, letterSpacing: 1.4, color: theme.listInkDim, textAlign: "center", marginTop: 32, opacity: 0.5 }}>
          INCYTE · BUILD {new Date().getFullYear()}
        </div>
      </div>

      {showProfile && (
        <ProfileModal
          theme={theme}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          selectedTimer={selectedTimer}
          onSelectTimer={setSelectedTimer}
          onClose={() => setShowProfile(false)}
        />
      )}

      <CassetteNav theme={theme} onProfile={() => setShowProfile(true)} />
    </div>
  );
}
