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
  if (typeof localStorage === "undefined") return "system";
  return (localStorage.getItem(THEME_KEY) as "light" | "dark" | "system") ?? "system";
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
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

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
          <div className={s.navCardIcon}>📋</div>
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
          <div className={s.navCardIcon}>🏋️</div>
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
          <div className={s.navCardIcon}>🌗</div>
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
          <div className={s.navCardIcon}>🔓</div>
          <div className={s.navCardBody}>
            <div className={s.navCardTitle}>Sign out</div>
            <div className={s.navCardSub}>End your current session</div>
          </div>
        </button>
      </div>
    </div>
  );
}
