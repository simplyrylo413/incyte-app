"use client";

import { CSSProperties, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CassetteTheme } from "@/lib/cassetteTheme";

interface Props {
  theme: CassetteTheme;
  onProfile?: () => void;
}

function LED({ color, size = 3, glow = false }: { color: string; size?: number; glow?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color,
      boxShadow: glow ? `0 0 ${size * 1.5}px ${color}, inset 0 0 1px rgba(255,255,255,0.5)` : "none",
    }} />
  );
}

function NavIcon({ id, fill }: { id: string; fill: string }) {
  const s: CSSProperties = { display: "block" };
  const isLight = fill === "#0a0a0a" || fill === "#1a1810";
  if (id === "today") return <svg style={s} width="16" height="16" viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14" fill={fill} /></svg>;
  if (id === "insights") return (
    <svg style={s} width="18" height="18" viewBox="0 0 24 24" fill={fill}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="5.5" r="1.5" fill={isLight ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)"} />
      <circle cx="18.5" cy="12" r="1.5" fill={isLight ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)"} />
      <circle cx="12" cy="18.5" r="1.5" fill={isLight ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)"} />
      <circle cx="5.5" cy="12" r="1.5" fill={isLight ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)"} />
    </svg>
  );
  if (id === "plan") return (
    <svg style={s} width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" strokeWidth="1.6" stroke={fill} />
      <circle cx="9" cy="9" r="3.5" strokeWidth="1.6" stroke={fill} />
      <circle cx="9" cy="9" r="1" fill={fill} />
    </svg>
  );
  // profile
  return (
    <svg style={s} width="18" height="18" viewBox="0 0 24 24" fill={fill}>
      <circle cx="12" cy="8" r="4" fill={isLight ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)"} />
      <path d="M12 14c-5 0-8 2.5-8 5v3h16v-3c0-2.5-3-5-8-5z" fill={isLight ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)"} />
    </svg>
  );
}

const TABS = [
  { id: "today",    label: "TODAY",    href: "/today" },
  { id: "insights", label: "INSIGHTS", href: "/momentum" },
  { id: "plan",     label: "PLAN",     href: "/plan" },
  { id: "profile",  label: "PROFILE",  href: null },
];

const labelFont = "JetBrains Mono, monospace";

export default function CassetteNav({ theme, onProfile }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      setCurrentTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    fmt();
    const id = setInterval(fmt, 30_000);
    return () => clearInterval(id);
  }, []);

  function isActive(href: string | null) {
    if (!href) return false;
    if (href === "/today") return pathname === "/today" || pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      background: theme.navChassis,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.6), 0 -10px 24px rgba(0,0,0,0.25)",
      zIndex: 40,
      padding: "8px 14px 6px",
    }}>
      {/* label row — above the buttons, flanking accent lines */}
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <div key={t.id} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <span style={{ flex: "0 0 6px", height: 1, background: active ? theme.accent : theme.navLabel, opacity: active ? 0.8 : 0.3 }} />
              <span style={{
                fontFamily: labelFont, fontSize: 8.5, letterSpacing: 1.4, fontWeight: 700,
                color: active ? theme.accent : theme.navLabel,
                textShadow: active ? `0 0 4px ${theme.accent}` : "none",
                whiteSpace: "nowrap",
              }}>{t.label}</span>
              <span style={{ flex: "0 0 6px", height: 1, background: active ? theme.accent : theme.navLabel, opacity: active ? 0.8 : 0.3 }} />
            </div>
          );
        })}
      </div>

      {/* button row */}
      <div style={{ display: "flex", gap: 6 }}>
        {TABS.map((t) => {
          const active = isActive(t.href);
          const inkColor = active ? (theme.navKeyInkActive ?? "#0a0a0a") : theme.navKeyInk;
          return (
            <button
              key={t.id}
              onClick={() => t.href ? router.push(t.href) : onProfile?.()}
              style={{
                flex: 1, height: 42, position: "relative",
                background: active ? theme.navKeyActive : theme.navKey,
                border: "none", cursor: "pointer", borderRadius: 5,
                boxShadow: active
                  ? "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)"
                  : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)",
                color: inkColor,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {/* two LED dots at top corners */}
              <div style={{ position: "absolute", top: 3, left: 0, right: 0, display: "flex", justifyContent: "space-around", padding: "0 6px" }}>
                <LED color={active ? (theme.led ?? "#ff3b3b") : "rgba(255,255,255,0.15)"} size={3} glow={active} />
                <LED color={active ? (theme.led ?? "#ff3b3b") : "rgba(255,255,255,0.15)"} size={3} glow={active} />
              </div>
              <span style={{ marginTop: 4 }}>
                <NavIcon id={t.id} fill={inkColor} />
              </span>
            </button>
          );
        })}
      </div>

      {/* footer strip */}
      <div style={{
        marginTop: 6, padding: "3px 8px 0",
        fontFamily: labelFont, fontSize: 7.5, letterSpacing: 2.2,
        color: theme.navLabel, textAlign: "center",
        borderTop: `1px solid ${theme.chassisRule ?? "rgba(255,255,255,0.05)"}`,
        paddingTop: 5,
      }}>INCYTE · MDL-X7 · 04CH · {currentTime || "--:--"}</div>
    </div>
  );
}
