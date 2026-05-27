# Workout Mode — Design + Engineering Handoff Package

> **Subject:** The cassette-deck set-logging screen (`/today/workout`)
> **Purpose:** Complete reverse-engineered specification for a production rebuild by Claude Design.
> **Status:** Documentation only — no redesign. This describes the system as built + everything it implies.
> **Source of truth:** `src/fitlog-nextjs/src/app/today/workout/page.tsx` (1170 lines), `src/fitlog-nextjs/src/app/today/workout/WorkoutPage.module.css` (1263 lines), `src/fitlog-nextjs/src/lib/engine/workout.ts` (331 lines), and the visual prototype `public/workout-alt.html`.
> **Compiled:** 2026-05-23.

This document is grounded in the actual implementation — function names, formulas, thresholds, and values are real, not inferred. Where something is implied-but-not-built, it is marked **[IMPLIED]**.

---

## 1. Product Vision

Workout Mode is the **single most important screen in INCYTE** — it is where the core value exchange happens: the user logs a set, and the app calibrates feedback. Every other surface (Today, Plan, Momentum) exists to feed this screen or to reflect what happened on it.

The design metaphor is a **cassette deck / MPC drum machine** — a piece of tactile studio hardware. This is deliberate: logging a set should feel like operating an instrument, not filling out a form. The user is mid-workout, sweating, possibly one-handed, cognitively loaded. The interface must reduce every interaction to a glance and a thumb-tap.

**One movement at a time.** Workout Mode shows exactly one movement (e.g., "Bench Press"). The user logs each set, the deck advances, and on completion the movement auto-archives and routes back to Today. There is no multi-movement scroll here — that's the Today list's job.

**Core loop:**
```
Enter (from Today tap) → see current set's target → adjust weight/reps/RPE
→ LOG SET → reel spins, rest timer counts down → next set auto-loads
→ repeat → last set logged → auto-archive → route to Today
```

---

## 2. UX Philosophy

### Emotional design intent
- **Tactile authority.** The hardware aesthetic signals "this is a serious instrument for serious training." It rejects the gamified, confetti-driven register of consumer fitness apps.
- **Calm under load.** Dark chamber, single focal readout, one primary action button. Nothing competes for attention with the number you're about to log.
- **Mechanical honesty.** Reels spin during rest (work is happening). LEDs glow when active. The machine reflects state physically — no abstract spinners.

### Why machinery
A drum-machine/cassette metaphor maps perfectly onto set-logging: discrete, repetitive, rhythm-based actions (log, rest, log, rest) are exactly what an MPC is built for. The big yellow LCD numerals are legible at arm's length in a gym. The physical-button affordances (rim-lit, press-to-translateY) make the primary action unmissable for a thumb.

### Friction reduction
1. **Pre-seeded values.** Every set opens pre-filled from the prior session (`defaultSetsFor`) or the previous logged set (weight carries forward). The common case is: glance, confirm, LOG SET — zero adjustment.
2. **One primary action.** LOG SET is the only button you need 90% of the time. Everything else (adjust, rest edit, set type) is secondary.
3. **Auto-advance.** Logging a set auto-loads the next, auto-starts rest, auto-spins reels. No manual "next set" tap.
4. **Auto-archive + auto-route.** Finishing the last set saves and returns to Today. No "save" decision.

### Cognitive-load minimization
- Only the **current set** is in the hero. Other sets live in a secondary list.
- RPE shows `—` when empty (not `0`) — no false precision.
- Recommendations are opt-in (AI ASSIST toggle), not always-on noise.

---

## 3. Screen Breakdown

### 3.1 Top Header (status bar)

Three zones, flex row:

| Zone | Element | Function |
|---|---|---|
| Left | `BACK` button | `stopRest()` then `router.push('/today')`. Abandons no data — everything is already persisted per-set. |
| Center | `★ ACTIVE SET │ N / TOTAL` pill | Live indicator of which set is current. `N` = `currentSetIdx(entry) + 1`; `TOTAL` = `entry.sets.length`. The `★` is a pulsing yellow LED (1.2s pulse). The counter has a yellow LCD glow. |
| Right | `AI ASSIST` button | Toggles `aiOn` boolean. Green LED blinks when armed. When on, logging a set fires a delayed coaching toast (see §5.4). |

**Active-set logic:** `currentSetIdx()` returns the first undone set's index, or `-1` if all done. The header always reflects the set you're about to log. When all sets are done, the screen auto-completes before the header can show an out-of-range value.

**Session continuity:** The active workout row (`finished: false`) persists in Supabase. Re-entering the screen (`load()`) finds the existing active entry by `movementId` and restores all logged sets. There is no "resume?" prompt — state is always live.

### 3.2 Main Workout Console (the cassette tape)

A single inline SVG (viewBox ~`0 0 360 180`) inside a glossy translucent-plastic wrapper. Three horizontal zones:

**Zone A — Readout strip (top).** Dark near-black (`#050607`) rounded rect. Three big yellow Share-Tech-Mono numerals (font-size 38, yellow glow drop-shadow):
- `WEIGHT` (left label) → current set's weight, default placeholder `135`
- RPE (center, no header) → current set's RPE, shows `—` when empty
- `REPS` (right label) → current set's reps, default `19`

**Zone B — Twin reels (center).** Two circular reel/cog SVG groups (`reelLRef`, `reelRRef`) with a ribbed tape window between them. Idle: static. During rest: `.spinning` class applied → `@keyframes spin-svg` (2s linear infinite). Reels represent **active rest/recovery time elapsing** — the tape is "playing."

**Zone C — Rest/Timer LCD strip (bottom).** Dark rect. `⏵ REST` (left), `MM:SS` countdown (center, white, letter-spacing 4px), `TIMER ⏸` (right). Tapping it opens the rest-duration editor. Below: `TAP TIMER TO EDIT` hint.

### 3.3 Button Row

Two matte-black rim-lit buttons (locked lighting standard, CLAUDE.md §14):
- `▼ ADJUST ▼` — opens the fader/picker panel to change weight/reps/RPE of the current set
- `▶ LOG SET N` — the primary action; text always yellow

### 3.4 VU Meter [partially built]

`vuBarsRef` + `startVuAnim`/`stopVuAnim`/`resetVuToRpe` — an SVG VU-meter that animates during rest and settles to a level representing the last set's RPE. This is the "audio level" metaphor mapping onto effort.

### 3.5 Set List [secondary, below console]

The full set list for the movement — each row shows set number, prev reference (`prevW × prevR`), today's values, done state, and per-set controls (WU/WS toggle, BW toggle, reopen, remove). Add-set button appends a set copying the last set's weight/reps.

### 3.6 Bottom Navigation

MPC chassis nav (INSIGHT/TODAY/PLAN/MORE). On this screen it's suppressed in some configs (NavGuard skips `/today/workout`) or rendered inline — confirm current routing. Each tab is `router.push`.

---

## 4. Component Architecture

### Current (as built — monolithic, to be decomposed)
```
WorkoutPageShell (Suspense wrapper)
└── WorkoutPage (1170 lines — everything inline)
    ├── SvgSymbols (icon defs)
    ├── Header (BACK, ACTIVE SET pill, AI ASSIST) — inline JSX
    ├── Cassette SVG (readout, reels, timer strip) — inline JSX
    ├── Button row (ADJUST, LOG SET) — inline JSX
    ├── Fader panel (weight/reps/rpe faders) — inline JSX
    ├── Manual picker (tap-LCD-to-type) — inline JSX
    ├── Set list — inline JSX
    ├── Toast — inline JSX
    └── BottomNav — inline JSX
```

### Recommended decomposition (rebuild target)
```
features/workout/
├── WorkoutScreen.tsx              ← orchestrator, ~150 lines
├── components/
│   ├── WorkoutHeader.tsx          ← BACK + ActiveSetPill + AIAssistToggle
│   ├── ActiveSetPill.tsx
│   ├── AIAssistToggle.tsx
│   ├── CassetteDeck.tsx           ← the SVG console
│   │   ├── ReadoutStrip.tsx       ← weight/rpe/reps numerals
│   │   ├── ReelPair.tsx           ← twin reels + spin state
│   │   ├── TapeWindow.tsx
│   │   └── TimerStrip.tsx         ← rest LCD
│   ├── VUMeter.tsx
│   ├── ButtonRow.tsx              ← AdjustButton + LogSetButton
│   ├── FaderPanel.tsx             ← weight/reps/rpe faders
│   │   └── Fader.tsx              ← single fader (drag + bars + thumb)
│   ├── ManualPicker.tsx           ← tap-LCD-to-type overlay
│   ├── SetList.tsx
│   │   └── SetRow.tsx             ← WU/BW/reopen/remove
│   └── Toast.tsx
├── hooks/
│   ├── useWorkoutSession.ts       ← load/persist/active-entry resolution
│   ├── useRestTimer.ts            ← countdown + persistence + reels
│   ├── useFader.ts                ← drag math, ratio↔value
│   ├── useAiRec.ts                ← computeAiRec thresholds
│   └── useVuMeter.ts
└── engine/                        ← (shared, already exists in lib/engine/workout.ts)
```

### Key hooks to extract

**`useWorkoutSession(mid, planId, srcId)`** — owns: `mv`, `activeWorkout`, `entry`, `allWorkouts`, `lastEntryRef`. Exposes: `logSet()`, `reopenSet()`, `toggleType()`, `toggleBW()`, `addSet()`, `removeSet()`, `patchCurrent()`, `complete()`. Encapsulates the `load()` + `persist()` flow.

**`useRestTimer(defaultSecs)`** — owns countdown state, `setInterval` ref, start/stop, "REST COMPLETE" toast trigger, and the reel-spin side-effect.

**`useFader(key, value, onChange)`** — owns drag tracking, `ratioToValue`/`valueToRatio` curve math, bar painting, thumb position.

---

## 5. Interaction Systems

### 5.1 Weight / Reps / RPE adjustment

Two input paths, both writing to the **current set** (`currentSetIdx`):

**Path A — Fader drag (ADJUST panel).**
- Vertical drag on a fader track maps drag ratio → value via a power curve.
- `ratioToValue(key, ratio)`:
  ```
  curved = curve > 1 ? ratio^curve : ratio
  raw    = min + curved * (max - min)
  stepIdx = round((raw - min) / step)
  value  = clamp(min, max, min + stepIdx * step)
  ```
- `valueToRatio(key, value)` is the inverse (uses `^(1/curve)`).
- Config (`PICKER_CFG`):
  | Field | min | max | step | curve |
  |---|---|---|---|---|
  | weight | 0 | 500 | 5 | 2 (compressed at top) |
  | reps | 1 | 30 | 1 | 1 (linear) |
  | rpe | 1 | 10 | 0.5 | 1 (linear) |
- 14 bars (`FADER_BARS`), top 2 bars light "hot" (red-ish) when near max.
- The weight fader curve=2 means fine control at low weights, coarse at heavy — matches how lifters think (5lb jumps matter more at 95 than at 405).

**Path B — Manual picker (tap an LCD numeral).**
- Tapping a readout opens a typed-input picker (`picker` state: `{field, value}`).
- Direct numeric entry for users who know their exact number.

**Engine:** Both paths call `patchSet(sets, idx, field, value)` → `patchCurrent()` → `persist()`. Every adjustment writes through to Supabase immediately (no debounce in current build — **[DEBT]** should debounce).

**Progressive overload integration:** When a set is logged, the next set's weight is preloaded from the most-recent done set (`useEffect` on `entry.sets.length`), resetting reps/rpe. This carries weight forward automatically.

### 5.2 RPE system

- Selectable 1–10 in 0.5 steps.
- Stored per-set as `rpe`.
- Feeds the **calibration engine** (`momentum.ts`): `calibrateRpe(rpe) = rpe - 0.4 - max(0, rpe - 6.5) × 0.3`. Trained lifters overestimate; the engine corrects downward.
- Drives the **AI recommendation** (§5.4) and **VU meter level**.
- Empty RPE renders as `—` (never `0`).

### 5.3 Reps system

- Target reps pre-seed from plan (`planReps`) or prior session.
- Completed reps = what the user logs.
- **Failure handling [IMPLIED]:** No explicit "failure" flag in current schema. A set logged below target reps is implicitly a missed target; the recommendation engine reads the actual reps. **[REBUILD: add `failed?: boolean` or `targetReps` to SetEntry for explicit failure tracking.]**
- **PR detection [IMPLIED]:** `computePRs()` in `momentum.ts` detects PRs across history; not surfaced live in Workout Mode. **[REBUILD: flash a PR badge on LOG SET when the logged set beats the movement's prior best.]**

### 5.4 AI Assist

- Toggle (`aiOn`). When armed and a set is logged, after a 1600ms delay, a coaching toast appears for 4500ms.
- `computeAiRec()` reads the last done set's RPE and branches:
  | Last set RPE | Recommendation |
  |---|---|
  | ≥ 9.5 | "drop 10 lb · high effort last set" |
  | ≥ 9 | "−5–10 lb · near max" |
  | ≥ 8.5 | "same weight or −5 lb" |
  | ≥ 8 | "hold weight" |
  | ≥ 7 | "same or +5 lb" |
  | ≥ 6 | "+5–10 lb · room to push" |
  | < 6 | "+10 lb · effort too low" |
- These thresholds are kept in lockstep with the canonical `nextSetRec` in the engine.
- **[IMPLIED future]:** This is currently a rules-based heuristic. The `ai-insights` Edge Function would replace it with an LLM call that considers full history, fatigue, and the user's calibration profile.

### 5.5 LOG SET (the critical path)

`handleLogSet()`:
```
1. idx = currentSetIdx(entry); if -1 → toast "ALL SETS COMPLETE", return
2. Validate: weight present? else toast "SET A WEIGHT"
3. Validate: reps present? else toast "SET REPS"
4. newSets = logSet(sets, idx)   // marks done:true, baseline:false
5. setEntry(newEntry)            // optimistic UI
6. await persist(newEntry)       // Supabase upsert
7. toast "SET N LOGGED"
8. if aiOn → schedule AI rec toast (+1600ms)
9. if allSetsDone(newSets):
      → handleComplete(newEntry)  // archive
      → router.refresh()
      → router.push('/today')
      → return
10. startRest()  // begin countdown, spin reels, animate VU
```

**Optimistic UI:** State updates before the await resolves. **[DEBT]: no rollback if `persist` fails — failure is a silent `console.warn`.** A rebuild must surface write failures and roll back the optimistic state.

### 5.6 Set completion / archive

`handleComplete()` → `archiveEntryToToday(entry, allWorkouts)`:
- Finds today's existing finished session (by local-midnight date match).
- If none: creates a new finished workout row (`autoArchived: true`, `workout_status: "completed"`, `name` from `buildSessionName`).
- If exists: merges the entry into it. If the same movement already archived today, **appends sets** to the prior entry (same-day merge).
- Then trims the completed movement out of the active (unfinished) workout.

This is the **same-day merge** behavior — critical to prevent duplicate session rows.

### 5.7 Set-list interactions

| Control | Engine fn | Behavior |
|---|---|---|
| Reopen | `reopenSet(sets, idx)` | `done: false`, preserves values |
| WU/WS toggle | `toggleSetType` | flips `warmup` flag; warmups excluded from volume/progression |
| BW toggle | `toggleBodyweight` | flips `bw` flag; modifies weight semantics |
| Add set | `addSet` | appends, copying last set's weight/reps |
| Remove set | `removeSet` | min 1 enforced; confirms if set was done |

---

## 6. State Architecture

### Local state (per-screen, useState/useRef)
```
mv: Movement | null              ← the movement being logged
activeWorkout: Workout | null    ← the unfinished session row
allWorkouts: Workout[]           ← unfinished + finished-today (for prev lookup + archive)
entry: WorkoutEntry | null       ← the active entry for THIS movement (the editable copy)
lastEntryRef: WorkoutEntry|null  ← prior session's entry (for prev-value seeding)
aiOn: boolean
faderOpen: boolean
restSecs: number (default 90)    ← configured rest duration
restRemaining: number            ← live countdown
picker: {field, value} | null    ← manual entry overlay
toast / toastKind
visualRotRef: {weight, reps}     ← fader→reel rotation cache
```

### Persisted state (Supabase `workouts` table)
- The active workout row (`finished: false`) carries the in-progress entry with all logged sets.
- Written on **every** mutation via `persist()` → `upsertWorkout()`.
- This IS the recovery mechanism: close the app mid-set, reopen, `load()` restores everything.

### Optimistic update flow
```
user action → setEntry (instant UI) → persist() → upsertWorkout() →
  success: (no-op, state already current)
  failure: console.warn  ← [DEBT: must become rollback + toast]
```

### Offline behavior [DEBT — not implemented]
- Currently: offline mutations fail silently. Logged sets would be lost on refresh.
- **Rebuild requirement:** IndexedDB write-through + sync queue. localStorage mirror of the active workout at minimum.

### Workout recovery flow
- `load()` re-fetches the unfinished workout (limit 5, newest) and finds the entry by `movementId`.
- If a `src` param is present, loads from a finished session (edit-past-session path).
- If no active entry exists, seeds one via `defaultSetsFor` and creates/updates the active workout.

### App-restoration behavior
- The screen is keyed by URL params (`mid`, `planId`, `src`). Deep-linkable.
- `--vh` CSS var recomputed on resize/orientationchange for iOS viewport stability.

---

## 7. Backend / Data Architecture

### Tables involved

**`workouts`** (inline-jsonb model, the actual production schema):
```
id            uuid PK
device_id     uuid          ← identity (or user_id post-auth)
name          text          ← e.g. "Chest · Back · Shoulders"
date          date
finished      boolean       ← false = active session, true = archived
entries       jsonb         ← WorkoutEntry[] (inline, NOT normalized)
saved_at      timestamptz
completed_at  timestamptz
edited_at     timestamptz
workout_status text          ← "completed" | "saved"
notes         text
```

**`entries` jsonb element (`WorkoutEntry`):**
```json
{
  "movementId": "uuid",
  "planId": "string|null",
  "canonicalMovement": "string",
  "equipmentType": "barbell|dumbbell|cable|machine|bodyweight|unspecified",
  "variant": "string?",
  "muscle": "string",
  "name": "string",
  "sets": [ SetEntry... ],
  "skipped": false,
  "archivedAt": "iso"
}
```

**`SetEntry`:**
```json
{
  "weight": 135, "reps": 8, "rpe": 8.5,
  "done": true, "warmup": false, "bw": false,
  "prevW": 130, "prevR": 8, "prevRpe": 8,
  "baseline": false,
  "time": null, "distance": null, "incline": null, "speed": null, "bpm": null
}
```

**`movements`** — supplies `name`, `canonicalMovement`, `equipmentType`, `muscle`, `defaultSets`.

**`plans`** — supplies `planId`, `sets`, `reps` for seeding.

### Writes from this screen
- Every adjustment / log / toggle → `upsertWorkout(activeWorkout)` (full row upsert).
- Completion → `upsertWorkout(archivedSession)` + `upsertWorkout(trimmedActiveWorkout)`.

### Realtime [IMPLIED — not wired]
- No Supabase Realtime subscription currently. **Rebuild:** subscribe to the active workout row so a second device (watch, phone) sees live updates. Critical for an eventual Apple Watch companion.

### Timer persistence [DEBT]
- `restRemaining` is in-memory only. Closing the app loses the countdown. **Rebuild:** persist `restEndsAt` timestamp to localStorage; on resume, compute remaining from wall-clock.

### Analytics storage [IMPLIED]
- Per-set events (logged, reopened, adjusted) should emit structured analytics for the AI training signal (CLAUDE.md §13-R). Not currently emitted.

### Recommended normalized schema (rebuild option)
If moving off inline jsonb:
```
workouts (id, user_id, date, finished, name, status, started_at, completed_at)
workout_entries (id, workout_id FK, movement_id FK, position, canonical_movement, equipment_type, variant)
sets (id, entry_id FK, position, weight, reps, rpe, done, warmup, bw, logged_at)
```
Trade-off: easier querying/analytics vs. more round-trips. The inline model is faster for the write-heavy logging loop; normalize only if analytics queries demand it.

---

## 8. Animation System

### Motion language
Mechanical, not bouncy. Everything mimics physical hardware: buttons depress, reels spin, LEDs glow, faders slide.

### Timing + easing
| Element | Duration | Easing |
|---|---|---|
| Button press | 0.08s | ease-out |
| Button glow (color/text-shadow) | 0.15s | ease-out |
| Open-arrow rotate | 0.4s | ease |
| Fader panel expand | 0.45s | cubic-bezier(0.4, 0, 0.2, 1) |
| Reel spin | 2s | linear infinite (only physical-motion element that's linear) |
| LED pulse | 1.2s | infinite |
| AI LED blink | 1.5s | infinite |

### Glow systems
- Yellow active glow: `text-shadow: 0 0 8px var(--yellow), 0 0 18px rgba(245,236,0,0.5)`
- LCD numerals: `drop-shadow(0 0 5px rgba(245,236,0,0.7))`
- LEDs: layered `box-shadow` glows

### Idle vs active
- **Idle:** reels static, VU at RPE-rest level, no toast.
- **Logging:** button flash, toast slide-in.
- **Resting:** reels spin (2s linear), VU animates, countdown ticks.

### Transition hierarchy (what animates when)
1. LOG SET pressed → button depress (0.08s) + yellow flash
2. Toast slides in "SET N LOGGED"
3. Reels begin spinning, VU animates, timer counts
4. (if AI) coaching toast at +1.6s
5. On completion → route transition to Today

### Reduced motion [DEBT]
`prefers-reduced-motion` not honored. Rebuild must disable reel spin / pulse / VU when set.

---

## 9. Design System

### Color tokens
```
--bg-deep:    #0e1012   --btn-face:  #38383c
--metal-edge: #3a3f44   --yellow:    #f5ec00   --yellow-glow: rgba(245,236,0,0.5)
--text:       #e8e8e8   --text-dim:  #6a6e72    --text-mid: #9ba0a5
--green-led:  #4ecb71   --red-active:#FF3D3D
```
INCYTE brand palette (steel-blue/lavender/soft-pink) governs the rest of the app; Workout Mode adds the cassette-specific industrial yellow/green LEDs on matte black. **Yellow is the in-deck active color; red is reserved for warnings/destructive.**

### Typography
| Use | Font | Size |
|---|---|---|
| LCD numerals (weight/reps/rpe) | Share Tech Mono | 38px |
| LCD labels (WEIGHT/REPS) | Share Tech Mono | 10.5px |
| Button labels | Black Ops One | 11px |
| Status labels (ACTIVE SET) | Barlow Condensed 700 | 9px |
| Timer | Share Tech Mono | 16px, letter-spacing 4px |

### Depth layering (z-order, outer→inner)
1. Chrome outer panel (`.cassette-panel`) — bright edge gradient + corner rivets
2. Recessed chamber (`.cassette-panel-inner`) — inset shadows
3. Glossy plastic cassette (`.cassette-svg-wrap`) — multi-layer gloss gradients + crystal top stripe
4. Dark LCD strips (`#050607`) — deepest, inset

### Shadow systems
- Buttons: layered outer drop (`0 6px 12px`, `0 2px 4px`) + inset top highlight; press collapses to inset.
- Chamber: triple inset (`inset 0 1px 0` highlight, `inset 0 0 0 1px` border, `inset 0 2px 6px` depth).

### Radius scale
- Outer panel: 12px
- Inner chamber: 8px
- Cassette: 10px
- LCD strips: 4px
- Buttons: 3px (nav-pad scale)
- Rivets: 50%

### Spacing
- Panel padding: 4px (outer), 14px (chamber)
- Button row gap: 8px
- Status bar margin-bottom: 10px

---

## 10. Mobile UX Rules

### Thumb zones
- **LOG SET** sits in the bottom-right primary thumb arc — the most reachable zone for right-handed one-handed use.
- ADJUST is bottom-left (secondary thumb reach).
- BACK / AI ASSIST are top corners (require a reach or two-hand, acceptable for infrequent actions).

### Safe areas
- `env(safe-area-inset-*)` on the page shell.
- `--vh` custom property (set from `window.innerHeight`) instead of `100vh` — iOS Safari chrome would otherwise push content behind the address bar.

### One-handed interaction
- Primary loop (glance → LOG SET) is entirely bottom-thumb-reachable.
- Fader drags are vertical (natural thumb arc).

### Haptics [IMPLIED — not implemented]
- **Rebuild:** `navigator.vibrate()` (web) / Capacitor Haptics on: LOG SET (medium), set complete (success pattern), rest complete (double tap), fader step (light tick per step). Critical to the tactile-hardware feel.

### Audio feedback [IMPLIED]
- **Optional rebuild:** subtle mechanical click on LOG SET, reel-stop sound on rest complete. Off by default; opt-in. Matches the hardware metaphor without being intrusive.

### Accessibility
- Touch targets ≥ 44×44px (buttons satisfy this; verify LCD-tap-to-edit targets).
- Icon buttons need `aria-label` (BACK has it).
- Color-coded states (yellow=active) must pair with text/icon — the ACTIVE SET pill pairs the star + counter, good.
- `prefers-reduced-motion` — **[DEBT]**.

---

## 11. Edge Cases

| Case | Current behavior | Rebuild requirement |
|---|---|---|
| LOG SET with no weight | Toast "SET A WEIGHT", blocks | Keep; consider inline highlight on the weight readout |
| LOG SET with no reps | Toast "SET REPS", blocks | Keep |
| All sets already done | Toast "ALL SETS COMPLETE" | Shouldn't be reachable (auto-completes) — defensive |
| Remove last remaining set | Toast "NEED ≥ 1 SET", blocks | Keep |
| Remove a logged set | `confirm()` dialog | Replace native confirm with in-app sheet |
| Re-entering mid-session | `load()` restores from active workout | Keep; this is the recovery path |
| Editing a past session (`src` param) | Loads finished session, completion routes back without re-archiving | Keep; distinct flow |
| No prior session data | `defaultSetsFor` falls back to plan sets → 3 blank sets | Keep |
| Offline during LOG SET | Silent failure, data lost on refresh | **CRITICAL: queue + persist locally + retry** |
| Rest timer running, app backgrounded | Countdown lost (in-memory) | **Persist `restEndsAt`, recompute on resume** |
| Network failure on persist | `console.warn`, optimistic state stays (diverges from DB) | **Rollback + error toast** |
| Same movement logged twice today | `archiveEntryToToday` appends sets to existing entry | Keep (same-day merge) |
| Movement deleted while in active workout | Entry still references dead `movementId` | Guard: show "movement removed" state |
| RPE left empty | Stores null, shows `—`, AI rec skips it | Keep |
| Reps below target (failure) | Logged as-is, no failure flag | **Add explicit failure tracking** |

---

## 12. Technical Recommendations

### Frontend
- **Framework:** Next.js 14 App Router + React 18 + TypeScript (current). Static export for Capacitor.
- **State:** Extract per-concern hooks (`useWorkoutSession`, `useRestTimer`, `useFader`, `useAiRec`, `useVuMeter`). Consider Zustand for the active-session store so the watch/phone could share it.
- **Server data:** React Query for caching + optimistic mutations + retry + offline persistence (replaces the current hand-rolled optimistic-with-no-rollback pattern).
- **Animation:** CSS-only (current constraint — no animation library per memory). SVG `transform` for reels. Honor `prefers-reduced-motion`.
- **Folder structure:** the `features/workout/` tree in §4.

### Backend
- **Keep inline-jsonb `workouts`** for the write-heavy logging loop (fewer round-trips). Normalize only if analytics demand it.
- **Add Realtime subscription** on the active workout row (watch companion + multi-device).
- **Add a sync queue table or use IndexedDB** for offline writes.
- **Emit structured analytics events** (`set_logged`, `set_reopened`, `rest_started`, `movement_completed`) for the AI training signal.
- **Move AI rec server-side** — replace `computeAiRec` heuristic with the `ai-insights` Edge Function (currently 401s, needs deploy), with the rules-based version as fallback.

### Mobile UX
- Add Capacitor Haptics on the key transitions (§10).
- Persist `restEndsAt` for timer survival across backgrounding.
- Verify all tap targets ≥ 44px, especially LCD-tap-to-edit zones.

---

## 13. Build Sequence

| # | Step | Depends on | Risk |
|---|---|---|---|
| 1 | Extract `lib/engine/workout.ts` (done — keep, add tests) | — | LOW |
| 2 | `useWorkoutSession` hook (load/persist/mutations) | engine | MEDIUM |
| 3 | `CassetteDeck` + sub-components (ReadoutStrip, ReelPair, TimerStrip) | session hook | MEDIUM |
| 4 | `useRestTimer` with persisted `restEndsAt` | — | MEDIUM |
| 5 | `Fader` + `useFader` (drag/curve math) | — | MEDIUM |
| 6 | `ManualPicker` overlay | session hook | LOW |
| 7 | `SetList` + `SetRow` | session hook | LOW |
| 8 | `ButtonRow` (ADJUST/LOG SET) wiring | all above | LOW |
| 9 | `AIAssistToggle` + `useAiRec` | session hook | LOW |
| 10 | Offline queue + optimistic rollback + error toasts | session hook | HIGH |
| 11 | Haptics + reduced-motion + a11y pass | all | LOW |
| 12 | Realtime subscription | backend | MEDIUM |
| 13 | Tests: engine (unit) + log-set flow (integration) | all | — |

**MVP cut:** steps 1–9 reproduce the current screen cleanly. Steps 10–13 make it production-grade.

---

## 14. Future Scalability Recommendations

- **Apple Watch companion** — the active-workout-row + Realtime architecture is the foundation. Watch logs a set → Realtime → phone deck updates. Design the session store to be device-agnostic now.
- **AI coaching upgrade** — `computeAiRec` is a 7-branch heuristic. The real engine should consider full history, calibrated RPE trend, fatigue (`computeOverallFatiguePct`), and the movement's progression curve. Server-side Edge Function, cached, with the heuristic as offline fallback.
- **Set-type expansion** — current SetEntry supports strength + mobility (`time`) + cardio (`distance/incline/speed/bpm`). The deck currently renders the strength variant. Build deck variants: mobility (time-only big readout), cardio (distance/time/pace). The readout zone is the swap point.
- **Failure / RIR explicit tracking** — add `targetReps` and `failed` to SetEntry for honest progression math.
- **Superset / circuit support** — current model is one-movement-at-a-time. A superset would need the deck to cycle movements within a set. Significant — design the session model to allow movement grouping if this is on the roadmap.
- **Audio/haptic theme** — the hardware metaphor invites an optional sound pack (mechanical clicks, reel sounds). Off by default.
- **Offline-first as a first-class mode** — IndexedDB store, sync queue, conflict resolution. The gym is the worst-connectivity environment a user will be in; this is not optional long-term.
- **Analytics event stream** — every set interaction is an AI training signal. Structured events now = a richer coaching model later.

---

## Appendix A — Canonical engine functions (preserve exactly)

| Function | File | Purpose |
|---|---|---|
| `currentSetIdx(entry)` | workout.ts:19 | First undone set index, -1 if all done |
| `defaultSetsFor(opts)` | workout.ts:59 | Seed sets from prior session / plan / default |
| `logSet(sets, idx)` | workout.ts:114 | Mark done, clear baseline |
| `reopenSet` / `toggleSetType` / `toggleBodyweight` / `patchSet` / `addSet` / `removeSet` | workout.ts:121–172 | Set mutations (immutable) |
| `allSetsDone(sets)` | workout.ts:175 | Completion check |
| `buildSessionName(entries)` | workout.ts:186 | "Chest · Back · +" naming |
| `archiveEntryToToday(entry, workouts)` | workout.ts:207 | Same-day merge + finished-session creation |
| `PICKER_CONFIG` | workout.ts:288 | Fader presets/steps per field |
| `computeAiRec()` | workout/page.tsx:274 | RPE→recommendation thresholds |
| `ratioToValue` / `valueToRatio` | workout/page.tsx:464 | Fader curve math |

## Appendix B — Reference files
- Live prototype: `src/fitlog-nextjs/public/workout-alt.html` (CSS 525–770, markup/SVG 2567–3032)
- Current React implementation: `src/fitlog-nextjs/src/app/today/workout/page.tsx`
- Styles: `src/fitlog-nextjs/src/app/today/workout/WorkoutPage.module.css`
- Engine: `src/fitlog-nextjs/src/lib/engine/workout.ts`
- This panel's design brief (visual recreation): see prior session notes

_Compiled 2026-05-23. Grounded in actual implementation, not inference. **[IMPLIED]** / **[DEBT]** tags mark gaps between what's built and what production requires._
