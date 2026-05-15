"use client";

// Phase 7 — More hub. Links to History and Movement Library.
// Phase 8 — Sign out button added.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/db";
import s from "./MorePage.module.css";

export default function MorePage() {
  const router = useRouter();

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
