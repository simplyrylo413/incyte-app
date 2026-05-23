# INCYTE — Production-Grade Engineering Handoff for Clean Rebuild

> **Audience:** A senior engineer (human or AI) with zero prior context who will inherit, stabilize, or rebuild INCYTE.
> **Purpose:** Preserve every architectural decision, product rule, lesson learned, and known defect — and identify what to keep vs throw away.
> **Tone:** Brutally honest. Technical. Specific.
> **Written:** 2026-05-23. Branch state: `claude/lucid-archimedes-dfFQx` at `7e86dbf`.

If you read nothing else, read **§13 Final Engineering Assessment** first — it tells you whether to rebuild or refactor.

---

## Table of contents

1. [Executive project overview](#1-executive-project-overview)
2. [Current tech stack & infrastructure](#2-current-tech-stack--infrastructure)
3. [Full application architecture](#3-full-application-architecture)
4. [Database & Supabase documentation](#4-database--supabase-documentation)
5. [Component inventory](#5-component-inventory)
6. [Product logic documentation](#6-product-logic-documentation)
7. [UI / UX design system](#7-ui--ux-design-system)
8. [Known bugs & debugging postmortem](#8-known-bugs--debugging-postmortem)
9. [Technical debt audit](#9-technical-debt-audit)
10. [Clean rebuild recommendation](#10-clean-rebuild-recommendation)
11. [Development rules for future Claude sessions](#11-development-rules-for-future-claude-sessions)
12. [Rebuild priority roadmap](#12-rebuild-priority-roadmap)
13. [Final engineering assessment](#13-final-engineering-assessment)

---

# 1. Executive project overview

## What INCYTE is

**INCYTE** is progressive overload tracking for trained lifters. A calibrated mirror, not a coach. It turns logged sets into honest feedback: when the user has actually pushed, when to back off, how today's session moves their week.

It is **not** a beginner's tutorial, not a hype reel, not a social network, not a generic gym log. The audience is explicit: lifters with 1+ year of consistent training, multi-discipline (strength + cardio + mobility), self-aware enough to report RPE honestly. The recommendation engine *assumes* calibrated RPE input from someone who knows what failure feels like and applies a downward calibration for trained-user overestimation.

## Product philosophy

- **Calibrated, not motivational.** Voice is clinical, direct, calibrated. Rejects "Crush your goals!", "Let's get it!", emoji punctuation, twee subcopy. Aims for: brief facts plus one next action ("No sessions this week. Plan one." / "Sync paused — check connection." / "Saved.").
- **A mirror, not a coach.** The app reflects what the user did and what it implies — it doesn't tell them what to do or generate fake encouragement. Recommendations branch on real state.
- **Premium minimalism.** Steel-blue / lavender / soft-pink palette against the convention of orange-energetic fitness apps. Reads as "calm / premium" rather than "gaming / dev tool".
- **Hardware-inspired industrial aesthetics.** The current visual direction (`workout-alt.html` source of truth) is an MPC/cassette deck metaphor — dark metal panels with rivets, LED indicators, monospace DSEG-7 LCD readouts, tactile rim-lit buttons. This was a deliberate pivot from the earlier "premium frosted glass" direction.

## Core differentiators

| Differentiator | What it means |
|---|---|
| Trained-lifter audience explicit | Refuses to add beginner-mode / guided tutorials; audience exclusion is a feature |
| Calibrated RPE engine | Downward-calibrates self-reported RPE based on user's historical accuracy |
| Equipment-aware tracking | Every entry carries (canonicalMovement, equipmentType, variant) so progress/PRs key correctly across renames |
| Local-first persistence | Designed to work offline; Supabase is sync target not source of truth |
| Voice register | Editorial discipline most fitness apps abandon — refuses motivational filler |
| Hardware aesthetic | MPC/cassette metaphor differentiates from generic SaaS/fitness UX |

## Intended emotional feel

- **In session:** tactile, focused, fast logging — like operating an instrument
- **Between sessions:** calm, informational, no nagging
- **On insight surfaces:** clinical respect for the user's intelligence; surface facts not pep talks

## Design inspirations (documented across this session)

- **Akai MPC / Roland TR drum machines** — the cassette/chassis bottom nav, rivet-bolted stat panels, LED active states
- **Vintage scientific instruments** — DSEG-7 LCD display for numerals, "INCYTE · MDL-X7 · 04CH" model nameplate footers
- **Apple HIG** — touch targets, safe-area handling, bottom-nav 4-tab limit
- **Brutalist analytics dashboards** — dense info layouts, monospace metadata, no decorative chrome
- Earlier (now superseded) inspirations: Apple-inspired glassmorphism, Miami Vice pastel accents, Spotify-style navigation — these terms appear in older PM docs but were superseded by the workout-alt cassette direction on 2026-05-19

## Primary workflows

1. **Open app → Today screen** shows planned movements for the current day-of-week
2. **Tap a movement** → workout mode (set logging UI)
3. **Log sets** (weight × reps × RPE; mobility = time; cardio = distance/time)
4. **Auto-archive** finished movements into a saved workout row
5. **Review insights** (Readiness, Recovery, Fatigue, PRs) on Momentum tab
6. **Plan future weeks** on Plan tab (Mon–Sun grid editor)
7. **Manage library / settings / history** under More

## Long-term vision

- Native iOS app via Capacitor → App Store
- Full Supabase auth (signup/login/password reset/account-deletion) as launch blocker
- AI-generated daily headlines via Supabase Edge Function
- AI insight generation (rules-based fallback when AI unavailable)
- Eventual: Apple Watch companion, HealthKit binding, training-block templates, subscription tier

## How it differs from competitors

- **Strong**, **Hevy** — beginner-friendly, social-feed driven; INCYTE refuses both
- **Fitbod** — auto-generates workouts; INCYTE never decides for the user
- **Apple Fitness** — passive activity tracking; INCYTE is active-input only
- The intentional narrowness (trained lifters, calibrated mirror, no motivation theatre) IS the positioning

## AI integration philosophy

- AI is a feature, not a foundation. Every AI-driven surface has a rules-based fallback.
- AI never decides for the user. It surfaces patterns, suggests next steps, and writes the daily headline.
- Failures degrade gracefully — never block the core logging flow.
- All AI calls are server-side (Supabase Edge Functions calling an LLM); the frontend caches outputs in localStorage to minimize cost.

## Analytics philosophy

- Show the truth, not the encouragement.
- Body-part breakdowns, volume calculations, RPE averages, completion rates — always tied to a calibrated baseline.
- Trend windows should be user-controllable (week, 3-week, lifetime) — multi-period overlays are F-04 backlog.

## Workout philosophy

- Three movement types: **strength** (weight × reps × RPE), **mobility** (time-only), **cardio** (distance × time + variant-specific fields).
- Sets carry identity: every entry knows its canonical movement, equipment, and variant. A "Dumbbell Curl" PR doesn't fold into a "Cable Curl" PR.
- Warmup sets are tagged separately from working sets and excluded from progression math.
- Bodyweight toggle modifies the weight semantics for that set.

## Data philosophy

- **Local-first.** localStorage is authoritative until proven otherwise.
- **Identity-stable.** Renaming a movement must not destroy its history — every set carries the canonical identifier.
- **Tombstones over hard deletes.** Deleted items go into a tombstones array so stale Supabase realtime fetches don't resurrect them.
- **Same-day merge.** Multiple sessions on the same date merge rather than overwrite (this is a documented historical pain point — see §8).

---

# 2. Current tech stack & infrastructure

## Framework versions (locked)

| Layer | Version | Notes |
|---|---|---|
| Next.js | 14.2.18 | App Router |
| React | 18.3.1 | |
| TypeScript | 5.6.3 | |
| Tailwind CSS | 3.4.14 | |
| Node.js | ≥18.17.0 | (engines field) |
| Supabase JS | 2.45.4 | |
| Supabase SSR | 0.5.2 | |
| Capacitor | 8.3.4 | core + ios + cli |
| Recharts | 2.13.3 | chart library |
| react-odometerjs | 3.1.3 | animated digit displays (CSS imported manually) |
| Netlify CLI | 26.0.2 | dev dependency only |
| Supabase CLI | 2.98.2 | dev dependency only |

Package manager: **npm** (lockfile present, `package-lock.json`).

## Project layout (two coexisting builds)

This repository contains two parallel builds. **They must not be confused.**

```
/home/user/incyte-app/
├── src/
│   ├── fitlog-mobile.html            ← HTML build, ~21.6k lines, vanilla JS/CSS/HTML
│   │                                    Originally THE app, now reference-only for engine logic
│   ├── fitlog-nextjs/                ← Next.js build — PRIMARY ACTIVE PRODUCT
│   │   ├── src/
│   │   │   ├── app/                  ← Routes (today, plan, momentum, more, history, etc.)
│   │   │   ├── components/           ← Shared components
│   │   │   └── lib/                  ← db, types, device, engine, supabase
│   │   ├── public/
│   │   │   ├── workout-alt.html      ← Cassette/MPC prototype — current VISUAL source of truth
│   │   │   └── (other prototypes)
│   │   ├── supabase/
│   │   │   ├── schema.sql            ← STALE. Don't trust. See §4.
│   │   │   ├── seed.sql
│   │   │   ├── functions/
│   │   │   │   ├── ai-insights/      ← NOT DEPLOYED — currently 401s in prod
│   │   │   │   └── import-exercises/
│   │   │   └── config.toml
│   │   ├── tailwind.config.ts        ← INCYTE design tokens
│   │   ├── next.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── mobile{NNN}.html              ← Historical numbered HTML snapshots (mostly archived)
├── pm/                               ← PM workspace (markdown)
│   ├── handoff.md                    ← Onboarding doc (different from this file)
│   ├── decisions.md                  ← Append-only decision log
│   ├── backlog.md                    ← Bugs / features / launch items
│   ├── roadmap.md
│   ├── nextjs-port-plan.md           ← Phased port plan, partly executed
│   ├── launch-quality.md             ← Pre-submission checklist
│   ├── REBUILD-HANDOFF.md            ← THIS FILE
│   └── mockups/                      ← Self-contained design mockup HTML files
├── CLAUDE.md                         ← AI-agent engineering rules
└── .git/
```

## Deployment

- **Hosting:** Netlify (`incyte13.netlify.app`, site ID `3b186e5f-3f0b-422c-be12-6d4d0f9f8b28`)
- **Build:** `npm run build` → `out/` (Next.js static export — needs `output: "export"` in `next.config.js` to function properly; verify this is set)
- **Deploy command:** `netlify deploy --prod --dir=out --site=3b186e5f-3f0b-422c-be12-6d4d0f9f8b28`
- **Authorization:** Per `CLAUDE.md §11`, AI agents must NEVER deploy without explicit user instruction. This rule was strengthened on 2026-05-23.

## Supabase

- **Project ID:** `drlmpltseepsxostsqdq` (shared with the HTML build)
- **Env vars required:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Client construction:** see `src/lib/supabase/client.ts` (10 lines) and `server.ts` (26 lines) — uses `@supabase/ssr`
- **Auth state:** Anonymous keying by `device_id` for build phase; full auth is a launch blocker (Phase 8 of port plan)

## Auth implementation

Two coexisting models — **this is a debt item** (see §9):

1. **Movements table** uses `auth.uid()` RLS (per `schema.sql`)
2. **Workouts and plans tables** use `device_id` keying (per `db.ts:269,302,339`)

The `db.ts:34` function `getIdentifier()` returns either `auth.uid()` (if signed in) or `getDeviceId()`. This bridges the two models but creates ambiguity about which is canonical.

`adoptDeviceRowsIfNeeded(uid)` at `db.ts:68` migrates device-keyed rows to a user UID on first sign-in.

There is an `AuthGuard.tsx` component that redirects unauthenticated users to `/login`, but `AuthForm.tsx` is partially dormant.

## State management

- **No global state library** (no Redux, Zustand, Jotai, etc.)
- All state is `useState` + `useEffect` per-page
- Theme preference is stored in `localStorage` (`incyte-theme`)
- Hidden plan IDs for today stored in `localStorage` (`hiddenPlanIds_YYYY-MM-DD`)
- Device ID stored in `localStorage` (`fitlog_device_id`)
- Daily AI headline cached in `localStorage` (`fitlog_headline_<date>`)
- No React Context for cross-component state

## Local storage usage (full inventory)

| Key | Set by | Purpose |
|---|---|---|
| `fitlog_device_id` | `lib/device.ts` | Anonymous identity |
| `fitlog_migrated_uid` | `db.ts adoptDeviceRowsIfNeeded` | Idempotency for device→uid migration |
| `fitlog_headline_<dateString>` | `aiHeadline.ts` | One-day AI headline cache |
| `hiddenPlanIds_<YYYY-MM-DD>` | `today/page.tsx` | "Hidden for today" plan IDs |
| `incyte-theme` | `today/page.tsx toggleTheme` | "dark" or "light" |

## Middleware

There is a `middleware.ts` in the project root (per port plan, was "neutered" for build phase). Confirm current state — should NOT enforce auth redirects during build phase.

## Dependency notes

- **`react-odometerjs`** — used by `OdometerNumber.tsx` but requires a manually-loaded CSS file (`/odometer-train-station.css` referenced in `layout.tsx`). This is fragile.
- **`recharts`** — present but underused; should be the chart library for Momentum/Insights when those are built out.
- **`netlify-cli`** in devDeps — useful for local-only deploys; do NOT use it programmatically without user authorization (per `CLAUDE.md §11`).
- **No animation library** (no Framer Motion, no React Spring). All animations are CSS-only — this is a deliberate choice per memory `reference_animation_libraries.md`.
- **No icon library** (no Heroicons, Lucide, FontAwesome). All icons are inline SVG — this is a deliberate choice for bundle size and visual control.

## Missing dependencies that should exist

| Missing | Why it should exist |
|---|---|
| Testing framework (Vitest, Jest, Playwright) | Engine logic has zero tests. Critical for rebuild safety. |
| Schema validation (Zod) | Database row shapes are validated by `rowToMovement`/`rowToWorkout`/`rowToPlan` ad-hoc. Type safety is weak. |
| Error tracking (Sentry, etc.) | Errors are `console.warn`ed and forgotten |
| Form library (react-hook-form) | None yet; all forms are useState-driven and inconsistent |

---

# 3. Full application architecture

## Folder tree (src/fitlog-nextjs/src/, file sizes in lines)

```
src/
├── app/
│   ├── layout.tsx                       (57)   ← shell, body theme-dark class, NavGuard, AuthGuard
│   ├── globals.css                      (~250) ← tokens (light + dark + theme-light)
│   ├── page.tsx                                 ← root redirect? confirm
│   ├── today/
│   │   ├── page.tsx                     (871)  ← Today screen + theme toggle + scroll structure
│   │   ├── TodayPage.module.css         (1739) ← page shell, stats, movement rows, light mode
│   │   └── workout/
│   │       ├── page.tsx                 (1170) ← Workout mode (set logging UI)
│   │       └── WorkoutPage.module.css   (1263)
│   ├── plan/
│   │   ├── page.tsx                     (554)  ← Mon–Sun grid editor
│   │   └── PlanPage.module.css          (1814)
│   ├── momentum/
│   │   ├── page.tsx                     (?)    ← Charts / insights (15 kB First Load JS)
│   │   └── *.module.css
│   ├── more/
│   │   ├── page.tsx                     (114)
│   │   └── MorePage.module.css          (271)
│   ├── movements/
│   │   ├── page.tsx                     (675)  ← Movement library CRUD
│   │   └── MovementsPage.module.css     (1395)
│   ├── history/
│   │   ├── page.tsx                     (416)  ← Past workouts
│   │   └── HistoryPage.module.css       (691)
│   ├── progress/page.tsx                (15)   ← STUB/placeholder
│   ├── login/page.tsx                   (13)   ← Likely stub
│   └── auth/callback/page.tsx           (43)   ← Supabase auth callback
├── components/
│   ├── BottomNav.tsx                    (143)  ← MPC chassis bottom nav, supports inline mode
│   ├── BottomNav.module.css             (321)
│   ├── NavGuard.tsx                     (12)   ← Suppresses nav on certain routes
│   ├── Nav.tsx                          (46)   ← (legacy? unused?)
│   ├── AuthGuard.tsx                    (44)   ← Client-side auth redirect
│   ├── AuthForm.tsx                     (165)
│   ├── AuthForm.module.css              (280)
│   ├── SignOutButton.tsx                (22)
│   ├── MovementCard.tsx                 (466)  ← LEGACY — superseded by inline MovementRow in today/page.tsx
│   ├── MovementsManager.tsx             (110)  ← LEGACY
│   ├── MovementPickerSheet/
│   │   ├── MovementPickerSheet.tsx      (315)  ← Bottom sheet movement picker
│   │   └── *.module.css                 (427)
│   ├── AddMovementButton.tsx            (109)
│   ├── FinishWorkoutButton.tsx          (65)
│   ├── ProgressView.tsx                 (48)   ← legacy
│   ├── ProgressChart.tsx                (69)   ← legacy
│   └── OdometerNumber.tsx               (35)   ← animated digit display (fragile dep)
└── lib/
    ├── db.ts                            (445)  ← Supabase CRUD; mixed RLS + device_id keying
    ├── types.ts                         (222)  ← Domain types — single source of truth
    ├── device.ts                        (46)   ← getDeviceId() — anonymous identity
    ├── supabase/
    │   ├── client.ts                    (10)   ← Browser client
    │   └── server.ts                    (26)   ← Server client (SSR)
    └── engine/
        ├── today.ts                     (349)  ← Today page logic (filterTodaysPlan, buildTodayItems, calcDayStats)
        ├── workout.ts                   (330)  ← Workout mode mutations
        ├── plan.ts                      (170)  ← Plan editor logic
        ├── momentum.ts                  (705)  ← Charts / aggregations
        ├── insightEngine.ts             (870)  ← Readiness, Recovery, Fatigue calculations
        ├── aiHeadline.ts                (57)   ← Daily AI headline fetch + cache
        ├── aiInsights.ts                (211)  ← AI insight generation
        └── aiTimelineInsights.ts        (245)  ← AI timeline insight generation
```

**Total Next.js source:** ~20,677 lines (TS + TSX + CSS in src/). The Today + Workout pair alone is **~5,043 lines** across 4 files — that is monolithic and is the largest stability risk in the codebase.

## Component hierarchy

```
<RootLayout> (app/layout.tsx)
├── <body className="theme-dark">  ← server-side baked theme
│   ├── {children}                 ← page-specific content
│   ├── <NavGuard />               ← renders <BottomNav /> if route allowed
│   └── <AuthGuard />              ← client-side auth redirect
```

Per-page (e.g. Today):

```
<TodayPage>
├── <div className=".page">                       ← position: fixed; max-width: 430px; flex column
│   ├── <div className=".scrollContent">          ← flex: 1, overflow-y: auto
│   │   ├── <Header>                              ← inline JSX, includes theme toggle button
│   │   ├── <SessionStats>                        ← inline component (3 metal panels)
│   │   ├── <LoggedStrip>                         ← inline component (completed-today chips)
│   │   └── <MovementRow>×N                       ← inline component (one per movement)
│   │       └── <EquipmentPopover>                ← conditionally rendered
│   ├── <div className=".navWrap">
│   │   └── <BottomNav inline />                  ← rendered inside the column
│   ├── <MovementPickerSheet />                   ← conditional (addSheetOpen)
│   └── <LoggedDetailSheet>                       ← conditional (detailEntry)
```

`SessionStats`, `MovementRow`, `LoggedStrip`, `LoggedDetailSheet`, `EmptyState` are **all defined inline inside today/page.tsx** — not extracted into separate component files. This is the monolithic component pattern that `CLAUDE.md §13-A` explicitly forbids.

## Data flow

1. **Page mount** → `load()` callback fires
2. `load()` runs `Promise.all([listMovements, listPlans, listWorkouts({finished:false,limit:1}), listFinishedTodayWorkouts])`
3. Each query reads from Supabase via the browser client
4. Results stored in `useState` (`movements`, `plans`, `activeWorkout`, `finishedToday`)
5. Derived computations happen in render (`filterTodaysPlan`, `buildTodayItems`, `calcDayStats`)
6. Mutations call `upsertWorkout` etc., update local state optimistically, then await DB
7. `window` focus event re-runs `load()` to handle back-button returns

There is **no caching layer** (no React Query, no SWR, no manual cache). Every page load re-fetches.

There is **no offline write queue**. If the device is offline, mutations silently fail with a `console.warn`. This is a HIGH-severity defect for a local-first product.

## Rendering flow

- All pages are **Client Components** (`"use client"` at top of every page.tsx)
- Pages prerender as static via `export const dynamic = "force-static"` in `next.config.js` (verify) → static export to `out/`
- Hydration: server sends static HTML with `theme-dark` baked in; client hydrates and runs `useEffect`s that may toggle `theme-light` based on `localStorage`
- This creates a **hydration mismatch risk** if `localStorage` says `light` — the body briefly renders dark, then flips. The current implementation tries to avoid this by reading `localStorage` immediately in `useEffect`, but a brief flash is possible.

## Server vs client boundaries

- **Server-side:** Supabase server client in `lib/supabase/server.ts` exists but is barely used in the active routes — most fetches are client-side
- **Client-side:** All CRUD operations in `db.ts`
- **Static export:** Means no API routes execute server-side at runtime; all logic must work client-side

This is a deliberate constraint for the Capacitor wrap (App Store target) — static files only.

## Architectural drift (where things broke down)

1. **Schema split** — `supabase/schema.sql` describes one schema (movements + workouts + workout_entries normalized, `auth.uid()` RLS); `db.ts` uses another (movements with `auth.uid()`, workouts/plans with `device_id`, inline `entries` jsonb). `schema.sql` is documented as stale but was never deleted or migrated.
2. **Monolithic page files** — Today page is 871 lines + 1739 lines of CSS in two files. Workout page is 1170 + 1263. These violate the ~300-line component standard in `CLAUDE.md §13-A`.
3. **Legacy components left in tree** — `MovementCard.tsx` (466 lines), `MovementsManager.tsx`, `ProgressView.tsx`, `ProgressChart.tsx`, `Nav.tsx` are all dormant but still type-checked, still compiled, still imported in some places. The port plan calls for them to be deleted after Phase 7.
4. **Visual source of truth changed mid-build** — Started with `mobile351` (the HTML build's frosted glass / blue-gray direction), pivoted to `workout-alt.html` (cassette/MPC industrial direction) on 2026-05-19. Many CSS files still mix both aesthetics.
5. **Theme inconsistency** — `body.theme-dark` is server-rendered, but per-component CSS often hardcodes white text colors as the *base* (not as theme-overrides). This works in dark mode by coincidence and leaves light mode as the override surface rather than the equal alternative. See `TodayPage.module.css` — there are ~130 `body.theme-light` overrides, suggesting the base was never refactored to be theme-neutral.
6. **`react-odometerjs` dependency** — required a manual CSS link in `layout.tsx` (`/odometer-train-station.css` from `public/`); broke a build at one point because the package wasn't installed in CI (had to be added to dependencies mid-deploy on 2026-05-22).

## What's stable

- `lib/db.ts` CRUD signatures (the API surface, not the implementation details)
- `lib/types.ts` domain types — well-documented, intentional, traceable to HTML build
- `lib/engine/today.ts` — pure functions, testable, no DOM coupling
- `BottomNav.tsx` and its CSS module — clean, isolated, supports two layout modes
- `MovementPickerSheet/` — properly extracted, isolated, reusable
- `tailwind.config.ts` — locked palette, tokens mirror HTML build

## What should be rebuilt (specific files)

| File | Why rebuild |
|---|---|
| `src/app/today/page.tsx` (871 lines) | Inline `SessionStats`, `MovementRow`, `LoggedStrip`, `LoggedDetailSheet` — extract to components |
| `src/app/today/workout/page.tsx` (1170 lines) | Same monolithic pattern |
| `src/app/today/TodayPage.module.css` (1739 lines) | Mix of base styles + 130+ theme overrides + dead rules from earlier aesthetics |
| `src/lib/db.ts` (445 lines) | Two-keying-system inconsistency; missing offline queue; no validation |
| `src/components/MovementCard.tsx` (466 lines) | Dormant. Delete or rebuild. |

---

# 4. Database & Supabase documentation

> ⚠️ **The schema in `supabase/schema.sql` is STALE.** The actual production schema used by both builds is described below, based on what `db.ts` actually writes.

## Actual production schema (what code expects)

### `public.movements`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` default |
| `user_id` | uuid | Default `auth.uid()`, FK to `auth.users`, ON DELETE CASCADE. **RLS-protected.** |
| `device_id` | uuid \| null | **Used by HTML build and parts of Next.js build** for anonymous identity |
| `name` | text NOT NULL | |
| `kind` | text | Check constraint: `'weight'`, `'cardio'`, possibly `'strength'` (legacy) |
| `muscle` | text \| null | Legacy column (HTML build) — equals `body_part` |
| `body_part` | text \| null | Canonical column (Next.js build) |
| `category` | text \| null | Legacy column — equals `equipment_type` |
| `equipment_type` | text \| null | Canonical |
| `variant` | text \| null | e.g. "Incline", "Decline" |
| `canonical_movement` | text \| null | Identity stability across renames |
| `unit` | text \| null | Cardio: `'mi'`, `'km'`, `'m'` |
| `default_sets` | int \| null | |
| `default_reps` | text \| null | |
| `notes` | text \| null | |
| `gif_url` | text \| null | |
| `secondary_muscles` | text[] \| null | |
| `instructions` | text[] \| null | |
| `favorite` | bool \| null | |
| `created_at` | timestamptz | Default `now()` |

Indexes: `movements_user_idx (user_id)` per schema.sql; verify `device_id` indexed too (likely a perf gap if not).

Unique constraint per schema.sql: `(user_id, name)` — but with `device_id` keying this may be inconsistent. Verify.

RLS (per schema.sql, for `user_id`):
- `movements_select_own`, `_insert_own`, `_update_own`, `_delete_own` — `using (auth.uid() = user_id)`

**Gap:** No RLS policies for `device_id`-keyed access. If the table has `device_id` rows without `user_id`, they may be invisible due to RLS, OR RLS may be silently disabled for service-role-key access. **Verify by querying Supabase directly.**

### `public.workouts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Default `auth.uid()`, FK, ON DELETE CASCADE (per schema.sql) |
| `device_id` | uuid | **Actually used for filtering in `listWorkouts()`** |
| `name` | text \| null | |
| `date` | date NOT NULL | Plain date, not timestamp |
| `finished` | bool | Default false |
| `entries` | jsonb | **Array of `WorkoutEntry` objects — INLINE not normalized** |
| `saved_at` | timestamptz \| null | |
| `completed_at` | timestamptz \| null | |
| `edited_at` | timestamptz \| null | |
| `workout_status` | text \| null | `'completed'`, `'saved'` |
| `notes` | text \| null | |
| `created_at` | timestamptz | |

`entries` jsonb shape (`WorkoutEntry`):
```json
{
  "movementId": "uuid",
  "planId": "string|null",
  "name": "string",
  "muscle": "string",
  "equipmentType": "string",
  "canonicalMovement": "string",
  "variant": "string?",
  "sets": [{"weight": 100, "reps": 8, "rpe": 8.5, "done": true, "warmup": false, "bw": false}],
  "skipped": false,
  "archivedAt": "iso"
}
```

Index: `workouts_user_date_idx (user_id, date DESC)` per schema.sql; need `(device_id, date DESC)` for actual prod queries.

### `public.plans`

Per `db.ts:351–363`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `device_id` | uuid | Keyed |
| `mid` | uuid | Movement ID FK (no enforced FK constraint in code) |
| `dow` | int 0–6 | Day of week, Sun=0 |
| `sets` | int \| null | |
| `reps` | text \| null | Stored as text (allows "3-5" ranges) |
| `rpe` | text \| null | |
| `tempo` | text \| null | |
| `notes` | text \| null | |
| `target_weight` | numeric \| null | |
| `training_type` | text \| null | `'strength'`, `'hypertrophy'`, `'power'`, `'mobility'`, `'endurance'` |

**This table is NOT in `schema.sql` at all.** It was added ad-hoc in production. There is no documented RLS policy for it.

### `workout_entries` (per schema.sql but UNUSED in production)

The `schema.sql` defines a normalized `workout_entries` table with proper FKs and RLS. The actual implementation stores entries inline as jsonb on `workouts`. **This table likely exists empty in Supabase.**

## Edge Functions

Located at `supabase/functions/`:

### `ai-insights/index.ts`

- Called from `lib/engine/aiHeadline.ts` to generate a daily headline
- **CURRENTLY RETURNS 401 IN PRODUCTION** — not deployed, or auth is misconfigured
- Frontend has a graceful fallback to a static headline pool
- 401s used to spam the console twice per page load (React 18 strict-mode double-effect) — fixed 2026-05-22 by in-flight promise dedup + missing-env-var guard

### `import-exercises/index.ts`

- One-time exercise library import utility
- Unknown deployment status

## What's stable

- The schema **as queried** (`db.ts` is internally consistent)
- jsonb-on-workouts pattern works for current usage
- Local-first reads/writes

## What's experimental / risky

- The dual-keying (`user_id` for some tables, `device_id` for others)
- The undocumented `plans` table (no schema migration)
- `entries` jsonb with no schema validation server-side
- No realtime subscriptions wired

## Known data problems

| Problem | Severity | Notes |
|---|---|---|
| Stale unfinished workouts from yesterday appearing on today | HIGH | Fixed 2026-05-22 by switching `isFromToday` to local calendar dates (was UTC). May still affect data created before the fix. |
| Schema.sql doesn't match production | HIGH | Mislead anyone reading docs first |
| No FK constraint between `plans.mid` and `movements.id` | MEDIUM | Plan rows can reference deleted movements |
| Duplicate writes via React 18 strict-mode | LOW | Was an issue with `ai-insights` only; verify no other useEffects double-fire mutations |
| RLS may not be wired for `device_id` access | UNKNOWN | Needs Supabase dashboard audit |
| No optimistic-write rollback if mutation fails | MEDIUM | UI updates first, await DB second; failure is silent |
| No offline write queue | HIGH | Mutations during offline = `console.warn` and lost |

## Sync / persistence flow

```
[User action] → setState (optimistic) → upsertWorkout() →
  supabase.from('workouts').upsert(...) →
  on success: nothing (state is already updated)
  on failure: console.warn (silent to user)
```

This is the **single largest reliability risk** in the codebase. There is no retry, no queue, no user notification, no offline detection, no conflict resolution.

---

# 5. Component inventory

## Active components (used in current routes)

### `BottomNav.tsx` (143 lines)

- **Purpose:** Bottom navigation, 4 tabs (INSIGHT, TODAY, PLAN, MORE), MPC cassette aesthetic
- **Props:** `inline?: boolean` — switches between `position: fixed` (default) and inline-within-page
- **Dependencies:** Next router (`usePathname`, `useRouter`), CSS module
- **Stability:** STABLE. Recently added `inline` mode (2026-05-23) to fix nav width on Today page.
- **Preserve:** YES

### `NavGuard.tsx` (12 lines)

- **Purpose:** Conditionally renders BottomNav based on route
- **Suppresses on:** `/login`, `/auth/*`, `/today/workout`, `/today`, `/`
- **Stability:** STABLE
- **Preserve:** YES (or fold into layout logic)

### `AuthGuard.tsx` (44 lines)

- **Purpose:** Client-side auth redirect
- **Stability:** UNKNOWN — may be dormant during build phase
- **Preserve:** REBUILD when auth is wired (Phase 8)

### `MovementPickerSheet/` (315 + 427 lines)

- **Purpose:** Bottom sheet for picking a movement from the library
- **Stability:** STABLE
- **Preserve:** YES — good extraction example

### `AddMovementButton.tsx` (109 lines)

- **Purpose:** Button + add-movement sheet trigger
- **Stability:** STABLE
- **Preserve:** YES

### `FinishWorkoutButton.tsx` (65 lines)

- **Purpose:** "Finish session" action
- **Stability:** STABLE
- **Preserve:** YES

### `OdometerNumber.tsx` (35 lines)

- **Purpose:** Animated digit display using `react-odometerjs`
- **Stability:** FRAGILE — requires manual CSS import in `layout.tsx`; the dependency broke a build on 2026-05-22
- **Preserve:** RECONSIDER. Implement custom animated counter with CSS transitions instead.

## Dormant / legacy components (in tree but not actively routed)

### `MovementCard.tsx` (466 lines) — DELETE OR REBUILD

- Superseded by the inline `MovementRow` component in `today/page.tsx`
- Still type-checked, still compiled into bundle (if imported anywhere)
- **Verify nothing imports it before deletion.**

### `MovementsManager.tsx` (110 lines) — DELETE
### `ProgressView.tsx` (48 lines) — DELETE
### `ProgressChart.tsx` (69 lines) — DELETE
### `Nav.tsx` (46 lines) — DELETE (superseded by BottomNav)

### `AuthForm.tsx` (165 lines) + module CSS (280 lines)

- Login/signup form
- Probably dormant during build phase
- **Preserve** — wire up in Phase 8 (auth launch blocker)

### `SignOutButton.tsx` (22 lines)

- Trivial wrapper
- Preserve

## Inline-defined components (should be extracted)

These all live inside `src/app/today/page.tsx`:

| Component | Where (approx line) | Purpose | Should be extracted |
|---|---|---|---|
| `SessionStats` | ~413–460 | 3 metal panel stats (Volume, Avg RPE, Done %) | YES → `components/today/SessionStats.tsx` |
| `MovementRow` | ~460–590 | Single movement row | YES → `components/today/MovementRow.tsx` |
| `LoggedStrip` | ~608+ | Completed-today chip rail | YES → `components/today/LoggedStrip.tsx` |
| `LoggedDetailSheet` | (later in file) | Bottom sheet for editing completed entry | YES → `components/today/LoggedDetailSheet.tsx` |
| `EmptyState` | ~594–605 | First-run empty state | YES → `components/today/EmptyState.tsx` |
| `EquipmentPopover` | inline in MovementRow | Tap-to-edit equipment | YES → `components/today/EquipmentPopover.tsx` |

Similar inline-defined components exist in `today/workout/page.tsx` (1170 lines), `plan/page.tsx` (554 lines), `movements/page.tsx` (675 lines), and `history/page.tsx` (416 lines).

## Duplicate/overlapping logic

1. **Equipment options array** — defined in `engine/today.ts` as `EQUIPMENT_OPTIONS` AND inline in `MovementRow` JSX (`["unspecified","barbell","dumbbell","cable","machine","bodyweight"]`)
2. **Date string helpers** — `localDateStr()` exists in `today/page.tsx` but probably similar logic exists in `engine/today.ts` and other pages
3. **Theme toggle logic** — implemented only in `today/page.tsx`; other pages won't react to theme changes properly
4. **Movement display logic** — `MovementCard.tsx` vs inline `MovementRow` vs `MovementPickerSheet`'s item renderer — three separate impls of "render a movement"

---

# 6. Product logic documentation

## Identity rules (CRITICAL — preserve these)

Every workout entry carries:
- `canonicalMovement` — stable identity across renames
- `equipmentType` — "barbell", "dumbbell", "cable", "machine", "bodyweight", "unspecified"
- `variant` — "Incline", "Decline", "Weighted", etc.

PRs, progression history, and recommendations key on the **(canonicalMovement, equipmentType, variant)** triple. **NEVER** key on just `name` — renames would destroy history.

## Set value semantics

`hasV(v) => v != null && v !== ''` — the canonical "has value" predicate. Empty strings count as empty. Use this everywhere, never `v != null` alone.

A `SetEntry` looks like:
```ts
{
  weight?, reps?, rpe?, done,
  warmup?,    // tagged separately, excluded from progression
  bw?,        // bodyweight toggle — modifies weight semantics
  time?, distance?, incline?, speed?, bpm?,  // cardio/mobility
  prevW?, prevR?, prevRpe?, prevTime?, prevBW?,  // prior session reference (for autofill)
  baseline?,  // true if seeded from prior session and not yet touched
}
```

## Today filtering logic

`filterTodaysPlan(plans)` filters by `p.dow === new Date().getDay()`. Sun=0, Sat=6.

`buildTodayItems({planItems, activeEntries, finishedToday, mvMap, hiddenPlanIds, sessionDoneToday})`:
1. Computes `finishedMids` — set of movement IDs that have at least one done set in any finished workout today
2. Builds `allItems` = (planItems not in finishedMids, not in hiddenPlanIds) + (adhocEntries whose planId doesn't match any plan ID)
3. Splits into `remaining` vs `completed` based on:
   - `done === total` → completed
   - `sessionDoneToday && done === 0` → completed (skipped)
   - else → remaining
4. Pulls in history-sourced completed movements from `finishedToday` for movements not already seen

## Day stats calculation (`calcDayStats`)

Returns `{totalSets, doneSets, totalVolume, avgRpe, completePct, volumeByPart, planMinutes, totalMovements}`.

Volume = `weight × reps` summed across all done strength sets.
Avg RPE = mean of `rpe` across all done sets where `hasV(rpe)`.
Plan minutes estimate: `5 + totalSets * 3 + max(0, totalMovements - 1) * 2` — 5min warmup + 3min/set + 2min/movement-transition. This formula is documented at `today.ts:208` as an upgrade from an older formula that under-estimated.

## RPE calibration (port from HTML build — implemented in `momentum.ts`)

The HTML build's `calibrateRpe` applies a downward correction based on the user's historical RPE-to-failure pattern. Trained lifters tend to overestimate proximity to failure; the engine compensates.

**Formula (confirmed in `lib/engine/momentum.ts`):**
```
calibrateRpe(rpe) = rpe - 0.4 - max(0, rpe - 6.5) × 0.3
```

Lower RPE values get a flat 0.4 reduction; values above 6.5 get an additional progressive correction. Net effect: a reported RPE 9 calibrates to ~7.85 effective.

`rpeToRir(rpe) = clamp(10 - rpe, 0, 6)` — Reps In Reserve from RPE.

## 1RM estimation

Blended Brzycki + Epley formulas with RPE sensitivity. Source in HTML build. Verify port in `momentum.ts` or `insightEngine.ts`.

## Fatigue calculation (in `momentum.ts`)

**Per-muscle, last 7 days:**
```
volume = min(setCount × 6.5, 100)
decay = decayFactor(daysSinceLastSession, isSmallMuscle)
fatigue% = volume × decay
```

**Decay factors:**
- Small muscles (biceps, triceps, calves, core): `1d=40%, 2d=15%, 3d+=0%`
- Large muscles (chest, back, shoulders, quads, hamstrings, glutes): `1d=65%, 2d=35%, 3d=15%, 4d+=0%`

**Overall fatigue:**
```
computeOverallFatiguePct = 60% × max(perMuscleFatigues) + 40% × avg(perMuscleFatigues)
```

## Readiness scoring

```
readiness = avg(calibrated-RIR-based score from last 5 sessions)
recovery = min(100, 50 + daysSinceLastSession × 16)
fatigue = computeOverallFatiguePct()

per-set score = clamp(40 + RIR × 6, 0, 100)
```

**Training recommendation thresholds:**
| Condition | Recommendation |
|---|---|
| fatigue ≥ 75% | "Heavy week — back off and deload" |
| fatigue ≥ 50% | "Trainable — but cap volume" / "Heavy week — keep it light" |
| readiness ≥ 78% | "Recovery strong — push today" |
| readiness ≥ 60% | "Solid baseline — train normally" |
| readiness ≥ 40% | "Mixed signal — keep it controlled" |

## Picker / fader config (in `workout.ts`)

```ts
const PICKER_CFG = {
  weight: { min: 0, max: 500, step: 5,   curve: 2 },
  reps:   { min: 1, max: 30,  step: 1,   curve: 1 },
  rpe:    { min: 1, max: 10,  step: 0.5, curve: 1 },
}
```

The `curve` controls fader sensitivity (higher = more compression at extremes).

## Daily AI headline

- `getDailyHeadline(fallback)` in `aiHeadline.ts`
- Hits localStorage cache first (`fitlog_headline_<dateString>`)
- Falls back to static pool (`todayHeadline()` in `engine/today.ts:44`) on any failure
- POSTs to Supabase Edge Function `ai-insights` with `{action: "headline"}`
- Function returns `{headline: string}`
- Function is **not currently deployed** — 401s in prod, fallback works

Static headline pool (`HEADLINES` array, today.ts:22):
```
"Let's work.", "Time to lift.", "Earn it.", "Run it back.",
"Stack the day.", "Move with intent.", "Stay sharp.", "Set the bar.",
"Train hard.", "Lift heavy.", "Add a plate.", "Beat last week.",
"Outwork yesterday.", "Lock in.", "Under the bar.", "Build the week."
```

Stable-per-day selection via hash of `new Date().toDateString()` mod array length.

## Equipment options

```
["unspecified", "barbell", "dumbbell", "cable", "machine", "bodyweight"]
```

## Default movement library (auto-seeded)

`seedDefaultMovements()` in `db.ts:152` seeds 26 default movements for new users (idempotent via `onConflict: "user_id,name"`):

```
Chest:    Bench Press, Incline Dumbbell Press, Cable Fly, Dips
Back:     Deadlift, Pull-Up, Barbell Row, Cable Row, Lat Pulldown
Shoulders: Overhead Press, Lateral Raise, Face Pull
Biceps:   Barbell Curl, Dumbbell Curl, Cable Curl
Triceps:  Tricep Pushdown, Skull Crusher, Overhead Tricep Extension
Legs:     Squat, Leg Press, Romanian Deadlift, Leg Curl, Hip Thrust, Calf Raise
Core:     Plank
Cardio:   Running
```

This list is the floor — users add custom movements on top.

## Tombstones

Per HTML build convention, deletions push the ID to `data.tombstones.{movements,plans,workouts}` so stale Supabase realtime fetches don't resurrect them. **Not yet implemented in Next.js build's `db.ts`** — verify.

## Auto-archive

The HTML build automatically archives completed movements into a saved workout row. The Next.js build's equivalent should be in `engine/workout.ts` — verify.

## Same-day session merge

Multiple sessions on the same date merge rather than create duplicate rows. This is critical to prevent the "where did my workout go?" class of bugs. **Verify implemented in Next.js build.**

---

# 7. UI / UX design system

## Locked palette (NEVER violate)

| Token | Value | Purpose |
|---|---|---|
| `--ink` | `#0f1622` | Primary text, primary borders |
| `--ink-2` | `#2c3548` | Gunmetal accent |
| `--muted` | `#5e6a82` | Secondary text |
| `--label` | `#8893a8` | Cool grey, faint labels |
| `--paper` | `#ffffff` | Primary surface |
| `--paper-2` | `#f4f5f7` | Secondary surface |
| `--paper-3` | `#eceef2` | Tertiary surface |
| `--accent` | `#5d9bb8` | Steel blue (primary brand) |
| `--accent-2` | `#7fa5c7` | Icy lavender-blue |
| `--accent-3` | `#9eb5cb` | Misty silver-blue |
| `--ok` | `#4f9aa8` | Cool teal (success/working set) |
| `--warn` | `#8e9bb0` | Slate |
| `--bad` | `#b08092` | Desaturated mauve (warmup/destructive) |

**Forbidden:** orange, neon green, electric blue, cyberpunk magenta, "fitness app" warm-orange palettes, gaming pastels. Per memory `feedback_visual_direction.md` and `decisions.md`.

## Brand gradient (locked)

```css
linear-gradient(155deg,
  rgba(93,155,184, A) 0%,    /* steel */
  rgba(155,130,200, B) 55%,  /* lavender */
  rgba(201,160,190, C) 100%  /* soft pink */
)
```
Same triplet across the app; only `(A, B, C)` alpha varies per surface tier.

## Light mode palette (workout-alt warm gray)

Activated via `body.theme-light`:

| Token | Value |
|---|---|
| Body bg | `#b8b4ae` |
| Phone/page bg | `radial-gradient(at 30% 0%, #e0dbd4 0%, #d4cfc8 45%, #c8c3bc 100%)` |
| Primary text | `#1a1814` |
| Chassis/panels | `#cac5be` |
| Pad button | `linear-gradient(145deg, #d8d3cc, #c8c3bc, #b8b3ac)` |

## Dark mode (current default)

`body.theme-dark` baked into `<body>` in `layout.tsx`. Activates dark token overrides.

**KNOWN DEFECT (per `pm/handoff.md` 2026-05-23):** The Today page is reported as still defaulting to light mode on hard refresh despite the server-rendered `theme-dark` class. Root cause unidentified. Possible candidates:
- CSS module `:global(body.theme-dark)` selectors having lower specificity than expected
- A `useEffect` in `today/page.tsx:88–91` toggling classes based on `localStorage` may race with hydration
- Browser cache serving an older CSS bundle
- The `.page { position: fixed }` change may have unintentionally moved the page background out of the body's theme-class scope

## Typography scale (8 sizes)

```
--text-eyebrow: 12px   (mono uppercase labels — dominant micro-text)
--text-xs:      11px
--text-sm:      12px
--text-base:    13px
--text-md:      14px
--text-lg:      15px
--text-xl:      18px
--text-2xl:     22px
--text-3xl:     28px
--text-display: 34px
```

## Weight ladder

```
--weight-normal:    400
--weight-medium:    500
--weight-semibold:  600
--weight-bold:      700
--weight-heavy:     800
```

## Tracking + leading

```
--track-tight:   -0.018em  (display)
--track-normal:  -0.005em  (body)
--track-eyebrow:  1.5px    (mono caps)

--leading-tight:  1.1
--leading-snug:   1.25
--leading-normal: 1.45
```

## Fonts

- **Display:** Inter Tight (currently DM Sans in tailwind.config — verify; was changed at some point)
- **Text:** system-ui + SF Pro + Inter Tight fallback
- **Mono:** Geist Mono / JetBrains Mono — for eyebrows, set numbers, prev/today data, DSEG-style LCD readouts

## Elevation

- `--depth-1` — chips, control backgrounds, list rows (barely lifted)
- `--depth-2` — sub-cards, stat rows (clearly elevated)
- `--depth-3` — hero cards, modals (primary elevation, uses `--glass-shadow`)

## Hairlines

All separators are **1.2px** (not 1px) per the 2026-05-13 thickness pass.

- `--hairline: rgba(15,22,34,0.25)` — visible separators
- `--hairline-soft: rgba(15,22,34,0.11)` — quiet dividers
- `--hairline-strong: rgba(15,22,34,0.20)` — emphatic dividers

## Border-radius scale

- Pills: `999px`
- Chips/buttons: `6–12px`
- Cards: `14–22px`
- Hero glass cards: `22px` or `24px`
- Nav pads: `3px`
- Toolbar buttons: `5px`

## Motion register

- Duration: **150–300ms** for UI animations
- Easing: `var(--ease-out-cubic)` or `var(--ease-premium)` for interactive feedback
- **Forbidden:** `linear` on UI, durations >500ms
- Tap-feedback: `transform: scale(0.94–0.97)` on `:active` — required on every interactive control
- No external animation library (per memory `reference_animation_libraries.md`)

## Button & panel lighting (workout-alt cassette — locked 2026-05-20)

Buttons use **matte black with angled rim-light** (Option B from the nav-lighting study):

```css
background: linear-gradient(145deg, #4a4a4e 0%, #38383c 35%, #28282c 100%);
border: 1px solid #111113;
box-shadow:
  inset 1.5px 1.5px 0 rgba(255,255,255,0.20),
  inset 0 1px 0 rgba(255,255,255,0.12),
  inset -1px -1.5px 0 rgba(0,0,0,0.65),
  inset 0 -2px 5px rgba(0,0,0,0.45),
  3px 8px 16px rgba(0,0,0,0.85),
  1px 3px 6px rgba(0,0,0,0.65);
```

Rules:
- NEVER change buttons to flat black (`#141618`) or a plastic gradient without explicit user instruction
- Active/pressed: `transform: translateY(1px)` + reduced drop shadow
- Idle text/icon: `rgba(245,245,240,0.65)`
- Active glow: yellow (`var(--yellow)`) or red (`#FF3D3D`) by context
- Chassis (outer frame) uses flat matte black `#161618` — lighting is for buttons only

## Icon system

All icons are **inline SVG**. No icon library. This is deliberate — total visual control, zero bundle cost.

## Navigation philosophy

- 4 tabs max (Apple HIG recommendation for bottom nav)
- Canonical IA: **Today / Plan / Momentum / More**
- More overflow tab absorbs: Library, Settings, History, Insights detail screens
- Active tab: red LED dot, red glow on icon, pulse animation

## Mobile responsiveness

- Page constrained to **430px max-width**, centered with `margin: auto`
- Uses `dvh` not `100vh` (per `launch-quality.md §4`)
- Safe areas respected via `env(safe-area-inset-*)`
- Touch targets ≥ 44×44px, ≥ 8px gap

## Accessibility (per `launch-quality.md`)

- Text contrast ≥ 4.5:1 body, ≥ 3:1 large text
- Focus rings on every interactive element
- No info by color alone — pair with icon/text
- Every input has a real `<label>`
- Icon-only buttons have `aria-label`
- `prefers-reduced-motion` should be honored — **not currently audited**

---

# 8. Known bugs & debugging postmortem

## CRITICAL: Active workout from previous day bleeding into Today

**Symptom:** User reports "Dumbbell Bicep Curls" appearing on Today page when nothing was planned for today.

**Root cause:** `today/page.tsx:113` used `new Date().toISOString().slice(0, 10)` (UTC date) to compare against `candidate.date`. A workout started at 8 PM EST = 1 AM UTC = next UTC day. In timezones west of UTC, an evening session is "tomorrow" by UTC measure. The `isFromToday` check failed correctly in one direction but allowed yesterday's UTC date to match today's UTC date when local crossed midnight differently.

**Fix:** 2026-05-23 (commit `c5cbccb`) — added `localDateStr()` helper using `getFullYear/getMonth/getDate` and compared against `localDateStr(new Date(candidate.date))`. The fix worked for new sessions; **stale rows from before the fix may still appear** until cleared.

**Status:** FIXED for new data. RESIDUAL: existing bad rows in Supabase.

**Confidence:** HIGH that the fix is correct. MEDIUM that all date-comparison sites have been audited.

## CRITICAL: Theme-dark not defaulting on page load

**Symptom (reported 2026-05-23):** Today page still renders in light mode on hard refresh / fresh visit, despite `theme-dark` baked into `<body>` in `layout.tsx`.

**Attempted fixes:**
1. Added `theme-dark` to body className in `layout.tsx` (server-rendered, no JS needed) — should work
2. Forced `theme-dark` via `useEffect` in Today page mount — should work
3. Made `localStorage` default to `"dark"` if no value stored — should work

**What might still be wrong:**
- CSS module specificity: `body.theme-dark .page` may lose to `:global(body.theme-light) .page` if both exist with similar specificity
- The `position: fixed` change to `.page` may have isolated it from the body's theme context (unlikely — `position: fixed` elements still inherit from `<body>`)
- Browser cache serving an older bundle (the deploy on 2026-05-22 was BEFORE the inline-nav restructure — the production site is missing the latest fixes)
- A computed style is overriding the theme class

**Status:** UNRESOLVED. The PRODUCTION SITE was last deployed at commit `a201821` and is missing the most recent fixes. Redeploying may resolve it.

**Confidence:** LOW — multiple attempted fixes have not satisfied the user.

## CRITICAL: BottomNav width incorrect on desktop / tablet

**Symptom:** On iPad / desktop viewports, the BottomNav appears to span "full width" rather than being constrained to the 430px mobile column.

**Root cause:** Original implementation used `position: fixed; max-width: 398px` which positions relative to the viewport, not the page column. On 820px iPad with a 430px page column, the nav at 398px was correctly centered in the viewport but visually disassociated from the content above it.

**Attempted fixes:**
1. Tried adjusting max-width — no visible change
2. (2026-05-23, commit `a201821`) Restructured: `.page` became `position: fixed; inset: 0; max-width: 430px; margin: auto`, BottomNav moved inside as `<BottomNav inline />`, scrollable content wrapped in `.scrollContent`, nav in `.navWrap` flex-shrink: 0 at the bottom of the flex column

**Status:** User reports it's "still acting like desktop mode" as of 2026-05-23. The fix is committed but the PRODUCTION DEPLOY is from BEFORE this fix. Redeploying should resolve it. If it persists after redeploy, the fix is wrong.

**Confidence:** MEDIUM that the architecture is right (it matches workout-alt.html's structure). LOW that the user has seen the latest code on production.

## HIGH: 401 Unauthorized from ai-insights edge function

**Symptom:** Console shows `POST .../functions/v1/ai-insights → 401 (Unauthorized)` twice per page load.

**Root cause:**
1. The edge function isn't deployed (or is deployed but auth is misconfigured)
2. React 18 strict-mode runs `useEffect` twice in dev, causing two identical 401s

**Fix:** 2026-05-22 (commit `cae4fb1`)
- In-flight promise dedup — second call reuses the first
- Guard against missing env vars (skip the call entirely if no Supabase URL/key)
- Graceful fallback to static headline pool was already in place

**Status:** FIXED (no more console noise). The underlying issue (edge function not deployed) remains. Headlines fall back to the static pool.

**Confidence:** HIGH for the fix. The edge function deployment is a separate task.

## MEDIUM: Hardcoded white text invisible in light mode

**Symptom:** Status text ("Loading…", "Nothing remaining.", `—` dash placeholders) hardcoded as `rgba(255,255,255,...)` inline styles in `today/page.tsx`. Invisible in light mode.

**Fix:** 2026-05-23 (commit `4098c00`) — extracted to CSS classes (`.loadingState`, `.errorState`, `.nothingRemaining`, `.mutedDash`) with `body.theme-light` overrides.

**Status:** FIXED. Other pages may still have similar inline hardcoded colors — audit `plan/page.tsx`, `momentum/page.tsx`, etc.

## MEDIUM: `react-odometerjs` build failure

**Symptom:** Production build failed because `react-odometerjs` wasn't in `package.json`.

**Fix:** 2026-05-22 — `npm install react-odometerjs`. CSS file `/odometer-train-station.css` already in `public/` and referenced in `layout.tsx`.

**Status:** FIXED but FRAGILE. The component depends on a CSS file loaded by manual `<link>` tag. Reconsider this dependency.

## MEDIUM: Browser cache serving stale CSS during dev iteration

**Symptom:** Multiple times this session, user reported "I don't see the change" when changes were committed and the dev server was restarted.

**Root cause:** Browser aggressively caches CSS modules across Next.js dev rebuilds. Hard reload doesn't always clear it.

**Workaround:** "Empty Cache and Hard Reload" in Chrome DevTools, or use Incognito.

**Status:** WORKAROUND ONLY. No fix attempted (this is browser behavior, not app code).

## LOW: Stop hook git check warning about untracked files

**Symptom:** Bash hook reports "There are untracked files in the repository."

**Root cause:** `.netlify/` directory created by netlify-cli during deploy attempts.

**Fix:** Added to `.gitignore` (commit `e8d9764`).

**Status:** FIXED.

## Patterns observed: AI-generated fixes creating instability

1. **Iterative CSS additions without removing old rules** — `TodayPage.module.css` is 1739 lines because every aesthetic pivot added new rules without deleting old ones
2. **Inline JSX instead of extracted components** — Components grew because adding-inline is easier than extracting; over a few sessions, `today/page.tsx` ballooned to 871 lines
3. **Theme rules added per-class instead of holistically** — 130+ `body.theme-light` overrides instead of restructuring the base styles to be theme-neutral
4. **Hardcoded colors in JSX** — quick-fix pattern (use `style={{color: ...}}` instead of a CSS class) created the invisible-text bug
5. **Position: fixed vs inline** — the fix was correct but required redoing the page structure; required restructuring four other files (layout.tsx, NavGuard, BottomNav.tsx, TodayPage.module.css) to land cleanly
6. **Conflating "code change committed" with "fix verified"** — multiple times this session, fixes were marked done before the user confirmed visually. The user explicitly asked for this to stop (2026-05-23): "dont not mark it as done going forward until I verify and confirm"

---

# 9. Technical debt audit

## CRITICAL

### Monolithic page components

- `src/app/today/page.tsx` — 871 lines, 5+ inline components
- `src/app/today/workout/page.tsx` — 1170 lines
- `src/app/plan/page.tsx` — 554 lines
- `src/app/movements/page.tsx` — 675 lines
- `src/app/today/TodayPage.module.css` — 1739 lines (mix of base + theme overrides + dead rules)
- `src/app/today/workout/WorkoutPage.module.css` — 1263 lines

**Impact:** Hard to find anything, AI agents pile changes on top, CSS specificity becomes unpredictable, theme-mode bugs become unresolvable.

**Migration:** Extract inline components into `src/components/<page>/<Component>.tsx`. Split CSS modules per component. Target ~300 lines max.

### Schema mismatch (db.ts vs schema.sql)

`schema.sql` is documented as stale but never replaced. Anyone reading docs first will be misled.

**Impact:** Onboarding confusion, migration risk if anyone runs `supabase db push`.

**Migration:** Generate a fresh canonical migration from the actual production schema. Delete or version the old `schema.sql`.

### No offline write queue / retry / error surfacing

`upsertWorkout()` silently fails on network error with a `console.warn`. The user has no idea their data didn't save.

**Impact:** Data loss in poor-connectivity scenarios (the literal context of a gym app).

**Migration:** Implement a write queue with retry, toast notifications on failure, offline indicator in UI.

### Dual auth keying (user_id + device_id)

Some tables use `auth.uid()` RLS, others use `device_id` filtering. The `getIdentifier()` bridge works but creates ambiguity.

**Impact:** When auth launches (Phase 8), this will be a complex migration. Could lose data if migration script has a bug.

**Migration:** Pick one model and convert. Likely: `device_id` until launch, then atomic migration to `user_id` with `adoptDeviceRowsIfNeeded()`.

## HIGH

### Theme system is fragmented

- `body.theme-dark` baked in `layout.tsx`
- `body.theme-light` toggled by `today/page.tsx useEffect`
- Other pages don't manage theme state — they inherit body class but don't react to changes
- CSS modules have 130+ theme-light override rules per-class instead of base styles being theme-neutral
- Hardcoded white colors in JSX as inline styles

**Migration:** Restructure CSS to use semantic tokens (`color: var(--text-primary)`) that themes redefine, rather than per-class overrides.

### Dead/dormant components in tree

`MovementCard.tsx`, `MovementsManager.tsx`, `ProgressView.tsx`, `ProgressChart.tsx`, `Nav.tsx`, `AuthForm.tsx` — most are not actively routed but contribute to bundle size and confuse readers.

**Migration:** Audit imports. Delete unreferenced files.

### No tests

Engine logic in `lib/engine/today.ts`, `workout.ts`, `insightEngine.ts` is pure and testable but has zero tests. Any change risks regression.

**Migration:** Add Vitest. Test the canonical engine functions first (the things ported from HTML build that have documented behavior contracts).

### Multiple sources of truth for "render a movement"

`MovementCard.tsx`, inline `MovementRow` in today page, `MovementPickerSheet` item renderer — three different implementations.

**Migration:** Extract a canonical `<MovementSummary>` component variants pattern.

## MEDIUM

### `react-odometerjs` + manual CSS link

Fragile dependency requiring an externally-loaded CSS file. Broke a build.

**Migration:** Replace with a custom CSS-only animated counter (~50 lines).

### Hardcoded localStorage keys

`fitlog_device_id`, `fitlog_migrated_uid`, `fitlog_headline_*`, `hiddenPlanIds_*`, `incyte-theme` — sprinkled across files with no central constant.

**Migration:** `lib/storage.ts` with typed key constants and getters/setters.

### No data validation (Zod or similar)

Database rows go through ad-hoc `rowToWorkout` / `rowToMovement` / `rowToPlan` functions with weak fallbacks. A malformed row could crash a render.

**Migration:** Adopt Zod for runtime validation at the data boundary.

### CSS module specificity wars

`:global(body.theme-dark) .scoped` is fragile; CSS module local names + global selectors mix unpredictably. The `:global()` wrap appears 100+ times in TodayPage.module.css.

**Migration:** Either go full CSS modules (no `:global`), or move theme overrides to globals.css and use semantic tokens.

### Inline equipment options array

`["unspecified","barbell",...]` is defined both in `engine/today.ts` as `EQUIPMENT_OPTIONS` and inline in JSX. Drift risk.

**Migration:** Single source in engine, import everywhere.

## LOW

### Console.warn instead of structured logging

Every error is `console.warn`. Hard to filter, no metadata.

**Migration:** Tiny logger wrapper, even if it just adds level prefix and timestamp.

### Stop hook git check noise

Untracked files create noise in the dev loop. Already mostly fixed.

### No service worker / PWA manifest

Per backlog `F-07`, superseded by Capacitor decision. Revisit only if PWA fallback becomes the path.

### Tailwind underused

Most styling is in CSS modules; Tailwind utility classes are sparse. Either commit to one or the other.

---

# 10. Clean rebuild recommendation

## Ideal folder structure

```
src/
├── app/                          ← routes only, ≤100 lines each
│   ├── (auth)/login/page.tsx
│   ├── (auth)/auth/callback/page.tsx
│   ├── (app)/today/page.tsx
│   ├── (app)/today/workout/page.tsx
│   ├── (app)/plan/page.tsx
│   ├── (app)/momentum/page.tsx
│   ├── (app)/more/page.tsx
│   ├── (app)/layout.tsx          ← contains BottomNav, applies theme
│   ├── layout.tsx                ← shell only
│   └── globals.css
├── features/                     ← Feature-bounded components + logic
│   ├── today/
│   │   ├── components/
│   │   │   ├── SessionStats.tsx
│   │   │   ├── MovementRow.tsx
│   │   │   ├── LoggedStrip.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── *.module.css
│   │   ├── hooks/useTodayData.ts
│   │   └── engine/               ← Today-specific pure functions
│   ├── workout/
│   ├── plan/
│   ├── momentum/
│   └── more/
├── components/                   ← Truly shared UI primitives
│   ├── BottomNav/
│   ├── ThemeToggle/
│   ├── MovementPickerSheet/
│   ├── Sheet/                    ← Generic bottom sheet
│   ├── Button/
│   ├── Chip/
│   └── Icon/
├── lib/
│   ├── db/
│   │   ├── client.ts             ← Supabase browser client
│   │   ├── workouts.ts           ← Per-entity query files
│   │   ├── movements.ts
│   │   ├── plans.ts
│   │   └── schema.ts             ← Zod schemas matching DB shape
│   ├── auth/
│   ├── storage/                  ← Typed localStorage wrapper
│   ├── theme/                    ← Theme provider, token resolver
│   ├── date/                     ← Local-vs-UTC date helpers, named explicitly
│   └── sync/                     ← Offline queue, retry, optimistic updates
└── engine/                       ← Pure business logic, zero DOM/React
    ├── identity.ts               ← canonicalMovement, equipment, variant
    ├── sets.ts                   ← SetEntry helpers (hasV, etc.)
    ├── rpe.ts                    ← calibration
    ├── progression.ts            ← 1RM, next-set recommendations
    ├── fatigue.ts                ← computeOverallFatiguePct
    ├── stats.ts                  ← calcDayStats
    └── __tests__/                ← Vitest, one file per engine file
```

## State management

- React state for transient UI (modals, popovers, input focus)
- React Query (`@tanstack/react-query`) for server data — handles caching, retries, optimistic updates, offline support
- Zustand for cross-route state (theme, device ID, sync status) — small footprint, no boilerplate

## Caching strategy

- React Query owns server cache
- `staleTime: 30s` for movements/plans, `0` for active workout
- `localStorage` persistence for offline reads via `persistQueryClient`

## Local-first / sync strategy

- Use IndexedDB (not localStorage) for actual workout data — quota is in GB not 5MB
- Write-through: write locally first, queue sync to Supabase
- Background sync via service worker (or just retry in a useEffect for Capacitor)
- Conflict resolution: last-write-wins for now, surface conflicts in a "Sync issues" log
- Use Supabase Realtime to detect remote changes during active sessions

## Supabase architecture

- **Single source of truth schema in version-controlled migrations** (`supabase/migrations/*.sql`)
- Pick ONE keying model: `auth.uid()` everywhere
- For pre-launch: use Supabase anonymous auth (a real auth flow with no signup form) — every device gets a real user_id, RLS just works
- Normalize the schema: `workouts` + `workout_entries` (separate table), not inline jsonb. Easier to query, easier to validate.
- Add RLS policies for every table
- Add proper indexes: `(user_id, date DESC)` on workouts, `(workout_id, position)` on entries

## Deployment

- **Production:** Netlify (current setup is fine)
- **Auto-deploy from `main` branch** on every push (link the GitHub repo properly)
- **Preview deploys** for every PR (Netlify does this by default)
- **Capacitor wrap:** when launching to App Store

## Git workflow

- `main` is production
- Feature branches per task, PR'd to main
- No long-lived feature branches (>1 week)
- Squash-merge to main (clean history)

## AI integration

- Edge Functions for any AI call (never expose API keys client-side)
- All AI features have a deterministic rules-based fallback
- Cache aggressively in localStorage (or IndexedDB) — AI calls cost money
- Surface AI vs rules in the UI subtly (a small "AI" badge when fresh)

## Component structure

- ≤300 lines per component
- One component per file
- Co-locate CSS module with component (`Foo.tsx` + `Foo.module.css`)
- Pages should mostly compose, not render

## Phased rebuild plan (if doing a full rebuild)

| Phase | Deliverable | Effort |
|---|---|---|
| 0 | Repo setup, tooling, CI, deploy pipeline | 1 day |
| 1 | Auth (anonymous + Supabase) | 1 day |
| 2 | Schema + migrations + Zod validators + db layer | 2 days |
| 3 | Engine — port pure functions from HTML build, with tests | 3 days |
| 4 | Design system — tokens, base components (Button, Chip, Sheet, Icon) | 2 days |
| 5 | BottomNav + page shell + theme provider | 1 day |
| 6 | Today page (extracted components, proper structure) | 3 days |
| 7 | Workout mode | 4 days |
| 8 | Plan editor | 2 days |
| 9 | Momentum + Insights | 3 days |
| 10 | More tab (library, settings, history) | 2 days |
| 11 | Offline sync + retry + error surfacing | 2 days |
| 12 | Capacitor wrap + iOS Project + App Store assets | 3 days |
| **Total** | | **~30 days solo** |

## MVP order of operations (when shipping)

1. Schema + db
2. Engine (with tests)
3. Auth (anonymous)
4. Today page (read-only first)
5. Workout mode (full logging)
6. Sync + offline
7. Plan editor
8. More tab basics (history at minimum)
9. Momentum / insights
10. App Store wrap

## Dependencies between systems

```
schema → db → engine → features → pages
auth → db (RLS)
sync → db + offline detection
theme → all pages (via provider)
```

---

# 11. Development rules for future Claude sessions

These rules supplement `CLAUDE.md`. Read both.

## NEVER do

1. **Never commit `console.log` to production paths.** Strip them or guard with `if (process.env.NODE_ENV !== 'production')`.
2. **Never deploy to Netlify without explicit user authorization.** (See `CLAUDE.md §11`.) "Ship it" is not authorization.
3. **Never mark a task complete before user confirms.** The user explicitly required this on 2026-05-23.
4. **Never inline a new component definition inside a page file.** Extract immediately.
5. **Never use `style={{color: ...}}` inline.** Always use a CSS class so it's theme-aware.
6. **Never use `toISOString().slice(0, 10)` for date comparisons.** Use local calendar dates (`getFullYear/getMonth/getDate`).
7. **Never hardcode colors, font sizes, spacing, shadows.** Use tokens.
8. **Never invent brand colors.** Palette is locked: steel-blue / lavender / soft-pink. Orange, neon, gaming pastels are forbidden.
9. **Never claim a fix worked without verifying.** "Compiled successfully" ≠ "renders correctly."
10. **Never silently catch errors.** Surface them to the user.
11. **Never key on movement name alone.** Use (canonicalMovement, equipmentType, variant).
12. **Never use `v != null` for set values.** Use `hasV(v) => v != null && v !== ''`.
13. **Never push `--force` or rewrite history without explicit instruction.**
14. **Never mutate Supabase schema without a migration file.**
15. **Never add a dependency without checking React Native compatibility** (Capacitor wraps a web view but the long-term path may include RN).
16. **Never duplicate business logic across files.** Extract to `lib/engine/`.
17. **Never use `position: fixed` for elements that should be constrained to the mobile column.** Use the flex-column-with-inline-nav pattern from workout-alt.

## ALWAYS do

1. **Always read `pm/decisions.md` before re-litigating any settled question.**
2. **Always run on localhost first.** Production deploys require explicit user request.
3. **Always state what changed in user-facing text** after a tool call. "Edited foo.css" not silent.
4. **Always cite source line numbers when porting from the HTML build.** `// Source: fitlog-mobile.html:13212`
5. **Always test with hard refresh + incognito after CSS changes.** Browser cache is your enemy.
6. **Always extract inline components when a file exceeds 500 lines.**
7. **Always handle the empty/loading/error states for any data-fetching component.**
8. **Always use semantic CSS variables for colors that need theme support.**
9. **Always check whether a fix is *visible to the user* before claiming success.**
10. **Always commit incrementally with clear messages.** One concern per commit.

## Common AI mistakes to avoid

1. **Adding CSS rules instead of fixing root cause.** If light mode is broken, audit the base styles before piling on `body.theme-light` overrides.
2. **"Just install another package."** Question every new dep against React Native compat and bundle size.
3. **Generating fake fixture data.** Use real Supabase data or empty states.
4. **Over-abstracting.** Don't write a generic `<Card>` component when you need three specific card types.
5. **Conflating "compiled" with "working."** Type checks don't verify behavior.
6. **Saying "fixed!" when the user can't see the change.** Always assume browser cache until proven otherwise.

## Debugging rules

1. Before claiming a fix worked, run it through: (a) localhost, (b) incognito window, (c) wait for user confirmation
2. If a CSS rule isn't applying, check specificity ladder first, then check compiled output, then check browser cache
3. If a query returns wrong data, log the actual query and the raw response — don't guess
4. If hydration mismatches happen, the server and client must render IDENTICAL HTML on first paint
5. Reproduce locally before pushing any "fix"

## Deployment rules (from CLAUDE.md §11, reinforced)

- Default to localhost
- Never deploy without explicit user instruction containing the word "deploy"
- Before any deploy, state the target site in chat
- Only deploy to `incyte13.netlify.app` (site ID `3b186e5f-3f0b-422c-be12-6d4d0f9f8b28`)
- Always `npm run build` first to regenerate `out/`

---

# 12. Rebuild priority roadmap

## What to rebuild first (immediate, in order)

1. **`src/app/today/page.tsx` → extracted components**
   Impact: HIGH. The most-touched file. Every future bug touches it. Extracting SessionStats, MovementRow, LoggedStrip, LoggedDetailSheet, EmptyState to dedicated files unblocks all other Today work.

2. **`src/app/today/TodayPage.module.css` → restructure theme handling**
   Impact: HIGH. Currently has 130+ theme overrides because the base styles aren't theme-neutral. Refactor base styles to use CSS variables; themes redefine variables.

3. **Offline write queue + error surfacing in `db.ts`**
   Impact: HIGH. Single largest reliability risk. Until this exists, every "where did my data go?" report is unanswerable.

4. **Schema canonicalization**
   Impact: HIGH. Delete `schema.sql`. Generate fresh migrations matching production. Add Zod validators. Pick one keying model.

5. **Tests for `lib/engine/*`**
   Impact: HIGH. The engine is pure and testable. Tests would catch regressions during the inevitable next refactor.

## What can be migrated later

- Workout mode page restructure (after Today proves the pattern)
- Plan editor cleanup
- Movements library page
- Momentum charts (likely needs a redesign anyway)

## What should be frozen

- Brand palette (locked, never change)
- IA: Today / Plan / Momentum / More (locked)
- Voice register (locked)
- Engine math (port behavior, don't re-derive)
- workout-alt.html as visual source of truth

## What should be discarded

- `MovementCard.tsx` (legacy)
- `MovementsManager.tsx` (legacy)
- `ProgressView.tsx`, `ProgressChart.tsx` (legacy)
- `Nav.tsx` (superseded by BottomNav)
- `supabase/schema.sql` (stale, replace with canonical migrations)
- Numbered HTML snapshots in `src/mobile{NNN}.html` (archive, don't actively maintain)
- `react-odometerjs` (replace with custom CSS counter)

## What can be reused directly

- `BottomNav.tsx` + module CSS (recently stabilized, well-isolated)
- `MovementPickerSheet/*` (properly extracted)
- `lib/engine/today.ts` (pure, testable, traceable)
- `lib/types.ts` (well-documented domain types)
- `tailwind.config.ts` (locked tokens)
- `globals.css` token definitions
- All `pm/*.md` documents
- `workout-alt.html` as design reference

## Milestone phases (if doing surgical rebuild rather than full rewrite)

| Phase | Goal | Effort | Risk |
|---|---|---|---|
| 1 | Extract Today page components | 1 day | LOW |
| 2 | Restructure Today CSS for theme parity | 1 day | MEDIUM |
| 3 | Add offline queue + error toasts | 2 days | MEDIUM |
| 4 | Canonicalize schema + Zod validators | 2 days | HIGH (data migration) |
| 5 | Add Vitest, test engine functions | 1 day | LOW |
| 6 | Extract Workout mode components | 2 days | LOW |
| 7 | Delete dead components, audit imports | 0.5 day | LOW |
| 8 | Replace react-odometerjs | 0.5 day | LOW |
| 9 | Audit hardcoded colors site-wide | 0.5 day | LOW |
| 10 | Standardize date helpers (no UTC slip) | 0.5 day | LOW |

**Total surgical rebuild:** ~10 days solo. Preserves all working logic; addresses the worst stability risks.

## Critical-path systems (must work before launch)

1. Auth (or anonymous auth via Supabase) — gated by App Store requirement
2. Reliable workout persistence (with offline + error surfacing)
3. Today + Workout mode flow end-to-end
4. Plan editor (to put movements on days)
5. History view (to verify saved data)

Everything else (Momentum, insights, library CRUD) is launch-nice-to-have.

---

# 13. Final engineering assessment

## Is the current codebase salvageable?

**Yes, with surgery.** Estimate ~60% should be preserved, ~25% refactored, ~15% deleted.

The bones are good: types are clean, engine functions are pure, tokens are locked, components like BottomNav and MovementPickerSheet are well-extracted. The PM documentation is exceptional — `decisions.md`, `nextjs-port-plan.md`, `launch-quality.md`, the visual-direction memory files contain serious thinking that a rebuild would have to recreate from scratch.

The rot is concentrated in three places:

1. **The Today page complex** (`today/page.tsx` + `TodayPage.module.css` + `today/workout/page.tsx` + module CSS = ~5,000 lines across 4 files) — monolithic, repeatedly patched, mixes multiple aesthetic eras
2. **The data layer** (`db.ts` + `schema.sql`) — dual-keying inconsistency, no offline support, no validation, stale documented schema
3. **Theme handling** — base styles aren't theme-neutral; light mode is 130+ override rules instead of a parallel implementation

## What percentage should be preserved?

**~60% preserved** (engine, types, tokens, BottomNav, MovementPickerSheet, design system, PM docs, schema as it actually exists in prod)

**~25% refactored** (Today + Workout pages, db.ts, theme CSS)

**~15% deleted** (legacy components, stale schema.sql, fragile odometer dep, hardcoded inline styles)

## Highest-risk systems

1. **Persistence layer** — no offline queue, silent failures, no error surfacing. This is a gym app. Users will lose data.
2. **Theme defaulting** — currently broken (light mode appears on hard refresh despite dark being intended default)
3. **Schema documentation drift** — `schema.sql` says one thing, code does another, plans table not in any schema file
4. **Date handling** — partial fixes for UTC/local mismatches; some sites still use UTC

## Strongest parts of the current implementation

1. **PM documentation** — `decisions.md`, `nextjs-port-plan.md`, `launch-quality.md`, `CLAUDE.md` are unusually rigorous for a solo project
2. **Engine functions** — `today.ts`, `insightEngine.ts`, etc. are pure, well-commented, traceable to the HTML build
3. **Type system** — `lib/types.ts` is intentional and self-documenting
4. **Design tokens** — locked, comprehensive, mirrored across Tailwind + CSS variables
5. **`workout-alt.html`** — a coherent visual prototype that informs every subsequent design decision
6. **`BottomNav` and `MovementPickerSheet`** — examples of how the codebase should look

## Biggest architectural mistakes

1. **Inline component definitions in page files.** The Today page grew from <300 lines to 871 because adding inline was easier than extracting. This is the source of most theme/styling/CSS specificity bugs.
2. **CSS modules with `:global(body.theme-*)` overrides per-class.** This pattern doesn't scale. Should have used CSS variable indirection from the start.
3. **Stale `schema.sql` left in the tree.** Should have been replaced or deleted when the HTML schema took over.
4. **No tests on the engine.** A pure-function library with zero tests is a regression waiting to happen.
5. **No offline write queue.** Catastrophic for a gym app.
6. **Two coexisting builds in one repo** (HTML + Next.js) — confusing for contributors; should be split into separate repos or one retired.

## Biggest product strengths

1. **Voice and audience discipline.** The "calm mirror not hype reel" positioning is well-defended in documentation and rarely violated in implementation.
2. **Identity-stable data model.** (canonicalMovement, equipmentType, variant) prevents the rename-destroys-history bug that plagues other fitness apps.
3. **Locked palette + design tokens.** Visual consistency is enforced at the token layer.
4. **PM rigor.** Decisions don't get re-litigated session-to-session because they're written down.
5. **Workout-alt.html prototype.** A coherent visual direction (cassette/MPC) that differentiates from generic SaaS aesthetics.

## Recommended path forward

**Recommended: SURGICAL REFACTOR, not full rebuild.**

A full rewrite would discard:
- 870+ lines of well-tested engine logic
- The locked design system
- The PM documentation and decision history
- Working features (Plan editor, History, Momentum sketch)
- 30+ hours of design iteration on workout-alt

A surgical refactor in the order described in §12 would:
- Stabilize the three known-bad areas (Today complex, db layer, theme)
- Preserve every working surface
- Add tests so future changes are safer
- Take ~10 days vs ~30 for a full rebuild

**The exception:** if the user wants to switch to React Native (not just Capacitor wrap), then rebuild. The current implementation has DOM-coupled assumptions in the UI layer (CSS modules, position: fixed, etc.) that don't translate to RN's StyleSheet model. The engine layer (`lib/engine/*`) would port directly.

## Recommended rebuild philosophy

1. **Preserve the engine.** It's pure, it's documented, it's tested-by-use in the HTML build.
2. **Rebuild the data layer first.** Offline queue + error surfacing + schema canonicalization, before any UI work.
3. **Extract components before refactoring them.** Moving inline-defined components to dedicated files is risk-free and unblocks all subsequent work.
4. **Restructure CSS theme handling before adding new pages.** The 130-override pattern will repeat on every new page if the base isn't fixed.
5. **Test the engine.** It's the most stable, most reusable, most ported code — and has zero coverage. Add tests *before* any refactor.
6. **Don't redesign while refactoring.** Lock the workout-alt aesthetic. Only fix bugs and structure during this phase.

## Key warnings for future development

1. **Browser cache will lie to you.** Always test in Incognito after CSS changes. Always run `rm -rf .next` before claiming a build is broken.
2. **The user has explicitly told AI agents to STOP claiming things are done before they're verified.** Honor this.
3. **Never deploy to Netlify without explicit authorization.** This rule was strengthened on 2026-05-23 in `CLAUDE.md §11`.
4. **The PM docs are the source of truth for decisions.** Don't re-litigate. If you disagree, propose an amendment in `decisions.md`, don't just override.
5. **The locked palette is locked.** Orange / neon / gaming colors are explicitly rejected in three places (memory, CLAUDE.md, decisions.md). Do not propose them.
6. **`workout-alt.html` is the visual source of truth.** Not `mobile351`. Not any abstract design system. When in doubt, open workout-alt.
7. **Dates are LOCAL, not UTC.** Any code using `toISOString().slice(0, 10)` for comparison logic is wrong.
8. **Empty string is empty.** Use `hasV(v) => v != null && v !== ''` for set values.
9. **Identity is (canonicalMovement, equipmentType, variant).** Never key on `name`.
10. **The user explicitly authorized two deploys this session.** Neither constitutes ongoing authorization. Future deploys require fresh authorization.

---

_Document version: 1.0_
_Compiled: 2026-05-23_
_Branch: `claude/lucid-archimedes-dfFQx` at commit `7e86dbf`_
_Production deploy: `incyte13.netlify.app` at commit `a201821` (3 commits behind HEAD)_

**This document supersedes any prior handoff for the purpose of rebuild planning. For onboarding / orientation, use `pm/handoff.md`. For decisions history, use `pm/decisions.md`.**
