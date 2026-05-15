# INCYTE — Onboarding Handoff

> Single-page orientation for anyone (or any AI session) starting cold. Skim top-to-bottom, then follow links for depth.

_Last updated: 2026-05-15_

---

## 1. What INCYTE is

**INCYTE** — progressive overload tracking for trained lifters. A calibrated mirror, not a coach. Turns logged sets into honest feedback: when you've actually pushed, when to back off, how today's session moves your week.

**Audience:** Trained lifters, 1+ year experience. Multi-discipline (strength + cardio + mobility). Self-aware enough to report RPE honestly. Engine applies a downward calibration for trained-user overestimation.

**Explicit non-audience:** First-time beginners. Recommendations assume calibrated RPE input from someone who knows what failure feels like.

**Voice:** Clinical, direct, calibrated. Reject motivational filler, twee subcopy, emoji punctuation. See [launch-quality.md §5](launch-quality.md).

**Positioning:** Calm blue-gray against the convention of orange-energetic fitness apps. See [feedback_positioning_and_voice.md](../../.claude/projects/-Users-albertrylo/memory/feedback_positioning_and_voice.md).

---

## 2. Where things live

| Path | What |
|---|---|
| `~/fitness-app/src/fitlog-mobile.html` | HTML build (~21.6k lines, vanilla JS/HTML/CSS, no build step). **Visual parity reference** — mobile351 baseline. Engine logic is canonical here. |
| `~/fitness-app/src/fitlog-nextjs/` | **Primary active build.** Next.js 14 app router + React 18 + TypeScript + Tailwind + Supabase SSR. Phases 0–8 complete. This is what ships. |
| `~/fitness-app/pm/` | All PM artifacts (this doc, roadmap, backlog, decisions, nextjs-port-plan, etc.). |
| `~/fitness-app/pm/mockups/` | Design mockups; `prototype.html` is the Today + Workout Mode reference. |
| `~/fitness-app/.git/` | Git repo on `main`. Numbered-snapshot workflow retired 2026-05-12 ([decisions.md](decisions.md)). |

---

## 3. Tech stack

### Next.js build (active)
- **Framework:** Next.js 14 app router, React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (`drlmpltseepsxostsqdq`) — shared with the HTML build, same rows
- **Auth:** Full Supabase auth (signup / signin / password-reset) wired as of Phase 8. On first login, `adoptDeviceRowsIfNeeded(uid)` migrates all three tables (movements / workouts / plans) from `device_id` → `uid`, then overwrites `localStorage.fitlog_device_id = uid` so anonymous and authenticated sessions share the same data.
- **Identity:** `getIdentifier()` in `db.ts` — tries `auth.uid()` first (via `getSession()`, no network), falls back to `getDeviceId()`. All list/upsert/delete helpers call it.
- **Schema:** HTML build's schema — `workouts` row carries inline `entries: WorkoutEntry[]` jsonb, keyed by `device_id`. `movements` and `plans` tables same pattern.
- **Dev:** `cd src/fitlog-nextjs && npm run dev` → `http://localhost:3000`
- **Build:** `npm run build` — static export, all 14 pages prerender cleanly.

### HTML build (parity reference)
- Single-file vanilla JS/HTML/CSS. Mobile-first. Capacitor-wrappable.
- Engine logic (fatigue, 1RM, RPE calibration, recommendations, same-day merge) lives here. Next.js ports behavior from it — cite HTML line numbers in ported function headers.
- Not edited during Next.js active development unless a bug is critical.

---

## 4. Information architecture

**Canonical bottom-nav tabs** (locked, [decisions.md 2026-05-12](decisions.md)):

| Tab | Route | Surface |
|---|---|---|
| **Today** | `/today` | Current-day session. Build/log/finish today's training. FAB adds movements. |
| **Plan** | `/plan` | Weekly grid editor (Mon–Sun) with day cards, movement rows, bottom-sheet CRUD. |
| **Momentum** | `/momentum` | Progress analytics — PR hero, volume trend, recent history. |
| **More** | `/more` | Hub: History, Movement Library, Appearance (theme toggle), Account (sign out). |

Sub-routes under More:

| Route | Surface |
|---|---|
| `/history` | Finished workout log grouped by month, collapsible workout cards. |
| `/movements` | Searchable movement library with create/edit/delete bottom sheet. |
| `/login` | Auth gate — sign in / sign up / password reset, glass card UI. |
| `/auth/callback` | Supabase PKCE callback handler. |

**Middleware** at `src/fitlog-nextjs/middleware.ts` enforces the auth gate: unauthenticated → `/login?next=pathname`; authenticated on `/login` → `?next` or `/today`.

---

## 5. Next.js build — phase status

| Phase | What | Status |
|---|---|---|
| 0 — Reset scaffold | Types, db.ts, device.ts, schema alignment | ✅ Done |
| 1 — Design system | Tailwind tokens, globals.css, CSS custom properties | ✅ Done |
| 2 — Shell + nav | layout.tsx, BottomNav, routing scaffold | ✅ Done |
| 3 — Today page | Session stats, movement cards, equipment popover, FAB, add-movement sheet | ✅ Done |
| 4 — Workout Mode | Set rows, WU/WS, BW, picker overlay, mobility variant, rest pill | ✅ Done |
| 5 — Insights | Readiness/Fatigue/Recovery/PR cards on Momentum | ✅ Done |
| 6 — Plan editor | Week strip, day cards, movement rows, add/edit sheet | ✅ Done |
| 7 — More hub + History + Movements | Glass nav cards, workout log, movement CRUD | ✅ Done |
| 8 — Auth | Supabase signup/signin/reset, middleware gate, device_id migration | ✅ Done |
| **9 — Capacitor wrap** | **iOS shell, app icon, provisioning, App Store Connect** | ⬜ Next |

**Dark mode:** Fully implemented. `globals.css` flips all `:root` tokens at `prefers-color-scheme: dark` and on `body.theme-dark`. Every CSS module has `@media` + `:global(body.theme-dark)` override blocks. Manual toggle lives in More → Appearance (Light / System / Dark pill), writes to `localStorage.fitlog_theme`.

---

## 6. Core engine concepts (settled)

| Concept | Truth |
|---|---|
| **Fatigue** | `computeOverallFatiguePct` is the single source of truth. `0.6 × max + 0.4 × mean` of trained-muscle fatigue, decayed by days-since (day 0=1.0, 1=0.65, 2=0.35, 3=0.15, 4+=0). Volume coefficient **3.0**; deload threshold **<45%**. |
| **RPE** | Calibrated RPE feeds fatigue math. Raw RPE preserved for 1RM honesty. |
| **PR display** | Raw top-set weight, not Epley e1RM. Prevents counter-intuitive sparkline inversions. |
| **1RM** | `Current 1RM = MAX(weight × any completed working set)`. `Estimated 1RM` = Brzycki/Epley blend with RPE sensitivity. These remain distinct in UI. |
| **Movement identity** | Every entry carries `(canonicalMovement, equipmentType, variant)`. Equipment + variant are modifier fields — never appended to the movement name. PRs are equipment-specific. |
| **Sets** | `s.warmup` boolean tags warm-up vs. working. Only working sets feed 1RM, volume, and progression math. |
| **Same-day sessions** | Multiple "Finish Workout" presses on the same calendar day merge into a single History row (entries deduplicated by `movementId`, keeping the entry with more done sets). |

---

## 7. Design system

**Locked palette** — steel-blue / lavender / soft-pink. No warm orange, no gaming/cyberpunk neon. See [feedback_visual_direction.md](../../.claude/projects/-Users-albertrylo/memory/feedback_visual_direction.md).

**Brand gradient:** `linear-gradient(155deg, rgba(93,155,184,A) 0%, rgba(155,130,200,B) 55%, rgba(201,160,190,C) 100%)` — same hue triplet everywhere, only alpha varies by surface.

**Key tokens:**
- `--ink #0f1622` / `--muted #5e6a82` / `--label #8893a8`
- `--accent #5d9bb8` (steel blue, primary brand)
- `--ok #4f9aa8` / `--bad #b08092`
- All separators: **1.2px** (not 1px)
- Border-radius: pills `999px`, chips `6–12px`, cards `14–22px`

**Glass surfaces:** CSS modules only (Tailwind can't express layered `box-shadow` + `::after` sheen + `backdrop-filter` combos). Pattern: `rgba(255,255,255,0.72)` bg + `blur(18–28px) saturate(140–160%)` + `::after` sheen with `mix-blend-mode: screen`.

**Typography:** Inter Tight (display, headings) + Geist Mono (eyebrows, chips, mono labels) + system-ui (body). Both loaded via Google Fonts import in `globals.css`.

**Dark mode tokens (key):**
```
--paper: #0e1217  --paper-2: #161b23  --paper-3: #1f2632
--ink: #f7f9fc    --muted: #8d96a5    --label: #6a7384
--accent: #4dd0e1 --ok: #7ec0a8       --bad: #c89aa3
```

---

## 8. File layout (Next.js build)

```
src/fitlog-nextjs/src/
├── app/
│   ├── globals.css            ← INCYTE tokens, body bg, dark mode
│   ├── layout.tsx             ← Shell, BottomNav, viewport meta
│   ├── page.tsx               ← Redirect → /today
│   ├── today/
│   │   ├── page.tsx           ← Today screen (session stats, mv cards, FAB)
│   │   ├── TodayPage.module.css
│   │   └── workout/
│   │       ├── page.tsx       ← Workout mode (set rows, picker, mobility)
│   │       └── WorkoutPage.module.css
│   ├── plan/
│   │   ├── page.tsx           ← Week strip + day cards + edit sheet
│   │   └── PlanPage.module.css
│   ├── momentum/
│   │   ├── page.tsx           ← PR hero, volume chart, insights cards
│   │   └── MomentumPage.module.css
│   ├── more/
│   │   ├── page.tsx           ← Hub: history / movements / theme / sign out
│   │   └── MorePage.module.css
│   ├── history/
│   │   ├── page.tsx           ← Workout log grouped by month
│   │   └── HistoryPage.module.css
│   ├── movements/
│   │   ├── page.tsx           ← CRUD library with bottom sheet
│   │   └── MovementsPage.module.css
│   ├── login/
│   │   └── page.tsx           ← Auth gate (wraps AuthForm in Suspense)
│   └── auth/callback/
│       └── route.ts           ← Supabase PKCE exchange
├── components/
│   ├── BottomNav.tsx          ← Glass pill nav, active tab lift
│   ├── BottomNav.module.css
│   ├── AuthForm.tsx           ← Signin / signup / reset (3-mode)
│   └── AuthForm.module.css
└── lib/
    ├── db.ts                  ← Supabase helpers, getIdentifier(), adoptDeviceRowsIfNeeded()
    ├── types.ts               ← Movement, WorkoutEntry, Workout, PlanItem
    ├── device.ts              ← getDeviceId(), tryGetDeviceId()
    └── engine/
        ├── fatigue.ts         ← computeOverallFatiguePct
        ├── oneRepMax.ts       ← Brzycki/Epley blend
        ├── plan.ts            ← DOW helpers, planItemSets, groupPlanByMuscle
        └── recommendations.ts ← nextSetCoachNote, applyRecommendation
```

---

## 9. Active work — what's next

**Phase 9 — Capacitor wrap (launch only):**
1. `npx cap init` inside `src/fitlog-nextjs/`
2. `npx cap add ios`
3. App icon + splash screen (INCYTE design, steel-blue/lavender palette)
4. Bind native plugins: `@capacitor/local-notifications`, calendar (EKEventStore via custom plugin or `@capacitor-community/native-audio`)
5. Provisioning profile + App Store Connect listing
6. TestFlight upload → Apple review

**Pre-submission gates** (from [launch-quality.md](launch-quality.md)):
- [ ] A-02 — Confirm light-mode default in Next.js (body.theme-dark not applied on first load unless user has set it)
- [ ] D-08 — Apple Developer Program enrollment ($99/yr, ~48h processing)
- [ ] D-02 — Privacy policy URL + App Store privacy labels
- [ ] D-05 — App Store listing copy, screenshots (6.7" + 6.1"), preview video (optional)
- [ ] D-03 — Account deletion flow (App Store guideline 5.1.1(v))

**UI/UX debt (non-blocking for launch, high-value polish):**
- Workout mode: rest timer polish, drag-handle reorder for movement cards
- Plan: drag-to-reorder days, long-press movement row to clone to another day
- Momentum: multi-period sparkline overlay (backlog F-04)
- `body.theme-dark` persistence across navigations via `layout.tsx` (currently applied per-page on mount via More page; should apply globally in layout from localStorage on mount)

---

## 10. Workflow rules

- **Edit `src/fitlog-nextjs/` for all active development.** The HTML build (`fitlog-mobile.html`) is the visual parity reference only — read it when porting engine behavior, don't edit it for the Next.js work.
- **Commits:** prefix Next.js commits with `nextjs:`, HTML build commits with `src:`.
- **Type check before committing:** `npx tsc --noEmit` from `src/fitlog-nextjs/`.
- **Tokens are locked.** All CSS uses `var(--ink)` etc. or the explicit hex values from the locked palette. No hardcoded substitutions.
- **No emojis as structural icons.** SVG only. (Emojis currently used as placeholder icons in nav cards — replace before launch.)
- **No fabricated demo data** shown as if real.
- **PM artifacts in `~/fitness-app/pm/`.** Append to `decisions.md` when direction is set.

---

## 11. Open decisions

| ID | Status |
|---|---|
| **D-08** — Apple Developer Program enrollment | Not started. P0 for App Store submission. |
| **A-02** — Light-mode default on first load | Next.js defaults to system; verify `body.theme-dark` isn't applied when `fitlog_theme` key is absent. |
| **D-03** — Account deletion flow | Required by App Store guideline 5.1.1(v). Needs Supabase edge function + UI. |
| **North Star metric** | Working candidate: weekly active session completion rate. Not yet confirmed. |

---

## 12. Where to read next

| Doc | When to read it |
|---|---|
| [nextjs-port-plan.md](nextjs-port-plan.md) | Full phase plan with constraints, risk register, file layout. Read before editing the Next.js build. |
| [roadmap.md](roadmap.md) | What ships when. Now/Next/Later/Won't. |
| [backlog.md](backlog.md) | Every bug/feature/distribution item with priority + effort. |
| [decisions.md](decisions.md) | Why anything is the way it is. Append-only. |
| [launch-quality.md](launch-quality.md) | Pre-submission checklist. Run before App Store assets. |
| `feedback_visual_direction.md` (memory) | Locked token system. Read before any visual change. |
| `feedback_positioning_and_voice.md` (memory) | INCYTE voice/positioning. Read before any copy work. |
| `feedback_information_row_typography.md` (memory) | Info-row scale anchor (name 14px / metadata-pill 9.5px / count-chip 12px). |

---

## 13. House style for AI sessions

- Read this doc + linked docs **before** proposing changes. Don't re-litigate settled decisions; flag them if you think they need revisiting.
- The user is solo dev + PM. Help him ship — bias toward concrete, small, verified changes over open-ended exploration.
- **Before reporting done:** run `npx tsc --noEmit && npm run build` from `src/fitlog-nextjs/`. A clean static build is the bar.
- Memory is loaded automatically and reflects user preferences; trust it.
- When the user describes the IA, use the canonical Today / Plan / Momentum / More — even if they say it differently in a given prompt.
- Commits use the `nextjs:` prefix. Co-author line: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
