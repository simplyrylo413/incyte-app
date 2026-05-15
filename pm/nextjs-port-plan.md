# Next.js port plan

> Phased plan for bringing `src/fitlog-nextjs/` to feature + visual parity with `src/fitlog-mobile.html` (mobile351 baseline). Per [`decisions.md` 2026-05-13](decisions.md), the HTML build stays primary during this work.

_Last updated: 2026-05-13_

---

## North star

**End state:** A Next.js 14 (app router) + React 18 + Tailwind + Supabase build that:
- Visually 1:1 with mobile351 — same tokens, same component patterns, same locked palette / voice / animation register
- Functionally complete with the HTML build's feature set: Today, Plan, Workout Mode (strength + mobility + cardio), Insights (Readiness, Recovery, Fatigue, PRs), Movement Library, History
- Reads + writes the same Supabase rows as the HTML build (data flows between them)
- Runs as a web app at first (Vercel), wrapped in Capacitor at launch for App Store

---

## Constraints (baked in)

1. **Schema:** The Next.js build adopts the HTML build's Supabase schema (inline `entries` jsonb on `workouts`, `device_id` keying). The scaffold's `supabase/schema.sql` is stale.
2. **Auth:** Anonymous (`device_id`) during build/test. Full auth becomes a launch blocker.
3. **Design system:** Tokens at [src/fitlog-mobile.html:20](../src/fitlog-mobile.html#L20) are the canonical source. Tailwind config + global CSS reflect them.
4. **Voice/positioning:** Locked per memory + [`launch-quality.md` §5](launch-quality.md). Reject motivational filler.
5. **Engine logic:** Auto-archive, fatigue math, RPE calibration, 1RM, identity (movement_id + equipment + variant), tombstones, same-day merge — all canonical in the HTML build. Port behavior, not lift-and-shift code.
6. **IA:** Today / Plan / Momentum / More. The scaffold's existing pages (history, movements, progress) get absorbed under More.

---

## Phase 0 — Reset the scaffold (½ session)

Get the scaffold to a clean baseline before adopting tokens or building components.

- [ ] Confirm `src/fitlog-nextjs/` runs (`npm run dev`). Hit `http://localhost:3000`.
- [ ] Audit the existing pages — what works, what assumes the wrong schema, what to keep.
- [ ] Replace `src/lib/types.ts` with HTML-compatible types: `Workout` carries inline `entries: WorkoutEntry[]` jsonb, plus `device_id`, `savedAt`, `completed_at`, `edited_at`, `workout_status`, `durationMin`.
- [ ] Rewrite `src/lib/db.ts` against the HTML build's schema. New helpers: `listWorkouts({ today, finished })`, `upsertWorkout(w)`, `deleteWorkout(id)`, `listMovements()`, `upsertMovement(m)`, `getOrCreateActiveSession()`.
- [ ] Drop the auth-based RLS assumptions in `db.ts` for build phase — queries filter by `device_id` instead.
- [ ] Wire `device_id` — read/write to `localStorage` (`fitlog_device_id`), generate uuid on first load. Match `DEVICE_ID` in the HTML build.
- [ ] Smoke-test reading the user's real Supabase data from the Next.js side (his actual workouts should appear).

**Files touched:**
- `src/fitlog-nextjs/src/lib/types.ts` — replaced
- `src/fitlog-nextjs/src/lib/db.ts` — replaced
- `src/fitlog-nextjs/src/lib/device.ts` — new (`device_id` helper)
- `src/fitlog-nextjs/middleware.ts` — neutered for build phase (no auth redirect)

---

## Phase 1 — Design system + tokens (1 session)

Bring INCYTE's locked design tokens into Tailwind so every subsequent component reaches for them by default.

- [ ] Update `tailwind.config.ts` with the INCYTE palette as Tailwind colors (`ink`, `muted`, `label`, `paper`, `paper-2`, `paper-3`, `accent`, `accent-2`, `accent-3`, `ok`, `warn`, `bad`, `hairline`, `hairline-soft`, `hairline-strong`).
- [ ] Add custom font families: `display` (Inter Tight), `text` (system + Inter Tight), `mono` (Geist Mono).
- [ ] Add custom font sizes matching the locked type scale (`text-eyebrow` 12px, `text-xs` 11px, `text-sm` 12px, `text-base` 13px, `text-md` 14px, `text-lg` 15px, `text-xl` 18px, `text-2xl` 22px, `text-3xl` 28px, `text-display` 34px).
- [ ] Add the locked gradient as a Tailwind utility (`bg-gradient-incyte`).
- [ ] Update `src/app/globals.css` — the body background gradient, font setup, base resets matching mobile351.
- [ ] Add CSS custom properties as a fallback (`--ink`, etc.) so component CSS that prefers `var(--*)` still works for parity with mobile351.
- [ ] Verify dark-mode tokens load via a `body.theme-dark` selector or Tailwind's `dark:` modifier.

**Files touched:**
- `src/fitlog-nextjs/tailwind.config.ts`
- `src/fitlog-nextjs/src/app/globals.css`

---

## Phase 2 — Shared layout + bottom nav (½ session)

Build the chrome the rest of the app sits inside.

- [ ] `src/app/layout.tsx` — page shell, body classes, viewport meta, theme class application.
- [ ] `src/components/BottomNav.tsx` — Today / Plan / Momentum / More tabs. Matches mobile351's glass treatment + 1.15x scale. Active tab indicator.
- [ ] `src/components/BackChip.tsx` — the gradient-glass disc with accent-blue border + colorful drop shadow.
- [ ] `src/components/RippleLayer.tsx` — tap-origin ripple as a reusable wrapper.
- [ ] `src/components/GlassCard.tsx` — the canonical 1.2px-border + backdrop-blur + sheen overlay surface used by `.hero-card`, `.progress`, etc.
- [ ] Routing scaffold: empty pages at `/today`, `/plan`, `/momentum`, `/more`. Default redirect from `/` to `/today`.

**Files touched:**
- `src/app/layout.tsx`
- `src/app/page.tsx` — redirect to `/today`
- `src/app/today/page.tsx` — placeholder
- `src/app/plan/page.tsx` — placeholder
- `src/app/momentum/page.tsx` — placeholder
- `src/app/more/page.tsx` — placeholder
- `src/components/BottomNav.tsx` — new
- `src/components/BackChip.tsx` — new
- `src/components/RippleLayer.tsx` — new
- `src/components/GlassCard.tsx` — new

---

## Phase 3 — Today page (2 sessions)

The primary surface. Highest visual + functional surface area.

- [ ] Header — `<h1>` with random-per-day fitness headline (port `TODAY_HEADLINES_V2` pool + stable-per-day picker)
- [ ] Date subtitle (weekday + month + day + split label)
- [ ] Session-stats hero — Volume / Avg RPE / Complete% with body-part breakdown under Volume. Same glass treatment as mobile351's `.progress`.
- [ ] Remaining / Completed toggle (`.mom-period-toggle`)
- [ ] `MovementCard` component (`.mv`) — drag handle + name + equipment pill + progress chip + remove button
- [ ] Equipment popover (`.equip-pop`) — tap-to-edit
- [ ] Group movements by body part with `.section-eyebrow` headers
- [ ] Tap-origin ripple on cards + 180ms nav delay
- [ ] History-sourced cards on Completed tab (read-only render, source-workout-aware tap)
- [ ] Plan-not-started routing: when the user has never created today's plan, show the empty state with "+ Add movement"
- [ ] Wire data read: `listWorkouts({ today })` + `getOrCreateActiveSession()`
- [ ] "+ Add movement" sheet — pulls from the movement library

**Engine pieces to port (functions):**
- `finishedTodayWorkouts()`
- `displayGroup(muscle, bodyPart)` for volume rollup
- `defaultSetsFor(planItem)` (used when opening a movement)

---

## Phase 4 — Workout Mode (2 sessions)

The set-logging surface.

- [ ] `WorkoutModeView` component
- [ ] Back chip, identity block (`MOBILITY · UNSPECIFIED` etc.), History pill (type-aware: lb/reps for strength, mm:ss for mobility, distance/time for cardio)
- [ ] Big-type hero — `weight × reps × rpe` for strength; `time` for mobility; cardio fallback for v1
- [ ] Per-set rows — set number, WU/WS toggle, BW toggle, prev display, today values, ✓ check, × remove
- [ ] Picker overlay (`.pk-overlay`) — weight/reps/rpe presets + steppers + backdrop-click-to-save
- [ ] Add set button (`+ Add set` / `+ Add round` for mobility)
- [ ] AI insight pill (`.rec-inline`) — under last done set
- [ ] Rest pill — tap to toggle, long-press to pick duration
- [ ] Mobility hero variant — "Mark set N done" CTA, no weight/reps/RPE gates

**Engine pieces to port:**
- `currentSetIdxV2(entry)`, `hasV(v)` predicate
- `logSetV2`, `addSetV2`, `removeSetV2`, `reopenSetV2`, `toggleSetTypeV2`, `toggleBodyweightV2`
- `logMobilitySetV2`, `addMobilitySetV2`, `editMobilityTimeV2`
- `archiveMovementToTodayV2` + `findFinishedTodaySessionV2` + `queueWorkoutSync`
- `persistWorkoutEditV2`
- `applyRecommendationV2` + `computeRecommendationV2`
- Rest timer state + handlers

---

## Phase 5 — Insights (1–1.5 sessions)

Under More → Insights, or as its own surface inside Momentum. Decide during Phase 5 scoping.

- [ ] Readiness card (`renderReadinessCard`) — calibrated headline + recommendation bullets (the rewritten "load context" copy, not "you're done for the day")
- [ ] Fatigue card (`renderFatigueCard`) — 60/40 max-mean across muscles, decay curve
- [ ] Recovery / Stimulus cards
- [ ] PR card
- [ ] All recharts-backed since the scaffold already has it as a dependency

**Engine pieces to port:**
- `computeOverallFatiguePct`
- `calibrateRpe`
- `nextSetCoachNote`
- `lastSessionFor`, `progressIdentityForEntry`
- 1RM (Brzycki/Epley blend with RPE sensitivity)

---

## Phase 6 — Plan editor (1 session)

Weekly grid editor — was a working surface in the HTML build before the Today rework.

- [ ] Mon–Sun grid with day-of-week column structure
- [ ] Add / edit / remove movement per day
- [ ] Plan order (drag handle)
- [ ] Equipment / variant selectors
- [ ] Training type tag

---

## Phase 7 — Momentum + History + Library under More (1.5 sessions)

- [ ] Momentum: PR hero, sparkline (single-period; multi-period overlay is F-04 backlog), history table by movement
- [ ] History: list of finished workouts, tap to open detail / inline edit
- [ ] Library: searchable movement list with category filter + manage CRUD

---

## Phase 8 — Auth flow (1.5 sessions, launch blocker only)

Skipped during build/test. Picked up before App Store submission.

- [ ] Signup, login, password reset, account deletion UI
- [ ] Wire `auth.uid()`-based RLS policies (production migration: replace `device_id` filter with `user_id`)
- [ ] One-time data migration: rows currently keyed by `device_id` get adopted by the corresponding `user_id` on first login
- [ ] D-03 (account-deletion flow) implementation

---

## Phase 9 — Capacitor wrap (1 session, launch only)

- [ ] Wrap the Next.js build with Capacitor (static export preferred; hybrid with API routes if needed)
- [ ] Bind native plugins: calendar (EKEventStore), local notifications
- [ ] App icon + splash
- [ ] iOS project setup, provisioning, App Store Connect listing

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Schema mismatch between Next.js queries and actual Supabase tables | High — Next.js shows empty data on launch | Phase 0 verification: read user's real data before building components on top. Adopt HTML schema before anything else. |
| Engine logic ports drift from HTML build over time | Medium — calculations diverge between builds | Cite HTML line numbers in every ported function header. Each port = a documented "behavior contract" between the two. Don't iterate on math in the Next.js port until HTML is the only build. |
| Visual parity is harder than expected (Tailwind ≠ vanilla CSS for the glass treatment) | Medium — Tailwind utility classes can't easily express the layered shadow + ::after sheen + backdrop-filter combos in mobile351 | Use Tailwind for layout + spacing + color; reach for component-level CSS (CSS modules or styled `<style jsx>`) for the glass treatments. Token names match across both. |
| Beta testers create data in Next.js build that the HTML build can't render (auth-only rows in production) | Medium | Build phase uses anonymous `device_id`. Production migration only happens at auth launch. Until then both builds see the same `device_id`-keyed rows. |
| User wants to ship before parity is reached | Medium | Hard rule: HTML stays the App Store submission target until Next.js reaches checklist parity. Web-app deployment of Next.js is independent and can ship at any time. |

---

## What gets thrown away

- `src/fitlog-nextjs/supabase/schema.sql` — stale, replaced by the HTML build's actual production schema. Mark deprecated.
- `src/fitlog-nextjs/src/components/AuthForm.tsx`, `SignOutButton.tsx`, `src/app/auth/`, `src/app/login/` — deferred to Phase 8. Keep code around but skip routing to them.
- `src/fitlog-nextjs/middleware.ts` — neutered (no auth redirect) during build phase. Restored in Phase 8.

---

## Effort estimate

| Phase | Effort | Cumulative |
|---|---|---|
| 0 — Reset scaffold | 0.5 session | 0.5 |
| 1 — Tokens | 1 session | 1.5 |
| 2 — Shell + bottom nav | 0.5 session | 2 |
| 3 — Today | 2 sessions | 4 |
| 4 — Workout Mode | 2 sessions | 6 |
| 5 — Insights | 1.5 sessions | 7.5 |
| 6 — Plan editor | 1 session | 8.5 |
| 7 — Momentum + History + Library | 1.5 sessions | 10 |
| 8 — Auth (launch blocker) | 1.5 sessions | 11.5 |
| 9 — Capacitor wrap (launch only) | 1 session | 12.5 |

**Total to feature + visual parity (pre-launch):** ~10 sessions × 3–4 hours = 30–40 hours of solo work.
**Plus launch work (auth + Capacitor):** ~2.5 sessions × 3–4 hours = 8–10 hours.

These are rough; revise as Phase 3 actually lands and the velocity becomes known.

---

## What I'm starting on first

After committing this plan + the decisions.md entry + the CLAUDE.md update:

**Phase 0 — Reset scaffold.** Get the build running, audit existing pages, replace the data layer against the HTML schema, smoke-test reading the user's real Supabase data. Single session; produces no visible UI but unblocks everything else.
