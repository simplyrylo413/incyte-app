# INCYTE — Project Handoff Document

> Generated: 2026-05-15  
> Branch: `main`  
> Last milestone: **Phase 5 complete** — Momentum/Insights screen  
> Build status: ✅ `next build` passes, 0 TypeScript errors

---

## PROJECT OVERVIEW

**App name:** INCYTE  
**Tagline:** Progressive overload tracking for trained lifters.  
**Target users:** Trained lifters (intermediate–advanced) who want calibrated strength data, not motivation.  
**Core philosophy:** Clinical, direct, calibrated. Like a thoughtful coach who respects the user's time. Reject motivational filler, emoji punctuation, gaming/neon aesthetics.  
**Positioning:** Intentionally non-conventional — calm steel-blue vs. conventional orange/energetic fitness apps. Voice is close to a performance lab or medical dashboard.  
**Delivery path:** Web app now → Capacitor wrap → App Store at launch.  

### Feature overview
- **Today screen** — daily movement list from weekly plan, session-stats glass panel, remaining/completed toggle, grouped by body part
- **Workout Mode** — per-movement set logging: weight × reps × RPE, prev-session reference, rest timer, warmup/working toggle, bodyweight toggle, auto-archive on last set
- **Momentum/Insights** — Readiness · Recovery Map · Muscle Stimulus · PRs (4 collapsible glass hero cards)
- **Plan screen** — Phase 6 (stub only)
- **More screen** — Phase 7 (stub only; will absorb History, Library, Settings)

---

## CURRENT STATUS

### Completed phases
| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Scaffold reset — schema, types, db layer, device_id | ✅ Done |
| 1 | Design tokens — Tailwind config, globals.css, CSS variables | ✅ Done |
| 2 | Shell layout — BottomNav, layout.tsx, route stubs | ✅ Done |
| 3 | Today screen — session stats, movement list, tabs, ripple | ✅ Done |
| 4 | Workout Mode — set rows, picker sheet, rest timer, auto-archive | ✅ Done |
| 5 | Momentum/Insights — 4 hero cards, fatigue engine, PRs | ✅ Done |

### In progress / pending
| Phase | Description | Notes |
|-------|-------------|-------|
| 6 | Plan editor | Stub at `/plan`. Mon–Sun grid, add/edit/remove per day |
| 7 | More screen — History, Movement Library | Stubs at `/more`, `/history`, `/movements` |
| 8 | Auth (Supabase auth, RLS, data migration) | Launch blocker — deferred |
| 9 | Capacitor wrap (iOS/App Store) | Launch only |

### Known gaps / partially wired
- **"+ Add movement" FAB** on Today page — button renders but does nothing (wiring in Phase 6/7)
- **Equipment change** in `MovementRow` popover — UI toggles but doesn't write to the active session (Phase 4 comment: "Phase 4 will wire equipmentType back to the active entry")
- **Remove button** on `MovementRow` — renders but handler is empty (same)
- **Plan page** — Phase 2 stub, returns `<main>Built in Phase 6</main>`
- **More page** — stub
- `MovementCard.tsx`, `MovementsManager.tsx`, `ProgressView.tsx`, `ProgressChart.tsx` — scaffold remnants with `// @ts-nocheck`, not routed, will be rebuilt in Phase 7
- `AddMovementButton.tsx`, `FinishWorkoutButton.tsx`, `Nav.tsx` — scaffold remnants, not used in routed pages

---

## ARCHITECTURE OVERVIEW

### Frontend stack
- **Next.js 14** (app router, `reactStrictMode: true`)
- **React 18** with `"use client"` pattern throughout (all data-fetching pages are client components)
- **TypeScript** (strict mode, zero errors enforced)
- **Tailwind CSS** with INCYTE token extensions in `tailwind.config.ts`
- **CSS Modules** for glass surfaces that Tailwind can't express (layered box-shadows, `::after` sheens, `backdrop-filter`)
- **recharts** — in `package.json`, not yet used in any active route (available for Phase 7 sparklines)

### Backend / data
- **Supabase** — shared project ID `drlmpltseepsxostsqdq` (same project as the HTML build)
- Client-side queries only (`"use client"` + `createBrowserClient`)
- `device_id` keying via `localStorage` (`fitlog_device_id`) — no auth during build phase
- The HTML build and Next.js build share the same Supabase rows — they interoperate live

### State management
- No global store. All state is local `useState` + `useCallback` inside page components.
- Data flows: page loads → `useEffect` → `listX()` helpers → local state → render
- Mutations: inline handlers call `upsertWorkout()` etc. then update local state optimistically

### Routing
```
/           → redirect to /today
/today      → Today screen
/today/workout?mid=&planId=&src=  → Workout Mode
/momentum   → Momentum/Insights
/plan       → Phase 6 stub
/more       → Phase 7 stub
/history    → Phase 7 stub (scaffold remnant)
/movements  → Phase 7 stub (scaffold remnant)
/progress   → Phase 7 stub (scaffold remnant)
```

### Deployment
- Static export preferred (for Capacitor compatibility at launch)
- No `output: "export"` in `next.config.js` yet — running as a standard Next.js app for now
- `.claude/launch.json` registers `fitlog-nextjs` server (port 3000, `npm run dev`)

### Environment variables
- `NEXT_PUBLIC_SUPABASE_URL` = `https://drlmpltseepsxostsqdq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (in `.env.local`, not committed)
- Both are `NEXT_PUBLIC_*` so they're safe on the client

---

## DESIGN SYSTEM

### Locked palette (never change)
| Token | Value | Use |
|-------|-------|-----|
| `--ink` | `#0f1622` | Primary text, borders |
| `--ink-2` | `#2c3548` | Gunmetal accent |
| `--muted` | `#5e6a82` | Secondary text |
| `--label` | `#8893a8` | Faint labels, eyebrows |
| `--paper` | `#ffffff` | Card surfaces |
| `--paper-2` | `#f4f5f7` | App background |
| `--paper-3` | `#eceef2` | Tertiary surface |
| `--accent` | `#5d9bb8` | Steel blue — primary brand |
| `--accent-2` | `#7fa5c7` | Icy lavender-blue |
| `--accent-3` | `#9eb5cb` | Misty silver-blue |
| `--ok` | `#4f9aa8` | Cool teal — success / working set |
| `--warn` | `#8e9bb0` | Slate |
| `--bad` | `#b08092` | Desaturated mauve — destructive / warmup |

**Hairlines** — all separators are **1.2px** (not 1px):
- `--hairline` `rgba(15,22,34,0.25)`
- `--hairline-soft` `rgba(15,22,34,0.11)`
- `--hairline-strong` `rgba(15,22,34,0.20)`

**Glass surface tokens:**
- `--glass-bg` `rgba(241,244,249,0.55)` — base glass background
- `--card-border` `rgba(255,255,255,0.55)` — glass card border
- `--glass-highlight` `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.10) 28%, rgba(255,255,255,0) 58%)` — `::after` sheen
- `--glass-shadow` / `--depth-3` — hero card elevation (see globals.css)

### The locked brand gradient
```css
linear-gradient(155deg,
  rgba(93,155,184,A) 0%,       /* steel blue */
  rgba(155,130,200,B) 55%,     /* lavender */
  rgba(201,160,190,C) 100%)    /* soft pink */
```
Alpha trio `(A, B, C)` varies by surface:
- Hero cards: `0.18 / 0.13 / 0.10`
- Session-stats panel: `0.24 / 0.17 / 0.12`
- AI rec pill: `0.20 / 0.14 / 0.12`

**NEVER substitute solid colors for this gradient.**

### Typography
| Token | Size | Use |
|-------|------|-----|
| `--text-eyebrow` | 12px | Mono uppercase labels (dominant micro-text) |
| `--text-xs` | 11px | Small captions |
| `--text-sm` | 12px | Secondary body, stat sublabels |
| `--text-base` | 13px | Default body |
| `--text-md` | 14px | Emphasised body |
| `--text-lg` | 15px | Small headlines (Recommendation row) |
| `--text-xl` | 18px | Card titles |
| `--text-2xl` | 22px | Section titles |
| `--text-3xl` | 28px | Hero numerics |
| `--text-display` | 34px | View titles |

**Font families:**
- `--font-display` → Inter Tight (headings, hero numbers) → Tailwind: `font-display`
- `--font-text` → system-ui + SF Pro Text fallback → Tailwind: `font-sans`
- `--font-mono` → Geist Mono / JetBrains Mono (all eyebrows, set data) → Tailwind: `font-mono`

### Info-row anchor scale (canonical)
From memory `feedback_information_row_typography.md`:
- Movement name: Inter Tight 600 / 16px
- Equipment pill: Geist Mono 700 / 12px / uppercase / 0.16em tracking
- Count chip: Geist Mono 600 / 12px

### Glass surface pattern (canonical for hero cards)
```css
background: var(--glass-bg);
backdrop-filter: blur(28px) saturate(160%);
-webkit-backdrop-filter: blur(28px) saturate(160%);
border: 1.2px solid var(--card-border);
border-radius: 24px;
box-shadow: var(--glass-shadow);
position: relative; isolation: isolate; overflow: hidden;
/* ::after sheen */
content: ''; position: absolute; inset: 0; border-radius: inherit;
background: var(--glass-highlight);
pointer-events: none; mix-blend-mode: screen; opacity: 0.55;
```

### Animation register
- Duration: 150–300ms
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` or `cubic-bezier(0.33, 1, 0.68, 1)` — never `linear`
- Max: 500ms for UI transitions
- Tap feedback: `transform: scale(0.94–0.97)` on `:active`
- No external animation libraries

### BottomNav glass pill
```css
transform: translateX(-50%) scale(1.15);  /* floats slightly larger */
backdrop-filter: blur(28px) saturate(180%);
/* Layered inset + drop shadows create the glass lift effect */
```
Active tab: `background: rgba(255,255,255,0.96)`, `translateY(-1px)`, additional inset shadows.

---

## FILE + FOLDER MAP

```
~/fitness-app/
├── src/
│   ├── fitlog-mobile.html        ← THE primary shipping app (HTML build)
│   ├── mobile351.html            ← Visual parity baseline for Next.js port
│   └── fitlog-nextjs/            ← Next.js parallel build (active construction)
│       ├── next.config.js        ← reactStrictMode: true, no static export yet
│       ├── tailwind.config.ts    ← INCYTE tokens (mirrors fitlog-mobile.html :root)
│       └── src/
│           ├── app/
│           │   ├── globals.css           ← Base styles, CSS custom properties, body bg
│           │   ├── layout.tsx            ← Root shell — mounts BottomNav, safe-area padding
│           │   ├── page.tsx              ← redirect("/today")
│           │   ├── today/
│           │   │   ├── page.tsx          ← Today screen (COMPLETE)
│           │   │   ├── TodayPage.module.css
│           │   │   └── workout/
│           │   │       ├── page.tsx      ← Workout Mode (COMPLETE)
│           │   │       └── WorkoutPage.module.css
│           │   ├── momentum/
│           │   │   ├── page.tsx          ← Insights/Momentum (COMPLETE)
│           │   │   └── MomentumPage.module.css
│           │   ├── plan/page.tsx         ← Phase 6 stub
│           │   ├── more/page.tsx         ← Phase 7 stub
│           │   ├── history/page.tsx      ← Scaffold remnant, not routed in nav
│           │   ├── movements/page.tsx    ← Scaffold remnant
│           │   └── progress/page.tsx     ← Scaffold remnant
│           ├── components/
│           │   ├── BottomNav.tsx         ← Glass-pill nav (Today/Plan/Momentum/More)
│           │   ├── BottomNav.module.css  ← All glass/scale/shadow CSS for nav
│           │   └── [scaffold remnants — not used in routed pages]
│           │       ├── MovementCard.tsx  (@ts-nocheck — rebuilt in Phase 7)
│           │       ├── MovementsManager.tsx
│           │       ├── ProgressChart.tsx
│           │       ├── ProgressView.tsx
│           │       ├── AuthForm.tsx
│           │       ├── SignOutButton.tsx
│           │       ├── Nav.tsx
│           │       ├── AddMovementButton.tsx
│           │       └── FinishWorkoutButton.tsx
│           └── lib/
│               ├── types.ts              ← All domain types (HTML-schema-compatible)
│               ├── db.ts                 ← Supabase query helpers (client-side only)
│               ├── device.ts             ← device_id localStorage helper
│               ├── engine/
│               │   ├── today.ts          ← Today-screen pure logic
│               │   ├── workout.ts        ← Set-mutation engine + defaultSetsFor
│               │   └── momentum.ts       ← Readiness/fatigue/PR analytics engine
│               └── supabase/
│                   ├── client.ts         ← createBrowserClient (client components)
│                   └── server.ts         ← createServerClient (SSR — not used yet)
├── pm/
│   ├── handoff.md                ← Original onboarding doc
│   ├── roadmap.md
│   ├── backlog.md
│   ├── decisions.md              ← Append-only locked decisions
│   ├── nextjs-port-plan.md       ← Phased Next.js port plan (source of truth for phases)
│   └── port-plan.md              ← HTML build port plan (Today + Workout prototype)
├── docs/
│   └── HANDOFF.md                ← This file
└── CLAUDE.md                     ← Engineering rules for AI agents (read this first)
```

---

## DATABASE + SUPABASE STRUCTURE

**Project:** `drlmpltseepsxostsqdq` (shared between HTML build and Next.js build)

### Tables

#### `workouts`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | UUID or `w${timestamp}` |
| device_id | text | Anonymous build-phase key |
| name | text | e.g. "Mon session" |
| date | timestamptz | ISO string |
| finished | bool | Active=false, archived=true |
| entries | jsonb | `WorkoutEntry[]` — inline, no join table |
| saved_at | timestamptz | Last save |
| completed_at | timestamptz | When finished |
| edited_at | timestamptz | Last edit |
| notes | text | Optional |

**Critical:** `entries` is a jsonb column containing the full `WorkoutEntry[]` array. There is **no separate `workout_entries` table.** The scaffold's `schema.sql` assumed one — it is stale and wrong.

#### `movements`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | |
| device_id | text | |
| name | text | |
| kind | text | "weight" \| "cardio" \| null |
| muscle | text | e.g. "chest", "back" |
| body_part | text | |
| unit | text | Cardio: "mi"\|"km"\|"m" |
| equipment_type | text | e.g. "barbell", "dumbbell" |
| variant | text | |
| canonical_movement | text | Stable identity across renames |
| default_sets | int | |
| notes | text | |

#### `plans`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | |
| device_id | text | |
| mid | text | movementId FK |
| dow | int | 0=Sun, 1=Mon … 6=Sat |
| sets | int | |
| reps | text | Can be "8-12" or "10" |
| rpe | text | |
| tempo | text | |
| notes | text | |
| target_weight | float | |
| training_type | text | |

### Auth
- **Build/test phase:** anonymous `device_id` in localStorage (`fitlog_device_id`)
- **Production (Phase 8):** Supabase auth with `auth.uid()` + RLS migration
- RLS currently disabled or permissive for `device_id` filtering
- The HTML build uses the same `device_id` key — if you want the Next.js build to see the same data as the HTML build, copy `fitlog_device_id` from the HTML build's localStorage to the Next.js localhost localStorage

### Key query patterns
```typescript
// Active session (unfinished, most recent)
listWorkouts({ finished: false, limit: 1 })

// All finished workouts (for history, analytics)
listWorkouts({ finished: true })

// Today's finished workouts (for "session done" state)
listFinishedTodayWorkouts()  // filters by local calendar date

// Plans for today
listPlans()  // then filterTodaysPlan(plans) in engine
```

### Schema issues / gotchas
- `supabase/schema.sql` in the repo is **stale** — ignore it
- The HTML build's `supabaseSyncWorkout()` at line ~17040 is the canonical write contract
- `entries` is a jsonb array — Supabase returns it already parsed as a JS array, no `JSON.parse()` needed
- `saved_at` (snake_case in DB) ↔ `savedAt` (camelCase in types) — `rowToWorkout()` handles the mapping

---

## CURRENT FEATURES

### Today screen (`/today`)

**Purpose:** Primary daily surface — shows today's planned movements, session stats, and lets the user tap into Workout Mode.

**Status:** Complete (Phase 3)

**Key files:**
- `src/app/today/page.tsx` — all logic + sub-components (SessionStats, MovementRow, EmptyState)
- `src/app/today/TodayPage.module.css` — glass panel, movement rows, chips, FAB
- `src/lib/engine/today.ts` — pure helpers (todayHeadline, filterTodaysPlan, calcDayStats, buildTodayItems, groupByBodyPart, itemProgress)

**Data flow:**
1. Load: `listMovements()` + `listPlans()` + `listWorkouts({finished:false, limit:1})` + `listFinishedTodayWorkouts()`
2. Derive: `mvMap`, `todayPlan`, `activeEntries`, `sessionDoneToday`
3. Stats panel: `calcDayStats()` → Volume / Avg RPE / Complete%
4. Items: `buildTodayItems()` → `remaining[]` + `completed[]` → `groupByBodyPart()`
5. Tap: `router.push('/today/workout?mid=&planId=&src=')` with 180ms ripple delay

**Known issues / TODOs:**
- "+" Add movement FAB — renders, wires in Phase 6
- Equipment popover write-back — renders, wires in Phase 6
- Remove button — renders, wires in Phase 6
- No drag-to-reorder for movement rows (Phase 6 or later)

---

### Workout Mode (`/today/workout`)

**Purpose:** Per-movement set logging surface. Tap from Today → log sets → auto-archive on completion → return to Today.

**Status:** Complete (Phase 4)

**Key files:**
- `src/app/today/workout/page.tsx` — `WorkoutPageShell` (Suspense boundary) + `WorkoutPage` (logic) + sub-components
- `src/app/today/workout/WorkoutPage.module.css` — back chip, hero card, set rows, picker sheet, toast
- `src/lib/engine/workout.ts` — all pure mutations (logSet, addSet, removeSet, reopenSet, toggleSetType, toggleBodyweight, patchSet, allSetsDone, defaultSetsFor, archiveEntryToToday)

**URL params:** `?mid=<movementId>&planId=<planItemId>[&src=<sourceWorkoutId>]`

**Data flow:**
1. Load: movement from `listMovements()`, plan item from `listPlans()`, active workout from `listWorkouts({finished:false,limit:1})`, all finished for prev-session lookup
2. `defaultSetsFor()` seeds sets from previous session's data (prevW/prevR populated)
3. Log a set → `logSet()` → `persist()` → `upsertWorkout()`
4. Last set done → `allSetsDone()` → `handleComplete()` → `archiveEntryToToday()` + `upsertWorkout(session)` → remove entry from active workout → `router.push('/today')`
5. Rest timer: local `setInterval` countdown, `startRest()`/`stopRest()`
6. Picker: `{field, idx, value}` state → `PickerSheet` bottom-sheet → `patchSet()` + `persist()`

**Key design decisions:**
- `Suspense` boundary required — `useSearchParams()` in Next.js 14 static export throws without it
- Active workout is **not** deleted when a movement completes — it stays alive so the user can log another movement
- Auto-archive merges entries into today's finished session (same-day merge) not a new workout per movement
- `defaultSetsFor()` priority: lastEntry prevW/prevR → planItem.sets → movement.defaultSets → 3

---

### Momentum / Insights (`/momentum`)

**Purpose:** Analytics surface — Readiness, Recovery Map, Muscle Stimulus, PRs.

**Status:** Complete (Phase 5)

**Key files:**
- `src/app/momentum/page.tsx` — 4 collapsible hero cards (all "use client")
- `src/app/momentum/MomentumPage.module.css` — glass card CSS (mirrors .hero-card from HTML build line 4798)
- `src/lib/engine/momentum.ts` — pure analytics engine

**Cards:**
1. **Readiness** — Expanded by default. 3-stat grid (Readiness / Recovery / Fatigue with progress bars). Training recommendation with collapsible bullet list. Readiness = avg calibrated-RPE-based score from last 5 sessions. Recovery = days-since-last proxy. Fatigue = `computeOverallFatiguePct()`.
2. **Recovery Map** — Collapsed by default. Upper/Lower body toggle pill. Per-muscle fatigue bars with Miami-palette gradient fills (cyan=low, lavender=med, pink=high). Uses same decay model as the HTML build.
3. **Muscle Stimulus** — Collapsed by default. Weekly-sets hero number + INCYTE-gradient bars per body part.
4. **PRs** — Collapsed by default. Horizontal-scroll badges, heaviest actual top set per movement (no 1RM projection).

**Engine (`momentum.ts`) ports from HTML build:**
- `computeOverallFatiguePct()` — line 20606: 60% max + 40% mean of trained muscles, per-muscle volume × decay
- `heroLastNFinished()` — line 20698
- `heroFinishedThisWeek()` — line 20575
- `renderPRCard()` — line 21370
- `renderFatigueCard()` decay logic — line 21145
- Readiness: simplified port of `analyzeWorkoutPerformance` — uses avg calibrated RIR from working sets

---

### BottomNav (`/components/BottomNav`)

**Purpose:** Floating glass-pill primary navigation — Today / Plan / Momentum / More.

**Status:** Complete (Phase 2)

**Key design:**
- `scale(1.15)` on the pill — slightly larger than the page content beneath it
- `backdrop-filter: blur(28px) saturate(180%)`
- Layered inset box-shadows for the glass lift effect
- Active tab gets `background: rgba(255,255,255,0.96)` + `translateY(-1px)` + accent-blue icon color
- "More" tab separated by a hairline divider

---

## ACTIVE TASKS

### Phase 6 — Plan editor (next priority)
- Mon–Sun weekly grid showing planned movements per day
- Add / edit / remove movements per day
- Plan order (drag handle)
- Equipment / variant selectors
- Target: visual parity with `#view-plan` in the HTML build

### Phase 7 — More screen (History + Library)
- History: list of finished workouts, tap to open detail / inline edit
- Movement Library: searchable list with category filter + CRUD
- Absorb scaffold's `/history`, `/movements`, `/progress` stubs

### Unwired UI (Today + Workout Mode)
- "+" Add movement FAB → opens movement picker sheet
- Equipment popover write-back → updates `entry.equipmentType` in active session
- Remove movement button → removes entry from active session

### Technical debt
- Scaffold remnant components with `// @ts-nocheck` need rebuilding in Phase 7
- `src/app/auth/callback/route.ts` — scaffold auth route, not wired to anything useful
- `src/app/login/page.tsx` — Phase 8 only, currently shows scaffold login UI
- `middleware.ts` — neutered during build phase; restore in Phase 8

---

## RECENT DECISIONS

### 2026-05-13 — Two-build coexistence
The HTML build (`fitlog-mobile.html`) remains the primary shipping product. The Next.js build is built in parallel toward feature parity. Both share the same Supabase project and `device_id`. At cutover, the Next.js build replaces the HTML build.
**Why:** Allows shipping in-progress features in the HTML build without waiting for the Next.js port to catch up. Cutover happens at parity, not before.

### 2026-05-13 — Inline `entries` jsonb schema
The Next.js build adopted the HTML build's actual schema (entries as jsonb on the workouts row) rather than the scaffold's stale schema (separate `workout_entries` table). All Phase 0 work was undoing the scaffold's assumptions.
**Why:** Must read/write the same rows as the HTML build. The scaffold never ran in production.

### 2026-05-13 — CSS Modules for glass surfaces
Tailwind utilities (`backdrop-blur`, `shadow`, `bg-gradient-*`) can't compose the layered box-shadow + `::after` sheen + `backdrop-filter` combos that the mobile351 baseline uses. Every glass surface (hero cards, progress panel, back chip) uses a CSS Module.
**Why:** Visual parity is non-negotiable. Tailwind handles layout + spacing + color; CSS Modules handle the glass treatment.

### 2026-05-13 — `"use client"` for all data-fetching pages
All pages that fetch Supabase data are client components. No RSC data fetching in the initial port.
**Why:** Simpler during the anonymous `device_id` phase. Server components need a different Supabase client that reads auth cookies — not needed until Phase 8.

### 2026-05-13 — device_id shared between builds
Same `fitlog_device_id` key in localStorage. If the user opens the Next.js build on localhost and the HTML build elsewhere, they may have different `device_id` values. To see the same data in both, copy the value manually.
**Why:** Anonymous keying is the simplest path for the build phase.

### 2026-05-14 — Suspense boundary for `useSearchParams()`
Next.js 14 throws if `useSearchParams()` is used outside a Suspense boundary in a statically exported app. The Workout Mode page was split into `WorkoutPageShell` (default export, wraps in `<Suspense>`) and `WorkoutPage` (inner component, uses `useSearchParams()`).
**Why:** Required to make `next build` pass. The error only manifests at build time, not in `npm run dev`.

### 2026-05-15 — Readiness calculation simplified
The HTML build's full `analyzeWorkoutPerformance()` is ~200 lines with Brzycki/Epley blending, quality scores, and calibrated RPE. The Next.js port uses a simplified but directionally correct proxy (avg calibrated RIR from working sets → readiness score). The full engine can be ported later when accuracy becomes more important.
**Why:** Phase 5 is about the UI pattern and data plumbing, not engine fidelity. The simplified version still produces meaningful signals for lifters with logged data.

### All-time locked decisions
- **IA:** Today / Plan / Momentum / More — canonical, never re-litigate
- **Palette:** steel-blue / lavender / soft-pink — no gaming, neon, or warm-orange
- **Voice:** clinical, direct, calibrated — no motivational filler
- **Hairlines:** 1.2px — all separators
- **Numbered snapshots:** retired 2026-05-12 (git commits instead)

---

## USER PREFERENCES

- **Solo developer + PM:** Albert builds and owns all product decisions. Help as a solo indie shipper.
- **Terse messages mean trust:** "go", "lets go", "continue" = execute the next phase autonomously.
- **Phase plan is the source of truth:** Always read `pm/nextjs-port-plan.md` before starting a phase. Don't invent scope.
- **HTML build is canonical:** When porting behavior, cite the HTML build's line number. Port behavior, don't rewrite.
- **Visual parity is the bar:** Compare against `src/mobile351.html` side-by-side. If it doesn't match, the Next.js side is wrong.
- **No motivational copy:** Reject "Crush it!" "Let's go!" "You've got this!" etc.
- **No emoji in copy:** Allowed only in user-facing data (e.g. ★ PR glyph) where the HTML build uses them.
- **Commits on every meaningful change:** `nextjs:` prefix for Next.js changes, `src:` prefix for HTML build changes.

---

## TESTING STATUS

| Area | Status | Notes |
|------|--------|-------|
| TypeScript | ✅ Zero errors | `npx tsc --noEmit` clean |
| `next build` | ✅ Passes | All routes compile, no build errors |
| Today page (visual) | Not formally tested | Dev server verification only |
| Workout Mode (functional) | Not formally tested | Logic manually traced |
| Momentum (functional) | Not formally tested | Engine unit logic untested |
| Plan page | N/A | Stub |
| More page | N/A | Stub |
| Supabase integration | Smoke-tested | Phase 0: reads user's real data from HTML build |
| Mobile viewport | Not tested | Must verify on real device before cutover |

**Known runtime risks:**
- `getDeviceId()` throws if called on the server (guards in place via `tryGetDeviceId()`)
- `useSearchParams()` in Workout Mode needs Suspense boundary (has one, but verify in production builds)
- `listWorkouts({ finished: true })` loads all finished workouts into memory — may be slow for users with large history (add pagination in Phase 7)

---

## NEXT RECOMMENDED ACTIONS

### Immediate (Phase 6 — Plan editor)

1. Read `pm/nextjs-port-plan.md` Phase 6 section for scope
2. Read HTML build's `#view-plan` markup around line 9274 and `renderPlanV2()` for behavior reference
3. Read `pm/decisions.md` for any plan-related locked decisions
4. Create `src/fitlog-nextjs/src/app/plan/page.tsx` (full implementation)
5. Create `src/fitlog-nextjs/src/app/plan/PlanPage.module.css`
6. Create `src/fitlog-nextjs/src/lib/engine/plan.ts` if plan logic warrants isolation

### Phase 6 implementation notes
- The plan is weekly (Mon–Sun). `dow` field: 0=Sun, 1=Mon, ... 6=Sat.
- Each day shows its planned movements (from `listPlans()` filtered by `dow`)
- Movements come from `listMovements()` — user picks from their library
- Add a movement → `upsertPlan()` with a new `PlanItem`
- Remove a movement → `deletePlan(id)`
- The HTML build's plan editor (line ~9274 markup, renderPlanV2 in script) is the reference

### Recommended commit cadence
- One commit per phase
- Prefix: `nextjs: Phase N — description`

### Risks to avoid
- Don't add auth logic before Phase 8 — it will break the anonymous device_id flow
- Don't create a separate `workout_entries` table — the schema uses inline jsonb
- Don't install external animation libraries — the animation register is deliberately constrained
- Don't introduce non-brand colors — the palette is locked; check the HTML build's `:root` tokens

---

## QUICKSTART FOR NEW CLAUDE SESSION

### Current objective
Start **Phase 6 — Plan editor** at `src/fitlog-nextjs/src/app/plan/page.tsx`.

### Files to read first (in order)
1. `/Users/albertrylo/fitness-app/CLAUDE.md` — engineering rules, conventions
2. `/Users/albertrylo/fitness-app/pm/nextjs-port-plan.md` — Phase 6 scope
3. `/Users/albertrylo/fitness-app/pm/decisions.md` — locked decisions
4. `/Users/albertrylo/fitness-app/src/fitlog-nextjs/src/lib/types.ts` — PlanItem type
5. `/Users/albertrylo/fitness-app/src/fitlog-nextjs/src/lib/db.ts` — listPlans, upsertPlan, deletePlan

### HTML build reference for Phase 6
```bash
grep -n "view-plan\|renderPlanV2\|function renderPlan\|plan-grid\|plan-day" src/fitlog-mobile.html | head -30
```

### Commands to verify current state
```bash
cd ~/fitness-app/src/fitlog-nextjs
npx tsc --noEmit        # should show 0 errors
npm run build           # should pass clean
npm run dev             # starts on http://localhost:3000
```

### Important warnings
- **Do not touch `src/fitlog-mobile.html`** unless explicitly asked — it's the primary shipping app
- **Do not change the Supabase schema** — the HTML build's live production data is in that schema
- **Do not invent new brand colors** — only the locked palette
- **All separators must be 1.2px** — not 1px
- **CSS Modules for glass surfaces** — not Tailwind utilities for backdrop-filter/box-shadow combos
- **Commit each phase** with `nextjs:` prefix

### Shared Supabase data between builds
To see the same workout data in both the HTML build and the Next.js build:
1. Open the HTML build (`src/fitlog-mobile.html`) in a browser
2. In DevTools console: `localStorage.getItem('fitlog_device_id')`
3. Copy that value
4. In the Next.js build at `http://localhost:3000`: `localStorage.setItem('fitlog_device_id', '<value>')`
5. Reload — both builds now read/write the same rows
