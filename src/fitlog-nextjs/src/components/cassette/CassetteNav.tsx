"use client";

import { CSSProperties, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CassetteTheme } from "@/lib/cassetteTheme";

interface Props {
  theme: CassetteTheme;
  onProfile?: () => void;
}

function NavIcon({ id, color }: { id: string; color: string }) {
  const s: CSSProperties = { width: 16, height: 16, color };
  if (id === "today") return <svg style={s} viewBox="0 0 16 16" fill={color}><polygon points="4,2 14,8 4,14" /></svg>;
  if (id === "insights") return <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5"><rect x="1" y="9" width="3" height="6" /><rect x="6" y="5" width="3" height="10" /><rect x="11" y="1" width="3" height="14" /></svg>;
  if (id === "plan") return <svg style={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.5" /><circle cx="8" cy="8" r="0.8" fill={color} /></svg>;
  return <svg style={s} viewBox="0 0 16 16" fill={color}><circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>;
}

const TABS = [
  { id: "today",    label: "TODAY",    href: "/today" },
  { id: "insights", label: "INSIGHTS", href: "/momentum" },
  { id: "plan",     label: "PLAN",     href: "/plan" },
  { id: "profile",  label: "PROFILE",  href: null },
];

export default function CassetteNav({ theme, onProfile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const labelFont = "JetBrains Mono, monospace";

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
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: theme.navChassis, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.6), 0 -10px 24px rgba(0,0,0,0.25)", zIndex: 40 }}>
      {/* time strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 4px" }}>
        {[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />)}
        <span style={{ fontFamily: labelFont, fontSize: 7.5, letterSpacing: 1.4, color: theme.navLabel, padding: "0 10px" }}>{currentTime || "--:--"}</span>
        {[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />)}
      </div>

      {/* tab row */}
      <div style={{ display: "flex", gap: 6, padding: "0 12px 6px" }}>
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <button
              key={t.id}
              onClick={() => t.href ? router.push(t.href) : onProfile?.()}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px", background: active ? theme.navKeyActive : theme.navKey, border: "none", borderRadius: 4, cursor: "pointer", boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.35)" : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4)" }}
            >
              <NavIcon id={t.id} color={active ? theme.navKeyInkActive : theme.navKeyInk} />
              <span style={{ fontFamily: labelFont, fontSize: 6.5, letterSpacing: 1.2, fontWeight: 800, color: active ? theme.navKeyInkActive : theme.navLabel }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
