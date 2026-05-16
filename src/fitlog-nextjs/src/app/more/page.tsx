"use client";

// Phase 7 — More hub. Links to History and Movement Library.
// Phase 8 — Sign out + dark mode toggle added.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/db";
import s from "./MorePage.module.css";

const THEME_KEY = "fitlog_theme";

function getStoredTheme(): "light" | "dark" | "system" {
  if (typeof localStorage === "undefined") return "light";
  return (localStorage.getItem(THEME_KEY) as "light" | "dark" | "system") ?? "light";
}

function applyTheme(theme: "light" | "dark" | "system") {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("theme-dark", dark);
  document.body.classList.toggle("theme-light", !dark);
}

export default function MorePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function handleThemeChange(next: "light" | "dark" | "system") {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div className={s.subline}>App</div>
        <h1 className={s.headline}>More</h1>
      </div>

      <div className={s.sectionLabel}>Workouts</div>
      <div className={s.cardList}>
        <Link href="/history" className={s.navCard}>
          <div className={s.navCardIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/></svg></div>
          <div className={s.navCardBody}>
            <div className={s.navCardTitle}>History</div>
            <div className={s.navCardSub}>All finished sessions</div>
          </div>
          <span className={s.navCardChev}>›</span>
        </Link>
      </div>

      <div className={s.sectionLabel}>Library</div>
      <div className={s.cardList}>
        <Link href="/movements" className={s.navCard}>
          <div className={s.navCardIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5v14M18 5v14M3 9h3M18 9h3M3 15h3M18 15h3M9 12h6"/></svg></div>
          <div className={s.navCardBody}>
            <div className={s.navCardTitle}>Movements</div>
            <div className={s.navCardSub}>Browse and manage your library</div>
          </div>
          <span className={s.navCardChev}>›</span>
        </Link>
      </div>

      <div className={s.sectionLabel}>Appearance</div>
      <div className={s.cardList}>
        <div className={s.themeCard}>
          <div className={s.navCardIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></div>
          <div className={s.navCardBody}>
            <div className={s.navCardTitle}>Theme</div>
            <div className={s.themePill}>
              {(["light", "system", "dark"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${s.themeBtn} ${theme === opt ? s.themeBtnActive : ""}`}
                  onClick={() => handleThemeChange(opt)}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={s.sectionLabel}>Account</div>
      <div className={s.cardList}>
        <button type="button" className={s.navCard} onClick={handleSignOut}>
          <div className={s.navCardIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
          <div className={s.navCardBody}>
            <div className={s.navCardTitle}>Sign out</div>
            <div className={s.navCardSub}>End your current session</div>
          </div>
        </button>
      </div>
    </div>
  );
}
