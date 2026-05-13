# INCYTE — Cowork Session History

A running record of every meaningful decision, fix, and build across all Cowork sessions for the INCYTE fitness tracker app.

---

## Session 1 — "Rebuild app from HTML data"

### Goal
Rebuild the app from scratch with a clean data-governance model after the original version had data-seeding and auto-push bugs that were corrupting Supabase.

### Key decisions

**Data governance overhaul**
- `loadData()` became hydration-only — reads localStorage synchronously so the UI has something to render, then defers to Supabase
- `saveData()` no longer auto-pushes the entire local dataset to Supabase on every change
- All persistent writes now flow through targeted helpers: `supabaseSyncMovement`, `supabaseSyncPlanItem`, `supabaseDeletePlanItem`, `supabaseSyncWorkout`, `archiveWorkoutToCloud`
- `seedFromPlan()` converted to a no-op with a governance log; implementation preserved as `_seedFromPlan_DISABLED`
- Seed data constants kept as documentation only — no runtime path reads them

**Tombstone system**
- Deleting a movement adds its ID to `data.tombstones.movements`
- Future Supabase fetches filter tombstoned IDs so stale devices can't resurrect deleted records

**ID-based relationships enforced**
- Workouts reference `movementId`, plan items reference `mid`, sets stored under parent entry
- Orphan `movementId` references render as `"Unmapped data — requires user action"` in red italic instead of auto-creating movements

**Equipment + Variant architecture (specced, partially implemented)**
- Every movement instance should carry: Canonical Movement Name, Equipment Type, Variant
- Equipment and variant are modifier fields — never appended to the movement name
- Equipment options: Barbell, Dumbbell, Cable, Machine, Smith Machine, Bodyweight, Bands, Kettlebell, Plate Loaded, Suspension Trainer, Voltra
- Variant options: Standing, Seated, Incline, Single Arm, Bilateral, Chest Supported
- Progress, Today, Plan, and Library tabs should all allow viewing and editing equipment/variant
- PRs must remain equipment-specific (Barbell Bench PR ≠ Dumbbell Bench PR)
- Backward compat migration: `"Lateral Raise :: Dumbbell"` → `Movement = "Lateral Raise", Equipment = "Dumbbell"`

**1RM correction**
- Original bug: `Current 1RM = Estimated 1RM` (incorrect — implied user had actually lifted a projected weight)
- Fix: `Current 1RM = MAX(weight used in any completed working set)`
- Estimated 1RM (Epley formula) kept as a separate `"Projected Strength"` metric
- Display: Top Weight Lifted (actual) · Estimated 1RM (projected) · Heaviest Set (context)

### Files shipped
`mobile15.html` — data-governance enforcement build

---

## Session 2 — "Review plan page and provide feedback"

### Goal
Fix date rendering bugs and missing sessions in the Progress sparkline chart.

### Bugs fixed

**Date shift (UTC vs local timezone)**
- `new Date("2026-04-28")` treats the string as UTC midnight, which in US timezones rolls back to Apr 27
- Fix: `parseLocalDate()` helper — splits the ISO string and constructs the date in local timezone
- `toLocaleDateString('en-CA')` used throughout for YYYY-MM-DD comparisons to avoid UTC drift

**Flat sparkline**
- When two sessions had identical (or very close) e1RM values, `range = maxV - minV || 1` collapsed everything to a 1-unit range
- All dots piled at the same y-coordinate near the bottom, looking like a flat line
- Fix: Added 15% padding above and below the data range; equal values now centre in the chart

**Missing sessions in the progression graph**
- Root cause: chart required `s.done === true` on every set; older sessions logged before the `done` flag was standardised were silently skipped
- Fix: relaxed filter to accept any non-warmup set with weight logged, done or not
- Added debug badge below the PR strip showing "N sessions · M workouts scanned" to make data load visible at a glance

### Files shipped
`mobile289.html` — date fix  
`mobile290.html` — sparkline fix + debug badge

---

## Session 3 — Main INCYTE development (compacted)

This session covers the longest stretch of work, spanning mobile291 through mobile332.

### Same-day session merging (mobile325–327)

**Problem:** Each "Finish Workout" press was creating a separate History row, resulting in 3 separate Monday entries after a day with multiple sessions.

**Fix — localStorage path (mobile325)**
- `finishActiveWorkout()` now checks for an existing finished session on the same calendar day
- If found, entries are merged into the existing session (deduplication by `movementId`, keeping entry with more done sets)
- Duplicate cloud row for the active session gets deleted
- Migration `mergeSameDayWorkoutsV1` in `loadData()` handles historical split sessions

**Fix — Supabase path (mobile327)**
- Root cause of persistence issue: `loadData()` migration ran on localStorage, then Supabase pull immediately overwrote `data.workouts` with all 3 original sessions
- Fix: same-day merge block added directly in the realtime reload function after `data.workouts = wkRes.data...`
- After merge: `_supa.from('workouts').upsert(mergedSession)` + `_supa.from('workouts').delete().in('id', idsToDelete)`
- Deleted IDs tombstoned locally to prevent resurrection

### Fatigue formula calibration (mobile326, 329)

**Problem:** A moderate quad-focused leg day was showing "+28% — consider deload soon" after a single session. A 42% week-over-week fatigue increase felt too aggressive.

**Root cause:** The weekly fatigue formula was `volumeFatigue = sets × coefficient`. With 4 quad-targeting movements (Squat, Split Squat, Leg Extension, Box Stepups) all accumulating to the same muscle group at `coefficient = 6.5`, quads hit 100% fatigue easily.

**Changes:**
| Version | Coefficient | Deload threshold |
|---|---|---|
| mobile325 | 6.5 | < 25% |
| mobile326 | 4.0 | < 35% |
| mobile329 | 3.0 | < 45% |

Formula context: `volumeFatigue = sets × 3.0` (caps at 100, ~33 sets to max). Aggregated as `0.6 × max + 0.4 × avg` across muscles. Decay curve: day 0 = 1.0, day 1 = 0.65, day 2 = 0.35, day 3 = 0.15, day 4+ = 0.

### Total movement count (mobile328, 331)

**Problem:** Today was showing `4/6` instead of `4/5` — ad-hoc movements (added during a session, not in the plan) were being double-counted or missed.

**First attempt (mobile328):** Additive approach — `planRaw.length + activeAdhocCount + finishedAdhocMids.size`. Led to double-counting when a movement appeared in both plan and finished session.

**Final fix (mobile331):** Set union approach — all distinct `movementId` values from plan + active session + finished-today sessions deduplicated automatically in a `Set`. No edge cases, no double-counting.

```js
const allTodayMvIds = new Set();
(planRaw || []).forEach(p => { if (p.mid) allTodayMvIds.add(p.mid); });
allToday.forEach(w => {
  (w.entries || []).forEach(e => {
    if (e && e.movementId && (e.skipped || (e.sets || []).some(s => s.done)))
      allTodayMvIds.add(e.movementId);
  });
});
if (data.active) {
  (data.active.entries || []).forEach(e => {
    if (e && e.movementId && (e.sets || []).length > 0)
      allTodayMvIds.add(e.movementId);
  });
}
const totalCount = allTodayMvIds.size || doneCount;
```

### Plan tab "+ Add" button (mobile330)

**Problem:** The `#plan-add-btn` click handler existed in JS but the button element had been removed from HTML.

**Fix:** Added `<button class="btn btn-dark" id="plan-add-btn">+ Add</button>` back to the plan view header.

### New standalone prototype — mobile332

**Goal:** Build a clean interactive prototype from the UX rationale document, separate from the complex main codebase, with the refined glass aesthetic.

**Design system:**
- Phone frame: 390px wide, border-radius 40px, centered on page
- `--bg: #eef1f8` pale blue-gray background
- `--glass-bg: rgba(255,255,255,0.35)` frosted glass surfaces
- `--accent: #1b3a6b` dark navy primary actions
- `--accent-2: #2563eb` blue highlight
- Inter Tight font, Geist Mono for labels and data
- Tabler Icons webfont

**Features implemented:**
- Today view with B3 glass section containers grouped by body part
- Stats strip (sets done, sets left, duration)
- Movement rows with progress chip (pending / in-progress / done / skipped)
- Workout Mode — focused per-movement screen, no vertical scroll
- Prior reference card (last session sets)
- AI recommendation card with action + suggested next set + reason + Apply button
- Per-set logging: done rows collapse to compact summary, current set shows full inputs, future sets show compact target rows
- Tap Done chip to reopen a completed set
- Number picker bottom sheet: field-specific steps + presets for weight/reps/RPE
- Add Movement bottom sheet: name, body part, sets/weight/reps/RPE, prior reference, Use Last Time / Start Blank
- Skip and Remove movement actions
- Live `recommend()` function: RPE-weighted AI suggestion engine

**UX rules encoded:**
- Only current set shows full controls — prevents workout mode from becoming a long form
- Completed sets collapse to `Set 1 · 185 × 10 · RPE 7 · Done`
- Future sets show `Set 3 · 185 × 10 · Target` or blank placeholder
- Recommendation labels always include units: `Add 5 lb`, `Drop 10 lb`, `Hold`
- Apply target writes recommended weight/reps/RPE into the next set
- Skip vs Remove are distinct: skip keeps the movement visible as skipped, remove deletes it from today

---

## Design Language Reference

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#eef1f8` | Page background |
| `--glass-bg` | `rgba(255,255,255,0.35)` | Section containers, cards |
| `--accent` | `#1b3a6b` | Primary buttons, dark navy |
| `--accent-2` | `#2563eb` | Blue highlights, active states |
| `--ok` | `#16a34a` | Done / success states |
| `--warn` | `#b45309` | Skip / warm warning |
| `--bad` | `#dc2626` | Remove / error states |
| `--mono` | Geist Mono | Labels, data values, prior refs |
| `--font` | Inter Tight | All UI text |

**Card shadow levels:**
- `--depth-1`: subtle, resting card
- `--depth-2`: elevated, active/current set
- `--glass-shadow`: inner highlight + soft drop, section container

**B3 section container pattern:**
- `background: var(--glass-bg)` + `backdrop-filter: blur(10px) saturate(140%)`
- `border: 1px solid var(--glass-border)`
- `border-radius: 16px`, `padding: 8px`
- Section header: eyebrow label in `--accent-2`, plain text toggle at right

---

## File Version Log

| File | Key change |
|---|---|
| mobile15.html | Data governance rebuild |
| mobile289.html | Date shift fix (parseLocalDate) |
| mobile290.html | Sparkline padding + debug badge |
| mobile325.html | Same-day session merge (localStorage) |
| mobile326.html | Fatigue coefficient 6.5 → 4.0, threshold 25 → 35 |
| mobile327.html | Same-day merge in Supabase realtime reload path |
| mobile328.html | Ad-hoc movement count (first attempt) |
| mobile329.html | Fatigue coefficient 4.0 → 3.0, threshold 35 → 45 |
| mobile330.html | Plan tab "+ Add" button restored |
| mobile331.html | totalCount Set union fix |
| mobile332.html | New standalone interactive prototype |
