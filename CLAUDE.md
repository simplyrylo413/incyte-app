# CLAUDE.md — INCYTE engineering rules

These rules apply to every code change in this repo. Read top-to-bottom before editing. They encode the conventions of the project so AI coding agents don't re-invent style, drift away from tokens, or create components in random locations.

For PM-side context (vision, roadmap, decisions, port plan), see [`pm/handoff.md`](pm/handoff.md) first. That document orients on *what* to do; this one defines *how*.

---

## 1. What INCYTE is

**INCYTE** — progressive overload tracking for trained lifters. Solo-developed, mobile-first, headed to App Store via Capacitor. Voice is clinical, direct, and calibrated. Reject motivational filler, emoji punctuation, and "new identity" redesigns. See [`pm/decisions.md`](pm/decisions.md) for locked direction.

---

## 2. Critical rules (do not violate)

- **IMPORTANT:** Two builds coexist in this repo. Know which one you're touching before editing.
  - **HTML build** at `src/fitlog-mobile.html` — single-file vanilla HTML/CSS/JS, ~21.6k lines, no build step, no framework. The **primary shipping product** during the transition. Rules in §3–§7 apply.
  - **Next.js build** at `src/fitlog-nextjs/` — Next 14 (app router) + React 18 + Tailwind + TypeScript + Supabase SSR. In active construction toward visual + feature parity with the HTML build's mobile351 baseline. Has its own conventions in §12 below. Per [`pm/decisions.md` 2026-05-13](pm/decisions.md), this build is being developed in parallel and will replace the HTML build at cutover.
- **IMPORTANT:** Inside the HTML build, do **not** create new files for components, styles, or scripts. Everything goes inside the single canonical `fitlog-mobile.html`. Numbered snapshots (e.g. `mobile346.html`) are only created when the user explicitly asks — they are not source of truth.
- **IMPORTANT:** Commit each meaningful change to git. The repo is at `~/fitness-app/` on branch `main`. Numbered-snapshot workflow was retired 2026-05-12 ([`pm/decisions.md`](pm/decisions.md)); user may still request snapshots for specific exports.
- **IMPORTANT:** Never hardcode colors, font sizes, spacing, or shadows. Use the design tokens declared in `:root` at [src/fitlog-mobile.html:20](src/fitlog-mobile.html#L20). Hardcoded values that re-implement existing tokens are a regression.
- **IMPORTANT:** Never invent new brand colors. INCYTE's palette is locked: steel-blue / lavender / soft-pink. Gaming, cyberpunk, neon, and warm-orange "fitness" palettes are explicitly rejected. See `~/.claude/projects/-Users-albertrylo/memory/feedback_visual_direction.md`.
- **IMPORTANT:** The IA is **Today / Plan / Momentum / More**. When users describe the IA differently in a prompt, use the canonical names — don't re-litigate.

---

## 3. Codebase shape

```
~/fitness-app/
├── src/
│   ├── fitlog-mobile.html      ← THE app. Edit this.
│   ├── mobile{NNN}.html        ← Ad-hoc numbered snapshots. Read-only.
│   └── fitlog-nextjs/          ← Dormant scaffold. Do not edit.
├── pm/                         ← PM workspace (roadmap, decisions, etc.)
├── CLAUDE.md                   ← This file.
└── .git/                       ← Repo, branch `main`.
```

Inside `fitlog-mobile.html`:

| Section | Roughly where |
|---|---|
| `:root` tokens | lines 20–115 |
| Global resets + body bg | 116–200 |
| Component CSS rules | 200–8800 |
| Dark-mode overrides | 8200–8700 |
| HTML body markup | 8700–9700 |
| Script block (state, render, helpers) | 9700–end |

Key script anchors:
- `renderTodayV2()` — Today screen render
- `renderWorkoutV2()` — Workout-mode render
- `logSetV2`, `addSetV2`, `removeSetV2`, `reopenSetV2`, `toggleSetTypeV2`, `toggleBodyweightV2` — set-row helpers
- `openPickerV2` — the weight/reps/RPE picker overlay
- `ui.session` — transient workout-mode state (RPE toggle, AI toggle, rest timer)
- `data.active` — current session (persisted)
- `data.workouts` — finished session history
- `defaultSetsFor(planItem)` — builds today's sets from prior session

---

## 4. Design tokens (the locked system)

Defined at [src/fitlog-mobile.html:20](src/fitlog-mobile.html#L20). All component CSS must reference these — no inline values for color, type, spacing, or elevation.

### Color
- `--ink` `#0f1622` — primary text, primary borders
- `--ink-2` `#2c3548` — gunmetal accent
- `--muted` `#5e6a82` — steel slate, secondary text
- `--label` `#8893a8` — cool grey, faint labels
- `--paper` / `--paper-2` / `--paper-3` — surface tiers
- `--accent` `#5d9bb8` — steel blue (primary brand)
- `--accent-2` `#7fa5c7` — icy lavender-blue
- `--accent-3` `#9eb5cb` — misty silver-blue
- `--ok` `#4f9aa8` — cool teal (success / working set)
- `--warn` `#8e9bb0` — slate
- `--bad` `#b08092` — desaturated mauve (warmup / destructive)

### The locked brand gradient
```css
linear-gradient(155deg, rgba(93,155,184,A) 0%, rgba(155,130,200,B) 55%, rgba(201,160,190,C) 100%)
```
Same hue triplet across the app; only the alpha trio `(A, B, C)` varies by surface. Typical values: hero cards `0.18/0.13/0.10`, session-stats panel `0.24/0.17/0.12`, AI rec pill `0.20/0.14/0.12`. Never substitute solid colors.

### Hairlines (separators)
- `--hairline` `rgba(15,22,34,0.25)` — visible separators
- `--hairline-soft` `rgba(15,22,34,0.11)` — quiet dividers
- `--hairline-strong` `rgba(15,22,34,0.20)` — emphatic dividers
- All separators are **1.2px** (not 1px) per the 2026-05-13 thickness pass.

### Type scale (eight steps)
- `--text-eyebrow` 12px — mono uppercase labels (the dominant micro-text)
- `--text-xs` 11px · `--text-sm` 12px · `--text-base` 13px · `--text-md` 14px
- `--text-lg` 15px · `--text-xl` 18px · `--text-2xl` 22px · `--text-3xl` 28px · `--text-display` 34px

### Weight ladder (five steps)
- `--weight-normal` 400 / `--weight-medium` 500 / `--weight-semibold` 600 / `--weight-bold` 700 / `--weight-heavy` 800

### Tracking + leading
- `--track-tight -0.018em` (display) / `--track-normal -0.005em` (body) / `--track-eyebrow 1.5px` (mono caps)
- `--leading-tight 1.1` / `--leading-snug 1.25` / `--leading-normal 1.45`

### Elevation
- `--depth-1` — chips, control backgrounds, list rows (barely lifted)
- `--depth-2` — sub-cards, stat rows (clearly elevated)
- `--depth-3` — hero cards, modals (primary elevation, uses `--glass-shadow`)

### Fonts
- `--font-display` — Inter Tight (headings, hero numerics)
- `--font-text` — system-ui + SF Pro + Inter Tight fallback
- `--font-mono` — Geist Mono / JetBrains Mono (all eyebrows, set numbers, prev/today data)

### Info-row anchor scale (memory: `feedback_information_row_typography.md`)
For compact info rows (name + metadata pill + count chip + action):
- Primary label (movement name): Inter Tight 600 / 16px
- Metadata pill (equipment): Geist Mono 700 / 12px / uppercase / 0.16em tracking
- Count chip (progress): Geist Mono 600 / 12px

Match this scale when adding similar info-density UI elsewhere.

---

## 5. Component patterns

The canonical components and what each represents. Reuse — don't reinvent.

| Pattern | Class(es) | Purpose |
|---|---|---|
| Today movement row | `.mv` | One movement on Today list. Drag-handle + body (name + equip pill) + progress chip + remove. Tap → Workout mode. |
| Movement equipment pill | `.mv .equip` + `.equip-pop` | Tap-to-edit popover for `entry.equipmentType` |
| Section eyebrow | `.section-eyebrow` | Body-part group header on Today (CHEST, BACK…) |
| Glass hero card | `.hero-card` | Insights cards (Readiness, Recovery, Fatigue, PRs) |
| Session-stats panel | `.progress` | The 3-stat Volume / Avg RPE / Complete% panel on Today |
| Set row | `.set-row` | Workout-mode columnar row: set# / WU-WS / BW / prev / today / ✓ / × |
| WU/WS toggle | `.set-row .wu-btn` | Green outline (working) / red outline (warmup) |
| BW toggle | `.set-row .bw-btn` | Solid black border + black text, fills on toggle |
| AI rec pill | `.rec-inline` | Coaching insight under last done set |
| Big-type hero | `.wm-hero` | Workout-mode primary: `weight × reps × rpe` as picker buttons |
| Back chip | `.back-chip` | Glass disc with accent-blue border + colorful drop shadow |
| Rest pill | `.pill-rest` | Workout-mode rest timer with `--ink` border + text |
| Picker overlay | `.pk-overlay` / `.pk-sheet` | Bottom-sheet number picker for weight/reps/RPE |
| Bottom nav | `.bottom-nav` | Today / Plan / Momentum / More |

When adding new UI, **first** scan the patterns above for a fit. Extend; don't duplicate.

---

## 6. CSS conventions

- Token references only — no `#0f1622`, no raw rgba, no Tailwind classes, no inline `style=""` except for runtime-computed values (animations, dynamic widths).
- Borders: `1.2px solid var(--hairline)` (or `--hairline-soft`, `--ink`, `--accent` etc.). Never `1px solid #...`.
- Shadows: prefer `--depth-1/2/3` or one of the documented hero/back-chip shadow stacks. Don't invent new shadow combinations.
- Border-radius scale: pills `999px`, chips/buttons `6–12px`, cards `14–22px`. Hero glass cards typically `22px` or `24px`.
- Backdrop blur for glass surfaces: 18–28px + saturate 140–160%. Add `-webkit-backdrop-filter` alongside.
- The `::after` glass-highlight pattern (top-down screen-blend white gradient) is the standard for the sheen on top of hero/back/progress surfaces.
- Animation: 150–300ms; `var(--ease-out-cubic)` or `var(--ease-premium)` for interactive feedback; never `linear` on UI; never >500ms for UI.
- Tap-feedback: `transform: scale(0.94–0.97)` on `:active`. Required on every interactive control.
- Dark-mode overrides live as separate blocks scoped with `body.theme-dark` selector, near the end of the CSS section.

---

## 7. JS conventions

- Vanilla JS, no framework. Functions are top-level, `function name() {...}`.
- DOM ops via `document.getElementById` / `document.querySelector` / `.addEventListener`. No JSX, no virtual DOM.
- Render functions are imperative — they take state from `data.active` / `data.workouts` and write innerHTML to a known root.
- V2-suffixed functions (e.g. `renderTodayV2`) are the canonical path. The non-suffixed versions are legacy and being phased out (per [`pm/port-plan.md`](pm/port-plan.md)).
- Persistence: call `saveData()` after any mutation to `data.*`. It handles localStorage + Supabase sync via the per-helper writes (`supabaseSyncMovement`, `supabaseSyncPlanItem`, `supabaseSyncWorkout`, etc.).
- Deletions: push the id to `data.tombstones.{movements,workouts}` so Supabase fetches filter them out.
- Identity: every entry carries `(canonicalMovement, equipmentType, variant)`. Equipment + variant are modifier fields — never appended to the movement name.
- Sets carry: `{ weight, reps, rpe, done, warmup, bw, prevW, prevR, prevRpe, baseline }`. Empty strings count as empty — use `hasV(v) => v != null && v !== ''` rather than `v != null`.

---

## 8. Voice + copy register

- INCYTE's voice is **clinical, direct, calibrated**. Like a thoughtful coach who respects the user's time.
- **Reject:** "Crush your goals!" "Let's get it!" "You got this!" "Oops!" emoji punctuation, ornamental flourishes, themed labels ("Tracking…" instead of "Loading…").
- **Aim for:** brief facts + one next action. "No sessions this week. Plan one." "Sync paused — check connection." "Saved."
- Today headlines pool (in `TODAY_HEADLINES_V2`) is curated to match this register. Add to it only with phrases that fit.
- Eyebrow / mono-caps labels are for *metadata*, not decoration. Don't use them as filler.

---

## 9. Figma MCP integration flow

When a Figma URL or selection is provided, the implementation flow is:

1. Parse `fileKey` and `nodeId` from the URL (or use desktop-app selection).
2. **Run `get_metadata` first** if the node is a page (`0:1`) or a large frame — INCYTE's Figma files contain seven full screen mockups side-by-side. The root canvas is too large for `get_design_context` in one pass.
3. Identify the specific frame to implement. Ask the user to narrow scope if metadata reveals multiple unrelated frames.
4. Run `get_design_context` on the chosen child node.
5. Run `get_screenshot` for the visual reference.
6. Download any localhost-served assets directly. **Do not** install new icon packages — INCYTE uses inline SVG only.
7. **Translate** the Figma output (typically React + Tailwind) into INCYTE's conventions:
   - Replace JSX with HTML inside `fitlog-mobile.html`'s body markup
   - Replace Tailwind utility classes with CSS rules in the existing stylesheet, using INCYTE tokens
   - Map Figma colors → `--accent` family / `--ink` / `--muted` / `--label`
   - Map Figma spacing → the type-scale + standard padding patterns
   - Map Figma typography → the existing type/weight/leading scale
   - Reuse existing components from §5 instead of duplicating
8. Validate the result against the Figma screenshot — visual parity is the bar.
9. If the Figma design conflicts with locked INCYTE direction (e.g. introduces a non-brand color, motivational copy, gaming aesthetics), **flag it to the user** rather than silently translating. The lock decisions are documented in `pm/decisions.md` and the visual-direction memory.

---

## 10. Workflow

- Edit `src/fitlog-mobile.html` directly. Commit each meaningful change.
- Read the relevant `pm/*.md` files before starting non-trivial work — they hold the project's settled decisions.
- Verify visually in the running preview server (`Claude Preview`) before reporting work done. Don't rely on type checks or test runs — there are none here.
- When the user says "snapshot the file" they mean `cp src/fitlog-mobile.html src/mobile{N+1}.html` where N is the highest existing number. They're aware this conflicts with the 2026-05-12 retirement decision; if it becomes a pattern, surface the contradiction.
- The repo is on `main` and `main` is the working branch. No branching workflow is in use.

---

## 12. Next.js build (`src/fitlog-nextjs/`)

The parallel build under construction. Different conventions from the HTML build — read these before editing inside `src/fitlog-nextjs/`.

**Tech stack** (locked):
- Next.js 14 app router · React 18 · TypeScript · Tailwind · Supabase SSR + JS · recharts
- Static export preferred so Capacitor wrapping is straightforward at launch

**Architecture rules:**
- **Shared Supabase project** with the HTML build (`drlmpltseepsxostsqdq`). Reads + writes the same `workouts` / `movements` / `plans` rows. The scaffold's `supabase/schema.sql` is stale — the canonical schema is what the HTML build at [src/fitlog-mobile.html:17042](src/fitlog-mobile.html#L17042) writes (`workouts` row with inline `entries` jsonb, `device_id` keying, columns: `id, device_id, name, date, finished, entries, saved_at`).
- **Auth:** anonymous `device_id` during build/test phase. Full Supabase auth becomes a launch blocker (Phase 8 in `pm/nextjs-port-plan.md`).
- **Engine logic is canonical in the HTML build** — Next.js implementations port the *behavior*, not the source. Each ported function header should cite the source line in `fitlog-mobile.html` so behavior contracts stay traceable.
- **IA:** Today / Plan / Momentum / More (canonical, per `pm/decisions.md` 2026-05-12). Routes: `/today`, `/plan`, `/momentum`, `/more`. The scaffold's existing pages (history, movements, progress) get absorbed under More.

**Component conventions:**
- Tokens live in `tailwind.config.ts` (palette, type scale, weight ladder, tracking, leading). Same values as the HTML build's `:root` tokens — don't drift.
- Tailwind for layout + spacing + color utilities.
- For glass-treatment surfaces (`.hero-card`, `.progress`, `.back-chip`), use component-level CSS modules — Tailwind's `bg-gradient-to-br` + `backdrop-blur` + `shadow` can't easily express the layered `box-shadow` + `::after` sheen + `backdrop-filter` combos that mobile351 uses. Token names match across both implementations.
- Animation register: same 150–300ms / `ease-out-cubic` ceiling as the HTML build. No external animation libraries (per memory `reference_animation_libraries.md`).

**Visual parity bar:**
- 1:1 with mobile351 for every shipped surface. Compare side-by-side before marking a phase done.
- The locked palette, the 12px eyebrow scale, the 1.2px hairlines, the steel-blue/lavender/soft-pink gradient — all of it is non-negotiable. If you find yourself reaching for a different color or a new size, stop and check the HTML build.

**File layout:**
```
src/fitlog-nextjs/
├── src/
│   ├── app/                    ← routes (today, plan, momentum, more, etc.)
│   ├── components/             ← shared UI components (BottomNav, GlassCard, ...)
│   ├── lib/
│   │   ├── db.ts              ← Supabase query helpers (rewritten Phase 0)
│   │   ├── types.ts           ← HTML-compatible types (rewritten Phase 0)
│   │   ├── device.ts          ← device_id helper
│   │   ├── engine/            ← ported engine logic (fatigue, 1RM, recommendations)
│   │   └── supabase/          ← Supabase client setup (server.ts, client.ts)
│   └── styles/                 ← shared CSS modules for glass surfaces
├── tailwind.config.ts          ← INCYTE tokens
└── supabase/schema.sql         ← STALE — do not trust; HTML build's writes are canonical
```

**Workflow for Next.js build:**
- `cd src/fitlog-nextjs && npm run dev` to run locally on `http://localhost:3000`
- Commits to this directory should be prefixed `nextjs:` so they're separable from the HTML build's history (which uses `src:`)
- Visual verification: open both `mobile351.html` and the Next.js page side-by-side. If they don't match, the Next.js side is wrong.
- Engine verification: read the HTML build's function, port the behavior, then test against the same input fixtures the HTML build would produce.

**Where to read first:** [`pm/nextjs-port-plan.md`](pm/nextjs-port-plan.md) — phased plan with the work breakdown.

---

## 11. Where to read next

| Document | When to read |
|---|---|
| [`pm/handoff.md`](pm/handoff.md) | First-time orientation. Vision + IA + active work. |
| [`pm/roadmap.md`](pm/roadmap.md) | What ships when. |
| [`pm/backlog.md`](pm/backlog.md) | Every bug / feature / distribution item. |
| [`pm/decisions.md`](pm/decisions.md) | Why anything is the way it is. Append-only. |
| [`pm/port-plan.md`](pm/port-plan.md) | The Today + Workout-mode prototype port (HTML build). Read before touching Today/Workout. |
| [`pm/nextjs-port-plan.md`](pm/nextjs-port-plan.md) | The Next.js port plan. Read before editing `src/fitlog-nextjs/`. |
| [`pm/launch-quality.md`](pm/launch-quality.md) | Pre-submission checklist. |
| `~/.claude/projects/-Users-albertrylo/memory/feedback_visual_direction.md` | Locked token system. |
| `~/.claude/projects/-Users-albertrylo/memory/feedback_positioning_and_voice.md` | Voice rules. |
| `~/.claude/projects/-Users-albertrylo/memory/feedback_information_row_typography.md` | Info-row scale anchor. |
