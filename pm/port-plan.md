# Port plan — Today + Workout Mode prototype → production

Last updated 2026-05-13. Scope: bring the prototype's Today + Workout Mode UI/UX into the live `fitlog-mobile.html` build without disturbing Insights, Week, Library, Plan, Progress, Generate, or History.

## Decisions log

| Date | Decision | Notes |
|---|---|---|
| 2026-05-13 | **Cardio + Mobility movements**: v1 supports them for logging only. They are excluded from the session-stats hero's Volume and Avg RPE math. Complete % still counts their sets. | Implementation: dispatcher in `renderWorkout` routes cardio/mobility to existing `cardioTable`/`mobilityTable` inline tables inside the new view shell; only strength movements get the big-type hero + columnar set rows. |
| 2026-05-13 | **Volume breakdown granularity**: Roll up to body part for most groups (CHEST, BACK, SHOULDERS, ARMS, etc.), but **split LEGS into Glutes / Hamstrings / Quads / Calves**. | The session-stats hero's volume breakdown reads `mv.muscle` (prod's granular field). A small mapper collapses muscles to display group: legs muscles stay distinct (glute / hamstring / quad / calf), everything else rolls up to its parent body part. Today's section eyebrows (`CHEST`, `BACK`, etc.) continue to use `bodyPart` — only the volume stat breaks legs out. |
| 2026-05-13 | **AI Apply survives in production**: When all planned sets in a movement are done, the AI insight rec stays visible and its Apply button creates a new set seeded with the rec's weight/reps. | Port `applyRecommendation`'s no-target branch verbatim. The new set defaults to `setType='working'`, `bodyweight=false`, and pushes to the entry's `sets` array using production's set shape (`{weight, reps, rpe:null, done:false, warmup:false, bw:false}`). The hero re-renders with the new set as current. |

## Goals & non-goals

**Goals**
- Replace the current Today screen layout (`#view-today`, lines 6477–6551) with the prototype's: small head, 3-stat session hero with collapse-to-strip, body-part grouped `.mv` cards with drag handle + equipment popover + progress chip + remove.
- Introduce a real, dedicated Workout Mode view (a new `#view-workout`) modeled on the prototype: big-type hero (`weight × reps × rpe`) with inline pickers, columnar set rows (Option B: SET / BW / PREV / TODAY / ✓ / ×), inline AI insight pill, rest pill (tap-toggle + long-press duration picker), Add Set.
- Port new features production lacks: drag-reorder within a body-part group, equipment chip popover on Today cards, BW toggle per row, rest timer, columnar Option B set rendering, AI "Apply" that creates a new set when all sets are done.
- Keep the production data shape (`data.active.entries[i].sets[j]` with `{weight, reps, rpe, done, warmup, bw}`) as the source of truth. Adapt the prototype's render functions to read/write this shape.

**Non-goals**
- Do not touch Insights, Week, Library, Plan, Progress, Generate, History view blocks.
- Do not change Supabase sync, the migration code in `7763–7900`, or the `data.movements` / `data.workouts` schema.
- Do not introduce a separate `state.session` runtime object. Reuse `data.active` + add a tiny `ui.session` object for ephemeral things (rest timer, animation flags).
- Do not port the prototype's `parsePriorRef` literal text format — production already has per-set `prevW`/`prevR` on each set object, which is richer.

## Source-of-truth references

- **Prototype**: `~/fitness-app/pm/mockups/prototype.html` (3,287 lines). Last touched in commits a56171f, 3b9e6f7, 7b72fb7, a40e75e, 24bb32a. Single-file, self-contained, no Supabase.
- **Production**: `~/fitness-app/src/fitlog-mobile.html` (17,869 lines). Baseline: mobile294. Today view at 6477–6551; `renderToday()` at 10089; `buildMvBlock()` at 10522; orphaned `renderWorkout()` at 13656 (its containers `#w-body`/`#w-empty`/`#add-movement-btn` no longer exist in the DOM — it is dead code and a free name to repurpose).

---

## Feature delta — Today screen

| Element | Prototype | Production | Action |
|---|---|---|---|
| View header | `.head-today` with `<h1>Build today's session.</h1>` + date sub "Tuesday May 12 · Push + Pull" (no eyebrow). Lines 1675–1678. | `.view-head` with title "Today" + sub `today-vhead-sub` (e.g. "TUE · MAY 12"). Lines 6480–6485. | UPDATE — keep production's `.view-head` shell for tab rhythm, but rewrite copy/sub to mirror prototype tone ("Build today's session" / "WEEKDAY · BODY-PART"). Drop `#today-eyebrow` strings ("IN PROGRESS", "SAVED…"). |
| Session hero | `.progress` div (id `#session-hero`) — 3-stat row (Volume w/ body-part breakdown, Avg RPE, Complete% w/ mini bar). Auto-collapses to "thin ready strip" when nothing logged. Sets+min planned scope. Lines 1680–1707, render 2196–2244. | `.tup` block (`#today-hero-wrapper`). 3-stat row (volume, sets, avg rpe) + ETA chip + Done% + progress bar + Done section + Recovery + footer with add/save/finish/discard. Lines 6488–6540. | UPDATE — keep `.tup` as the structural anchor (it's used by `updateTodayStats` everywhere) but: (a) add a `.compact` modifier that hides everything except a 1-line "N sets · M min · Ready" strip when no sets are done; (b) add per-body-part volume breakdown under the volume stat (`#stat-volume-parts` analog); (c) keep but visually de-emphasize ETA/Recovery/Done — they have no equivalent in the prototype and should be optional / behind a tap. Decide: keep Done/Recovery sections (high product value) but treat them as expand-on-demand. |
| Discard × button | none | `.today-discard-x` (6499) | KEEP. Place inside hero `tup-top` as today. |
| Save & exit / Finish session buttons | none (prototype is a session demo) | `#today-save-btn`, `#today-finish-btn` (6534-6535) | KEEP. Required for real persistence. |
| Body-part section header | `.section-eyebrow` — uppercase mono caption above each group. (2086-2088). No collapse. | `.muscle-section-header` with chevron + label + count + show/hide + collapsed-summary chips (10306–10353). | KEEP production's collapsible section behavior — strictly better UX. Restyle the header text/typography to match the prototype's `.section-eyebrow` (uppercase mono caption). |
| Movement card | `.mv` — 4 columns: drag-handle · body (name + equip popover + ref line) · progress-chip (DONE/SKIP/N/M) · × remove. Tap body opens Workout Mode. Compact 1-line look. (2119–2147). | `.mv-block` — full card with head/meta/identity-chips/sets-table inline. Expand/collapse via `pinnedTodayPid`. (10522–10721). | UPDATE — this is the biggest single-element change. Replace the inline sets table inside Today cards with a compact `.mv` summary line (name + equipment pill + progress chip + drag + ×). Move all set logging into the new Workout Mode view. Keep `data.planId` / `mvBlock` data hooks so drag/reorder + pinning still work. |
| Equipment indicator | `.equip` pill button + `.equip-pop` popover with `.equip-chip` options (`barbell / dumbbell / cable / machine / bodyweight`). Tap pill → toggles popover; tap chip → updates `mv.equipment` + closes. (2114–2175). | `.mv-id-chips` chip strip (`mv-id-chip mv-id-equip`) — read-only display of `equipmentType`; equipment is edited via `todayIdentityControlsHtml` collapsible select. (10588–10610). | ADD — port the prototype's tap-to-edit popover. Wire it to `entry.equipmentType` (or `planItem.equipmentType` when no entry yet) and trigger the existing identity-sync code (search `setProgressIdentityControls`, 9088) so dropdowns elsewhere stay coherent. Keep the full Movement Details collapsible as an "advanced" path. |
| Progress chip | `.progress-chip` with classes ` ` / `partial` / `done` / `skipped`. Text = `N/M` or `DONE` / `SKIP`. (2096-2101, 2144). | Done state derived inline as `entry.sets.every(s => s.done)` to add `.done` class to `.mv-block` (10577). No compact chip. | ADD chip — derive `(done, total)` from `entry.sets`, with `entry.skipped` → SKIP. |
| Drag-reorder | `.drag-handle` SVG dots + `wireDragReorder` (3006). Restricted to same body-part group. (2121, 3043). | `wireTodayMoveDrag(list)` (9945) — production already has drag. | KEEP production's drag wiring; verify it respects the new section grouping. Add the prototype's visual `.drag-handle` icon so the affordance is explicit. |
| Add movement | `.add-mv-btn` inline button after the last card (2184–2192). Empty state has its own `.empty-cta`. | `.today-add-btn` (`+ Add movement`) in `.tup-footer` (6532) + empty-state `#today-empty-add` (6548). | KEEP production wiring (it triggers `openPickMovement`/`openStartModal`). Style to match prototype `.add-mv-btn` (dashed/ghost rectangle with `+`). |
| Empty state | `.empty` card with eyebrow + h3 + p + CTA (2071–2079). | `.empty` card with title + sub + button (6544–6550). | UPDATE copy/typography to mirror prototype. |
| Done section | none | `#tup-done` with completed count ratio (10189–10201). | KEEP — production-only feature, valuable post-session. |
| Recovery section | none | `#tup-recovery` (10204–) | KEEP — production-only. |
| Live clock | `#clock` text (3274–3281). | none | SKIP — not relevant in production status bar. |

## Feature delta — Workout Mode

| Element | Prototype | Production | Action |
|---|---|---|---|
| Entry point | Tap `.mv` body or progress-chip → `openWorkoutMode(mvId)` (2627). | Currently inline expansion of `.mv-block` (`pinnedTodayPid`). No separate view. | ADD a new `<div class="view" id="view-workout">` after `#view-today` and an `openWorkoutMode(planId)` analog (which sets a global `ui.activePlanId`, hides #view-today, shows #view-workout). Reuse `go('today')` for navigation gating in `nav.js`. |
| Topbar | `.topbar` with `.back-chip` only (1728–1732). | (n/a) | ADD. Back chip calls a new `backToToday()` that calls `go('today')` + clears `ui.activePlanId`. |
| Identity block | `.identity` — small uppercase eyebrow "CHEST · BARBELL" + big `.name`. (1735–1738; 2256–2258). | (n/a) | ADD. Source from `mv.muscle` / `entry.equipmentType` / `mv.name`. |
| Prior history pill | `.prior` — single-line "History · DATE · summarized range". (1742–1745; 2262–2263). `formatPriorAsRange()` parses `priorRef` string. | Production has `lastSessionFor()` + lifetime-best string (10525-10570). Per-set `prevW`/`prevR` on each set. | ADD pill. Source range from `lastEntry.sets[].prevW/prevR` (min-max). Replace prototype's `parsePriorRef` text parser with a function that reads `entry.sets[].prevW/prevR/prevRpe` directly. |
| Hero card | `.hero` — eyebrow row (`SET n of m` + RPE/AI/Rest pills) · big-type hero (`weight × reps × rpe` as buttons that open the picker) · `Log set N` CTA. (1747–1748; 2311–2339). | (n/a — current "hero" CSS is `.hero-card` used only by Insights cards.) | ADD. CSS classes `.hero`, `.hero-eyebrow`, `.hero-primary`, `.hero-num`, `.hero-sep`, `.hero-units-bar`, `.hero-actions`, `.hero-cta`. **CAUTION — name collision:** `.hero` and `.hero-card` already exist in production at line 4776 (Insights cards). Prefix all workout-hero classes with `.wm-` (e.g. `.wm-hero`, `.wm-hero-num`) to avoid bleeding into Insights. The prototype's `#wm-hero` parent stays as the id. |
| Set-of marker | `.now-marker` with `.dot` pulse + `SET n of m`. (2314). | (n/a) | ADD. |
| RPE toggle | `.foot-btn.toggle` with `.toggle-track` + `.toggle-thumb`. (2316–2319). Toggles `state.session.trackRpe`. | RPE input column always shown in `weightTable` (10706); no session-wide toggle. | ADD toggle. Map to a new `ui.session.trackRpe`. When off, hide RPE column in the columnar set rows + clear unsaved `rpe` on non-done sets. |
| AI toggle | `.foot-btn.toggle` for `.aiRecOn`. (2320–2323). | Coach note always renders under done sets (`nextSetCoachNote`, 8736; rendered 10710–10718). | ADD toggle gating `nextSetCoachNote` rendering inside Workout Mode. The Today screen does not need this toggle. |
| Rest pill | `.pill-rest-wrap` + `.pill-rest` (clock SVG + label + time) + `.dur-picker` with chips (1:00 / 1:30 / 2:00 / 3:00 / 5:00). Option B: tap toggles, long-press (450ms) opens picker. `wireRestPill()` (2748). | (n/a) | ADD. Port `formatTime`, `startRestTimer`, `stopRestTimer`, `toggleRestTimer`, `setRestDuration`, `wireRestPill`, `REST_LONG_PRESS_MS`. Store state under `ui.session.restTimer`. Stop timer on `backToToday()`. |
| Columnar set rows (logged) | `.set-row.done` with 6 cells: `r-set-btn` (warmup/working toggle, shows "01") · `bw-btn` (BW toggle) · `r-prev` · `r-vals` · `chk` · `row-remove`. AI insight pill `rec-inline` renders inline after the last done row. (2468–2540). | `.sets-table-2` row with columns SET / TYPE (WU/WS) / WEIGHT input / REPS input / PREV / RPE / DONE button / DELETE. Coach note as `tr.set-coach-row` (10688–10718). | UPDATE inside Workout Mode only — render the columnar pill layout instead of `<table>`. Keep DELETE + warmup-toggle + BW-toggle functionality; they map 1:1 to production's `set-warmup-toggle`, `bw-toggle`, `set-del-btn`. |
| Columnar set rows (target/upcoming) | `.set-row.target` — same 6 cells but `r-vals` is two `.edit-num` buttons (open picker on tap). Blank values shown as `—`. (2553–2581). | Same as logged in production — every set is editable in the table. | ADD target rows. Plan-shaped sets (`defaultSetsFor(p)`) become target rows; once `s.done`, they become done rows. |
| Set type toggle | `.r-set-btn.warmup` — tap toggles between "WARM" and "WORK". (2480, 2820). | `.set-warmup-toggle` button (10692). Stores `s.warmup` boolean. | UPDATE — wire `r-set-btn` to flip `s.warmup`. Same boolean, different visual. |
| BW toggle | `.bw-btn` (2481). Toggles `s.bodyweight`. (2833). | `.bw-toggle` (10697). Toggles `s.bw`. | UPDATE — use production's `s.bw` field name. The prototype's `bodyweight` field should be renamed to `bw` in the port to avoid a field migration. |
| Column header | `.col-head` — `Set · · Previous · Today · ·` 6-col grid. (2460–2467). | `<thead>` row in `.sets-table-2`. | ADD `.col-head` div. |
| AI insight pill | `.rec-inline` — `.live-dot` · body (action / arrow / next / reason) · `.apply` button. Inline after last done set. (2491–2510). Live preview variant before any set is logged. (2423–2443). Apply creates a new set when all done. (2935). | `.set-coach-row` inside `.sets-table-2` — text-only "💡 Next set · {note}". No Apply button. (10710–10718). | ADD `.rec-inline` design. Reuse `nextSetCoachNote()` output as the `next` text, but wrap action/reason structure. Apply behavior: replicate prototype's `applyRecommendation()` — if target set exists, update it; else push a new set onto `entry.sets`. |
| Add set | `.add-set-btn` (2606). `addSet()` smart-defaults from last logged / last target (2843). | `.set-btn-add` (10729 in weightTable, 10625 mobility, 10679 cardio). Pushes `{weight: ref.weight, reps: ref.reps, done: false}`. | UPDATE — keep production's wiring; restyle button to prototype `.add-set-btn`. |
| Number picker | `.overlay#picker-overlay` with `.sheet`, `.pk-display`, `.pk-steppers` (delta buttons), `.pk-presets` (4-col grid). `PICKER_CONFIG` for weight/reps/rpe. (1768–1782; 3062–3162). | None — uses native `<input type="number">`. | ADD. New first-class picker overlay. Replace the inline number inputs in Workout Mode with picker-triggering buttons (mobile-first ergonomics). Keep `<input type=number>` on the inline Today summary so dragging a card never needs to open a picker. |
| Movement complete state | Hero swaps to "MOVEMENT COMPLETE" + Complete button. (2378–2400). | Just collapses card. | ADD complete state inside Workout Mode hero. `completeMovement()` validates all sets done, marks the entry, returns to Today. |
| Skip movement | `skipMovement()` (2969). | `entry.skipped` field already exists (10576 check). | ADD a Skip control to Workout Mode (footer or topbar overflow). |

## State shape delta

The prototype carries an in-memory `state` object. Production carries persistent `data` + ad-hoc UI globals. Reconcile by:

- **Keep `data.active` as source of truth**. Its `entries[i].sets[j]` already supports `weight, reps, rpe, done, warmup, bw, distance, time, prevW, prevR, prevRpe, baseline`. **No schema changes needed.**
- **Add a lightweight `ui.session` object** (new) for ephemeral state:
  ```js
  window.ui = window.ui || {};
  ui.session = {
    activePlanId: null,           // which mv is open in Workout Mode (was state.activeMovementId)
    view: 'today',                // 'today' | 'workout'
    trackRpe: true,               // session-wide RPE display toggle
    aiRecOn: true,                // session-wide AI insight toggle
    restTimer: {
      enabled: false, duration: 120, remaining: 0,
      intervalId: null, presets: [60, 90, 120, 180, 300],
    },
    _animSetIdx: null,            // one-shot animation key
    _animRec: false,              // one-shot animation key for AI pill enter
  };
  ```
- **Field mapping (prototype → production)**:
  - `mv.bodyPart` → `mv.muscle` (and fall back to `mv.category`)
  - `mv.equipment` → `entry.equipmentType` (with `planItem.equipmentType` / `mv.equipmentType` / `last.equipment` fallback — production already does this)
  - `mv.priorRef` (string) → derived per-set from `entry.sets[].prevW/prevR/prevRpe`
  - `mv.priorDate` → `lastSessionFor(mid).date` formatted via `fmtShort()`
  - `set.idx` (1-based) → array index `si + 1`
  - `set.status` (`current`/`target`/`done`) → derived: `done = s.done; current = first !s.done; target = rest`
  - `set.setType` (`warmup`/`working`) → `s.warmup` boolean (true = warmup)
  - `set.bodyweight` → `s.bw`
- **No persistence of `ui.session`.** Treat it as transient. Stop the rest timer on tab switch / Workout Mode exit.

## CSS class delta

Production already defines these classes — **prototype CSS will collide if pasted as-is**. Namespace prototype workout-mode classes with `.wm-` prefix:

| Prototype class | Conflicts with | Rename to |
|---|---|---|
| `.hero` (workout mode big-type card) | `.hero-card` family in Insights (line 4776+) — different intent but visually similar selector descendants like `.hero-actions` may collide | `.wm-hero` (+ `.wm-hero-eyebrow`, `.wm-hero-primary`, `.wm-hero-num`, `.wm-hero-sep`, `.wm-hero-units-bar`, `.wm-hero-actions`, `.wm-hero-cta`) |
| `.progress` (session hero) | None directly; production uses `.tup` | Keep prototype name OR fold into `.tup.compact` |
| `.mv` (Today movement card) | Production uses `.mv-block` (no `.mv` standalone). Safe but easily confused. | Keep `.mv`. |
| `.set-row` | None | Keep. |
| `.stat`, `.stat-label`, `.stat-value`, `.stat-unit` | Already exist in production for Week stats | Rename prototype to `.tup-stat` analogs (production already has `.tup-stat`/`.tup-val`/`.tup-lbl`/`.tup-unit` — reuse those instead of importing prototype ones). |
| `.empty` | Exists in both with different shape | Keep production's outer class; restyle its children. |
| `.toast` | (verify) | Keep — new component. |
| `.overlay`, `.sheet`, `.handle` | (verify against modal-* classes in production) | Prefix with `.pk-` for the picker overlay. |
| `.col-head`, `.sets`, `.rec-inline`, `.live-dot`, `.coach-tag`, `.r-set-btn`, `.r-prev`, `.r-vals`, `.bw-btn`, `.edit-num`, `.row-remove`, `.chk`, `.pill-rest`, `.dur-picker`, `.dur-chip`, `.foot-btn`, `.toggle-track`, `.toggle-thumb`, `.add-set-btn`, `.add-mv-btn`, `.equip`, `.equip-pop`, `.equip-chip`, `.equip-wrap`, `.drag-handle`, `.section-eyebrow`, `.progress-chip`, `.head-today`, `.identity`, `.prior`, `.topbar`, `.back-chip`, `.now-marker`, `.dot`, `.set-of`, `.active-set`, `.premium-enter`, `.premium-exit` | No production conflicts found | Import as-is. |

**Tokens.** Prototype uses CSS vars `--ok`, `--muted` etc. Verify these resolve to production's design tokens (INCYTE steel-blue/lavender/soft-pink). Production declares its own token system; any mismatched vars must be mapped before paste.

## JS function delta — port list

Order them so dependencies come first.

| Prototype fn | Lines | Production equivalent | Action |
|---|---|---|---|
| `formatTime` | 2683 | none | ADD |
| `getActiveMovement` | 1927 | `getMv(mid)` | ADAPT — read `ui.session.activePlanId`, look up entry via `activeEntryFor(mid, planId)` |
| `getCurrentSet` | 1931 | none | ADD — return first `!s.done` set from `entry.sets` |
| `formatPriorAsRange` | 1937 | none | ADD — adapt to take `entry.sets[].prevW/prevR` instead of parsing a string |
| `parsePriorRef` | 3177 | n/a | DROP — replaced by direct field reads |
| `computeRecommendation` | 1953 | partially `nextSetCoachNote` + `getNextWorkoutAdjustment` (8508) | UPDATE — keep prototype's RPE-aware heuristic, but route its `reason` through production's coach-note style. |
| `renderToday` | 2053 | `renderToday` (10089) | REWRITE — see Phase 3 |
| `renderWorkout` | 2250 | dead code at 13656 | REWRITE — repurpose the function name; rebuild against new `#view-workout`. |
| `openWorkoutMode` / `backToToday` | 2627 / 2635 | none | ADD. Hook into the existing `go(view)` router. |
| `logSet` | 2643 | inline checkbox toggle in `renderWorkout`/`buildMvBlock` | ADD — accepts `setIdx`, validates weight+reps, marks `s.done=true`, advances current pointer, triggers rest timer if enabled, calls `saveData()`. |
| `addSet` / `removeSet` / `reopenSet` | 2843 / 2883 / 2923 | `[data-addset]` / `[data-delset]` handlers in `buildMvBlock` (10625/10674) | UPDATE — port the prototype's smart defaults + reopen-to-edit behavior; keep production's saveData call. |
| `applyRecommendation` | 2935 | none | ADD — note the "create-new-set when all done" branch. |
| `completeMovement` / `skipMovement` / `removeMovement` | 2983 / 2969 / 2994 | `entry.skipped` exists; remove via Movement Details | ADD wrappers that set the flags then `backToToday()`. |
| `wireDragReorder` / `reorderMovement` | 3006 / 3043 | `wireTodayMoveDrag(list)` (9945) | KEEP production's. Audit if it restricts reorder to same body-part group; if not, decide whether to add that constraint (prototype enforces it). |
| `wireRestPill` / `startRestTimer` / `stopRestTimer` / `toggleRestTimer` / `setRestDuration` | 2748 / 2690 / 2712 / 2723 / 2731 | none | ADD. Store interval on `ui.session.restTimer.intervalId`. Stop on `backToToday` / `go(view!='workout')`. |
| `toggleSetType` / `toggleBodyweight` | 2820 / 2833 | inline handlers for `[data-warmup]` / `[data-bw]` (10692/10697) | KEEP production wiring; just rename event targets. |
| `openPicker` / `renderPicker` / `closePicker` / `generateWeightPresets` / `PICKER_CONFIG` | 3077 / 3094 / 3150 / 3071 / 3062 | none | ADD as a new module. Picker writes back to `entry.sets[i][field]` + `saveData()`. |
| `tickClock` | 3274 | none | DROP — no equivalent UI in production. |

---

## Phase-by-phase execution plan

### Phase 1 — CSS transplant (mechanical)

1. Copy the prototype `<style>` block (lines 7–1656) into a NEW `<style id="prototype-port">` element placed AFTER `<style id="mobile-overrides">` (so it can override).
2. Search-replace inside the copied block: prefix every workout-mode-specific selector listed in the CSS class delta table with `.wm-` (run a sed pass before paste).
3. Drop the prototype's body/`:root` token redefinitions — production already owns the token system. Cherry-pick only vars the prototype defines but production lacks (verify against production lines 14–200).
4. Verify in browser: open each tab (Insights, Week, Library, Plan, Progress, Generate, History) and confirm nothing visually regresses. If anything does, the colliding selector is your next rename target.

**Files touched**: `src/fitlog-mobile.html` only.

### Phase 2 — HTML skeleton

1. Replace `#view-today` inner content (6477–6551) with the prototype's `#view-today` skeleton (1674–1722), but:
   - Keep production's `.view-head` shell (6480–6485).
   - Keep `#today-discard-btn`, `#today-save-btn`, `#today-finish-btn`, `#today-empty-add` ids — wire as today.
   - Keep `#tup-done` + `#tup-recovery` slots (re-style them; do not delete).
2. Add a new `<div class="view" id="view-workout">` immediately after `#view-today`. Paste prototype lines 1725–1762 verbatim, with `wm-` class renames applied.
3. Add the picker overlay (1768–1782, prefixed `.pk-`) once at the bottom of the app shell.
4. Do not touch any of `#view-insights`, `#view-week`, `#view-library`, `#view-plan`, `#view-progress`, `#view-generate`, `#view-history`.

### Phase 3 — JS render functions

Order:
1. Add `ui.session` initializer near the top of the `<script>` block (~line 7280).
2. Port `formatTime`, `getCurrentSet`, `formatPriorAsRange` (adapted), `computeRecommendation` first — no DOM dependency.
3. Rewrite `renderToday()`:
   - Keep the data-resolution preamble (10089–10266) — `plan`, `adhocEntries`, `allPlanItems`, `muscleGroups`. It already does the right grouping.
   - Replace the per-item rendering: instead of calling `buildMvBlock(p, mv, entry)`, call a new `buildMvSummaryCard(p, mv, entry)` that emits the prototype's `.mv` element (drag-handle + body + progress-chip + ×). Tap → `openWorkoutMode(p.id)`. Equipment popover wired to `entry.equipmentType` via `setProgressIdentityControls`.
   - Keep `wireTodayMoveDrag(list)`, `updateTodayStats()`, `renderWeekParts()` calls.
   - Add session-hero collapse-to-strip logic at the end (analog of prototype 2196–2244): toggle `.tup.compact` based on `doneSets === 0 && totalSets > 0`.
4. Rewrite `renderWorkout()` from scratch using prototype 2250–2622 as the spec, but read from `data.active.entries[ei]` and `entry.sets[]`. Resolve `lastEntry` via `lastSessionFor(p.mid)` (already exists). `prevFor(i)` reads `set.prevW/prevR`.
5. Wire the router: production's `go('today')` switches `.view.active` — add a `go('workout')` branch that calls `renderWorkout()`. Hook the back chip + tap-on-mv-card.

### Phase 4 — Helpers and behavior wiring

1. Port picker module (`openPicker` / `renderPicker` / `closePicker` / `PICKER_CONFIG`). Write back to `entry.sets[i][field]` + call `saveData()` + `renderWorkout()`.
2. Port rest timer (`startRestTimer` / ... / `wireRestPill`). Stop on `go(view!='workout')`.
3. Port equipment popover wiring inside `buildMvSummaryCard` — chip tap updates `entry.equipmentType`, calls existing identity-sync helper, `saveData()`, re-renders Today.
4. Port `logSet`, `addSet`, `removeSet`, `reopenSet`, `applyRecommendation`, `toggleSetType` (→ flip `s.warmup`), `toggleBodyweight` (→ flip `s.bw`), `completeMovement`, `skipMovement`.
5. Replace the prototype's `confirm()` removal prompts with a styled inline confirm or keep `confirm()` for v1 (matches production's current behavior in `data-remove` handler 13786).
6. Wire AI insight pill: gate on `ui.session.aiRecOn`; render under last done set; Apply button → `applyRecommendation()`.

### Phase 5 — Data reconciliation

Default-value hydrators to handle existing user data:
- Sets missing `warmup` → default `false` (working set).
- Sets missing `bw` → default `false`.
- Entries missing `equipmentType` → already handled by `progressIdentityForEntry` fallbacks (9225) — no action needed.
- `ui.session` initialized fresh every page load; nothing to migrate.

Format adapters:
- Prototype's "priorRef" string → not stored anywhere; derive `formatPriorAsRange()` input from `[entry.sets[].prevW, entry.sets[].prevR]` array.
- Prototype's `set.idx` numbers → use `si + 1` derived; do not persist.

### Phase 6 — Test pass

For each tab, verify no regression:
- [ ] **Today**: drag-reorder works within body-part group; section collapse/expand works; equipment popover updates equipment + reflects in Movement Details; progress chip renders correct N/M, DONE, SKIP; × remove with confirm; "+Add movement" opens the existing pick-movement flow; Save & exit, Finish session, Discard buttons still work.
- [ ] **Workout Mode**: tap card → opens view; back chip returns to Today; hero shows current set big-type; tap weight/reps/rpe → picker; Log Set → `s.done=true` + advances current + starts rest timer (if enabled); columnar rows for done + target; warmup/working toggle; BW toggle; remove set with confirm on done; reopen done set; Add Set seeds from last; AI insight appears under last done; Apply updates target or creates new set; Skip + Complete return to Today.
- [ ] **Rest timer**: tap toggles; long-press opens duration picker; chip select updates duration + restarts if running; auto-stops at 0 with toast; stops on backToToday.
- [ ] **Picker**: weight presets dynamic around current; reps + rpe fixed presets; steppers respect min/max; tap backdrop dismisses without save; Done saves.
- [ ] **Other tabs**: Insights renders all 4 cards; Week renders parts + system load; Library, Plan, Progress, Generate, History all render and function as before. No console errors on tab switch.
- [ ] **Sync**: a logged set in Workout Mode persists across a page reload (Supabase + local). Equipment change persists.
- [ ] **Capacitor build**: smoke-test on iOS sim — confirm touch events for drag, long-press, picker overlay, and the rest pill long-press all fire correctly.

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Cardio + Mobility movements use different set tables in production (10611–10680). Prototype assumes strength-only. | Medium — cardio entries lose their UI if not handled. | **Resolved (2026-05-13):** Workout Mode dispatches by movement type. Strength → new big-type hero + columnar set rows. Cardio/Mobility → existing `cardioTable`/`mobilityTable` rendered inside the new view shell (back chip + breadcrumb + history pill + the legacy table). Session-stats hero filters cardio/mobility out of Volume and Avg RPE; Complete % still counts them. |
| Touch / drag conflicts between `.mv` drag-handle and tap-to-open. | Medium — accidental opens during reorder. | Keep `wireTodayMoveDrag` (battle-tested in production); attach tap-to-open only to `.body` sub-element, not the drag handle. |
| Picker overlay z-index war with existing modals (`modal-start`, `modal-pick-movement`, Movement Details collapsibles). | Low | Audit z-indexes; use `9999` for `.pk-overlay`; verify by opening from inside an already-open modal. |
| Prototype CSS contains generic selectors (`.stat`, `.empty`, `.scroll`) that production also uses. | High if pasted as-is. | Mechanical pre-paste rename; cherry-pick rather than wholesale copy. Quick QA pass across all 7 other tabs after Phase 1. |
| Rest timer keeps ticking after `go('insights')` if not torn down. | Low — battery + console noise. | Add an `onLeaveView` hook in the router that calls `stopRestTimer()` when leaving `workout`. |

## Open questions for Albert

1. **Cardio / Mobility in Workout Mode** — ~~should the new big-type hero apply to non-strength movements at all?~~ **DECIDED 2026-05-13 (Albert):** v1 supports cardio + mobility for **logging only**. They appear in Today and can be entered in Workout Mode, but **do not contribute to RPE averaging or volume calculations** in the session-stats hero. Implementation: keep production's existing `cardioTable` / `mobilityTable` inline renderers inside the new Workout Mode shell (no big-type hero for them); skip their entries when summing `totalVolume` and when collecting `rpe` values for `avgRpe`. The Today screen's session-stats hero must filter to strength-only when computing Volume and Avg RPE; Complete % still counts all sets across all movement types.
2. ~~**Per-body-part volume breakdown** — production tracks `muscle` (more granular than prototype's `bodyPart`). Show breakdown at `muscle` level or roll up to body part?~~ **DECIDED 2026-05-13 (Albert):** Roll up to body part for most groups (Chest, Back, Shoulders, Arms, Core), **but split legs into Glutes / Hamstrings / Quads / Calves.** Implementation: in the volume-breakdown reducer inside the stats hero, replace `volumeByPart[m.bodyPart]` with `volumeByPart[displayGroup(m.muscle, m.bodyPart)]` where `displayGroup` returns the muscle name for legs muscles and `bodyPart` for everything else. The mapping table:<br>• Legs muscles: `glute → 'Glutes'`, `hamstring → 'Hamstrings'`, `quad → 'Quads'`, `calf → 'Calves'`<br>• Everything else: returns `bodyPart` as-is.<br>Today's section eyebrows are unaffected — they still group by `bodyPart`.
3. **Equipment popover scope** — does changing equipment on Today rewrite the active entry only, or also propagate to the underlying plan item (`p.equipmentType`)? Today, the dropdown writes to entry; behavior should match.
4. **Rest timer auto-start** — prototype's `logSet` does not auto-start; an explicit "Rest" tap is required. Confirm same in production.
5. ~~**AI Apply when all done** — prototype creates a new set seeded with rec values. Production has no concept of "session extension". Does Albert want this auto-extend behavior?~~ **DECIDED 2026-05-13 (Albert):** AI Apply survives. When all planned sets are done, the rec stays visible and Apply creates a new set seeded with the rec's weight/reps. The new set uses production's set shape `{weight, reps, rpe:null, done:false, warmup:false, bw:false}` and pushes onto the entry's `sets` array.
6. **`confirm()` dialogs** — prototype uses native `confirm()` (`removeSet`, `removeMovement`). Production uses styled inline confirms inconsistently. Pick a pattern before Phase 4.
7. **Save & exit / Finish session footer placement** — prototype has no equivalent. Should they live in Today (where they are now) or also be reachable from Workout Mode footer?

---

## Effort estimate

Realistic total: **5–7 working sessions of 3–4 hours each** (≈18–25 hours).

- Phase 1 (CSS transplant + collision audit): 1 session, 2–3 hours.
- Phase 2 (HTML skeleton): 0.5 session, 1–2 hours.
- Phase 3 (renderToday + renderWorkout rewrites): 2 sessions, 6–8 hours — this is the highest-risk phase. Get the data-shape adapter layer right and Workout Mode falls out cleanly.
- Phase 4 (helpers + wiring, picker, rest timer): 1.5 sessions, 4–5 hours.
- Phase 5 (reconciliation): 0.5 session, 1 hour.
- Phase 6 (test pass + cardio/mobility regression fix): 1 session, 3–4 hours.

**Riskiest phase: Phase 3.** The render rewrite is where data-shape mismatches surface. Cardio/mobility carve-out is now decided (logging-only, excluded from Volume/RPE); the dispatcher in `renderWorkout` becomes ~5 extra lines. Remaining open questions (2–7) are smaller and can be answered during Phase 3 as they come up.
