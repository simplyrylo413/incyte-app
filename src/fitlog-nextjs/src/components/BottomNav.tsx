"use client";

// BottomNav — floating glass-pill primary navigation.
// mobile351.html is visual reference only (icon glyphs, active-state treatment).
// IA: Today / Insights / Momentum / More.
// Icons: inline SVG, 22×22, stroke-width 1.6.

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const TABS = [
  {
    href: "/today",
    label: "Today",
    // Calendar with a dot — matches HTML build's Today glyph (data-bn-view="today")
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M4 11h16" />
        <circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/momentum",
    label: "Insights",
    // Bar chart — analytics/insights glyph (data-bn-view="insights" in mobile351)
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 20h16" />
        <rect x="6" y="12" width="3" height="6" />
        <rect x="11" y="8" width="3" height="10" />
        <rect x="16" y="4" width="3" height="14" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Momentum",
    // Lightning bolt — week/plan glyph (data-bn-view="week", aria-label="Momentum" in mobile351)
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 3 5 14h5l-1 7 8-11h-5l1-7Z" />
      </svg>
    ),
  },
] as const;

// More tab — grid icon
const MORE_ICON = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

export default function BottomNav() {
  const pathname = usePathname();

  // Determine which tab is active. "/more" also catches sub-routes under More.
  function isActive(href: string) {
    if (href === "/today") return pathname === "/today" || pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const moreActive = isActive("/more");

  return (
    <nav className={styles.nav} aria-label="Primary navigation">
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            style={{ color: active ? "#5d9bb8" : undefined }}
          >
            {tab.icon}
          </Link>
        );
      })}

      {/* Divider between Momentum and More */}
      <span className={styles.divider} aria-hidden="true" />

      <Link
        href="/more"
        aria-label="More"
        aria-current={moreActive ? "page" : undefined}
        className={`${styles.tab} ${moreActive ? styles.active : ""}`}
        style={{ color: moreActive ? "#5d9bb8" : undefined }}
      >
        {MORE_ICON}
      </Link>
    </nav>
  );
}
