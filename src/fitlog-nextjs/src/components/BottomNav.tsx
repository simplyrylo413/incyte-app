"use client";

// BottomNav — MPC chassis nav. Style reference: public/workout-alt.html.
// IA: Insights / Today / Plan / More (left → right, matching cassette prototype).

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const PADS = [
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

function PinRow() {
  return (
    <div className={styles.pinRow} aria-hidden="true">
      <span className={styles.pin} />
      <span className={styles.pin} />
      <span className={styles.pin} />
    </div>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/today")
      return pathname === "/today" || pathname === "/" || pathname.startsWith("/today/");
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className={styles.chassisWrap} aria-label="Primary navigation">
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
              <span className={styles.markIcon}>
                <svg width="10" height="12" viewBox="-7 -9 14 18">
                  <path d="M-3,-6 L0,-6 A6,6 0 0 1 0,6 L-3,6" fill="none" stroke="rgba(245,245,240,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="-7" y="-7" width="5" height="2.6" rx="1" fill="none" stroke="rgba(245,245,240,0.6)" strokeWidth="1.4"/>
                  <rect x="-7" y="4.4" width="5" height="2.6" rx="1" fill="none" stroke="rgba(245,245,240,0.6)" strokeWidth="1.4"/>
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Main chassis content */}
        <div className={styles.chassisMain}>

          {/* Scale labels row */}
          <div className={styles.scaleRow} aria-hidden="true">
            {PADS.map((p) => (
              <span
                key={p.tab}
                className={`${styles.scaleLabel} ${isActive(p.href) ? styles.scaleLabelActive : ""}`}
              >
                {p.tab}
              </span>
            ))}
          </div>

          {/* Pad row */}
          <div className={styles.pads}>
            {PADS.map((p) => {
              const active = isActive(p.href);
              return (
                <Link
                  key={p.tab}
                  href={p.href}
                  aria-label={p.label}
                  aria-current={active ? "page" : undefined}
                  className={`${styles.padWrapper} ${active ? styles.padWrapperActive : ""}`}
                >
                  <PinRow />
                  <div className={styles.pad}>
                    <span className={styles.led} />
                    <div className={styles.icon}>{p.icon}</div>
                  </div>
                  <PinRow />
                </Link>
              );
            })}
          </div>

          <div className={styles.footerSpec} aria-hidden="true">INCYTE · MDL-X7 · 04CH</div>
        </div>

      </div>
    </nav>
  );
}
