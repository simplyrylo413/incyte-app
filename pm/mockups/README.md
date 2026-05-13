# INCYTE — Mockups (2026-05-12)

Static HTML mockups of the three load-bearing screens in the new Training-OS UX direction. Each file opens standalone in a browser — no build, no JS, no external dependencies.

## Files

| # | File | Screen | Purpose |
|---|---|---|---|
| ★ | [`prototype.html`](prototype.html) | **Interactive flow** | Full clickable prototype — all three screens with working state, transitions, AI rec logic, number picker, Add Movement flow |
| 01 | [`01-today-overview.html`](01-today-overview.html) | Today — workout overview (static) | Design-spec snapshot of the populated Today view |
| 02 | [`02-workout-mode.html`](02-workout-mode.html) | Workout Mode (static) | Design-spec snapshot of the focused single-movement view |
| 03 | [`03-add-movement-sheet.html`](03-add-movement-sheet.html) | Add Movement sheet (static) | Design-spec snapshot of the bottom sheet |

**Start with `prototype.html`.** The three numbered files are static design specs (one screen each, no JS) — useful for reviewing one surface in isolation, but the prototype shows the actual flow.

## What the prototype demonstrates

Click-through-able flows you can exercise:

1. **Today → tap movement → Workout Mode** opens with that movement's sets ready.
2. **Per-movement preference toggles** at the top of Workout Mode:
   - **Track RPE** — when off, the RPE picker pill disappears and Log Set works without it
   - **AI guidance** — when off, the recommendation card disappears entirely
   - Try Barbell Row in the seed data — it starts with both toggles OFF to show the minimal-logging UX
3. **Tap weight / reps / RPE picker pill** → number picker bottom sheet rises with `-10/-5/-1/+1/+5/+10` steppers (weight) and field-specific presets (reps: 5/6/7/8/10/12/15/20 — RPE: 4/5/6/7/7.5/8/8.5/9/9.5).
4. **Adjust RPE** → AI recommendation card live-updates: low RPE → "Add 5/10 lb"; mid RPE → "Hold"; high RPE → "Drop 5/10 lb"; very-high reps + very-low RPE → "Add 10 lb" with capped rep target. Reason copy explains the mechanism in clinical voice.
5. **Tap "Apply target"** → the AI rec's weight/reps populate the next future set's target.
6. **Tap "Log set N"** → current set marks Done (compact row), next target promotes to current.
7. **Tap a "Done" chip on a logged set** → set reopens for editing (no separate edit mode).
8. **Skip movement** → returns to Today with movement marked `SKIP` in the progress chip.
9. **Complete movement** (enabled only when all sets logged) → returns to Today with `DONE` chip.
10. **Add movement → bottom sheet** → simplified setup: just Body Part / Movement / Sets count. Toggle Use Last Time / Start Blank — Use Last Time pre-populates sets from prior reference; Start Blank creates `—` blank sets the user fills in during workout. No starting weight / target reps / target RPE entry in setup.
11. **Remove movement** (x button on each card) → confirms then drops it.
12. **Top progress strip** updates as sets get logged — gradient fill, sets-remaining count.

## Viewport

All three target **393 × 852** (iPhone 15 Pro logical resolution). Open in a desktop browser to see the device frame; resize the window down to a 393-wide mobile to see them at intended dimensions.

## Design decisions captured in the mockups

### Token application (per `feedback_visual_direction.md`)
- All colors trace to the defined INCYTE tokens (`--accent` `#5d9bb8`, `--accent-2` `#7fa5c7`, `--ok` `#4f9aa8`, `--warn` `#8e9bb0`, `--bad` `#b08092`, etc.)
- The progress gradient is the locked one: `linear-gradient(90deg, #5d9bb8 0%, #9b82c8 55%, #c9a0be 100%)` — used on the stat-strip fill and the AI recommendation card background
- Type scale matches the handoff: 10/11/12/13/14/15/18/22/28px
- Elevation tiers map to `--depth-1/2/3`
- Mono used for data (Geist Mono): set values, eyebrow labels, RPE/weight/reps display
- Sans (Inter Tight) for headlines and action labels

### UX rationale application (per the pasted doc)
- **Movements grouped by body part** with mono eyebrow section headers (`CHEST`, `BACK`)
- **Set progress chips** (`1/4`, `0/3`, `SKIP`) — at-a-glance status without expansion
- **One-handed, no-scroll Workout Mode** — current set is the only expanded card; logged sets collapse to single rows; future sets show as compact targets
- **AI recommendation card** owns the full guidance — action label with units (`Add 5 lb`), suggested next set (`→ 190 × 10`), reason copy, single `Apply target` action
- **No "Next set" duplicate pill** — recommendation card is the single source
- **Use Last Time / Start Blank** segmented control as the setup-mode toggle on the Add Movement sheet
- **Prior reference reveals contextually** — only shown when Use Last Time is active

### Voice / copy (per `feedback_positioning_and_voice.md`)
- Empty-state headline: `"Build today's session."` — fact + implied action, no motivational filler
- Empty state for skipped: `"Skipped today · last: 30×15 @8"` — factual, no apology copy
- AI reasoning: `"Effort stayed controlled. Add a small amount of weight."` — clinical, mechanism-explained, no exclamation
- No emojis as icons; SVG only
- No twee subcopy, no ornamental flourishes, no exclamation points
- Mono-cap eyebrows used only for labels/metadata (`SET 1`, `TARGET`, `LIVE`) — never as decorative filler

### Anti-patterns avoided (per handoff explicit don'ts)
- No left-border accents on movement cards
- No top stripe on the today card
- No underline bar on Week tab part cards (`vol-bar height: 0`)
- No emojis as structural icons
- No fabricated PR claims — all numbers shown are realistic per the rationale doc's examples

## Open contradictions to resolve

### Light mode vs. dark-default
The UX rationale doc (recent) calls for **"Light frosted glass foundation, pale blue-gray surfaces, dark navy primary actions."** The INCYTE handoff (mobile294, May 11) said **"dark theme by default with light theme toggle."** These contradict.

Mockups are rendered in the light-mode direction per the newer rationale doc. If dark-by-default is still correct, all three mockups need a dark variant.

Logged as an open question in `~/fitness-app/pm/decisions.md`.

### Tab structure
Mockups use bottom nav: **Today / Plan / Momentum / Library**. The INCYTE handoff names tabs **Week / Momentum / Library / Insights**. The new UX rationale uses "Today" as the active surface name but doesn't enumerate all tabs.

Picked the rationale doc's "Today" naming since it's more recent and matches the user-facing language. The full tab structure needs alignment.

## Limitations

- Mockups are static — no interactions, no state changes
- Number pickers shown as inline steppers; the rationale also describes a bottom-sheet picker variant with quick-step controls (-10/-5/-1/+1/+5/+10) and field-specific presets. Not mocked here; would be a fourth file.
- The "tapping a logged Done chip to reopen the set" interaction isn't shown
- The "Apply target" hover/press state isn't shown
- Empty state for Today (zero movements planned) isn't shown as its own file — the rationale describes it; can add as `00-today-empty.html` if useful

## Next steps if these are directionally right

1. **Reconcile light vs. dark direction** in `decisions.md`
2. **Reconcile tab naming** (Today/Week, Plan, Momentum, Library, Insights — pick the canonical four)
3. **Build a dark variant** of each mockup if dark-by-default holds
4. **Add the number-picker bottom sheet** as mockup 04
5. **Add the empty Today state** as mockup 00
6. **Convert the directionally-correct mockups into actual changes** to `fitlog-mobile.html` — small, commit-per-change, retire the snapshot workflow
