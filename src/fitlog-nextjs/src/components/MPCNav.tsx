"use client";

import { usePathname, useRouter } from "next/navigation";
import styles from "./MPCNav.module.css";

const TABS = [
  {
    tab: "INSIGHT",
    href: "/momentum",
    label: "Insights",
    icon: (
      <svg width="22" height="18" viewBox="-15 -13 30 26" aria-hidden="true">
        <rect x="-13" y="2"  width="5.4" height="9"  rx="0.8" fill="currentColor"/>
        <rect x="-6"  y="-2" width="5.4" height="13" rx="0.8" fill="currentColor"/>
        <rect x="1"   y="-7" width="5.4" height="18" rx="0.8" fill="currentColor"/>
        <rect x="8"  y="-12" width="5.4" height="23" rx="0.8" fill="currentColor"/>
      </svg>
    ),
  },
  {
    tab: "TODAY",
    href: "/today",
    label: "Today",
    icon: (
      <svg width="18" height="18" viewBox="-13 -13 26 26" aria-hidden="true">
        <path d="M-7,-11 L11,0 L-7,11 Z" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    tab: "PLAN",
    href: "/plan",
    label: "Plan",
    icon: (
      <svg width="19" height="19" viewBox="-14 -14 28 28" aria-hidden="true">
        <circle cx="0" cy="0" r="12" fill="none" stroke="currentColor" strokeWidth="2.4"/>
        <circle cx="0" cy="0" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2"/>
        <circle cx="0" cy="0" r="2.4" fill="currentColor"/>
      </svg>
    ),
  },
  {
    tab: "MORE",
    href: "/more",
    label: "More",
    icon: (
      <svg width="18" height="18" viewBox="-12 -12 24 24" aria-hidden="true">
        <rect x="-10" y="-10" width="8" height="8" rx="1.8" fill="currentColor"/>
        <rect x="2"   y="-10" width="8" height="8" rx="1.8" fill="currentColor"/>
        <rect x="-10" y="2"   width="8" height="8" rx="1.8" fill="currentColor"/>
        <rect x="2"   y="2"   width="8" height="8" rx="1.8" fill="currentColor"/>
      </svg>
    ),
  },
] as const;

export default function MPCNav() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/today") return pathname === "/today" || pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className={styles.wrap} aria-label="Primary navigation">
      <div className={styles.chassis}>

        {/* Left I/O port column */}
        <div className={styles.leftMarks} aria-hidden="true">
          <div className={styles.leftBox}>
            <div className={styles.markRow}>
              <svg width="5" height="6" viewBox="0 0 7 8">
                <path d="M7,0 L0,4 L7,8 Z" fill="rgba(245,245,240,0.6)"/>
              </svg>
              <span className={styles.markLabel}>USB</span>
            </div>
            <div className={styles.markRow}>
              <svg width="5" height="6" viewBox="0 0 7 8">
                <path d="M7,0 L0,4 L7,8 Z" fill="rgba(245,245,240,0.6)"/>
              </svg>
              <svg width="10" height="12" viewBox="-7 -9 14 18">
                <path d="M-3,-6 L0,-6 A6,6 0 0 1 0,6 L-3,6" fill="none" stroke="rgba(245,245,240,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="-7" y="-7" width="5" height="2.6" rx="1" fill="none" stroke="rgba(245,245,240,0.6)" strokeWidth="1.4"/>
                <rect x="-7" y="4.4" width="5" height="2.6" rx="1" fill="none" stroke="rgba(245,245,240,0.6)" strokeWidth="1.4"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className={styles.main}>

          {/* Scale labels */}
          <div className={styles.scaleRow} aria-hidden="true">
            {TABS.map((t) => (
              <span key={t.tab} className={styles.scaleLabel}>{t.tab}</span>
            ))}
          </div>

          {/* Pads */}
          <div className={styles.pads}>
            {TABS.map((t) => {
              const active = isActive(t.href);
              return (
                <div
                  key={t.tab}
                  className={`${styles.padWrapper}${active ? " " + styles.active : ""}`}
                  onClick={() => router.push(t.href)}
                  role="button"
                  tabIndex={0}
                  aria-label={t.label}
                  aria-current={active ? "page" : undefined}
                  onKeyDown={(e) => e.key === "Enter" && router.push(t.href)}
                >
                  <div className={styles.pinRow}>
                    <span className={styles.pin}/>
                    <span className={styles.pin}/>
                    <span className={styles.pin}/>
                  </div>
                  <button className={styles.pad} tabIndex={-1} aria-hidden="true">
                    <span className={styles.led}/>
                    <div className={styles.icon}>{t.icon}</div>
                  </button>
                  <div className={styles.pinRow}>
                    <span className={styles.pin}/>
                    <span className={styles.pin}/>
                    <span className={styles.pin}/>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.footerSpec}>INCYTE · MDL-X7 · 04CH</div>
        </div>

      </div>
    </nav>
  );
}
