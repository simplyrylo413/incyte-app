# INCYTE — Onboarding Handoff

> Single-page orientation for anyone (or any AI session) starting cold. Skim this top-to-bottom, then go to the linked source documents for depth.

_Last updated: 2026-05-13_

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
| `~/fitness-app/src/fitlog-mobile.html` | The app. ~21.6k lines, single-file vanilla JS/HTML/CSS, no build step. Canonical working file. |
| `~/fitness-app/src/fitlog-nextjs/` | Dormant Next.js scaffold (Cowork #25). Eventual port destination; not the current path. |
| `~/fitness-app/pm/` | All PM artifacts (this doc, roadmap, backlog, decisions, etc.). |
| `~/fitness-app/pm/mockups/` | Design mockups; `prototype.html` is the Today + Workout Mode reference being ported in. |
| `~/fitness-app/.git/` | Git repo on `main`. Commits replace the old `mobile{N+1}.html` snapshot workflow ([decisions.md 2026-05-12](decisions.md)). |

---

## 3. Tech stack and architecture

**Frontend:** Single-file vanilla JS/HTML/CSS. No framework, no build step. Mobile-first.

**Persistence (current reality):**
- **Supabase Realtime is cloud-primary**, localStorage is the offline cache. Per the mobile294 INCYTE_Handoff.docx.
- Data governance was rebuilt in Cowork Session 1 ([cowork-history.md](cowork-history.md)): `loadData()` is hydration-only; `saveData()` no longer auto-pushes; all persistent writes flow through targeted helpers (`supabaseSyncMovement`, `supabaseSyncPlanItem`, `supabaseDeletePlanItem`, `supabaseSyncWorkout`, `archiveWorkoutToCloud`).
- **Tombstones:** deletions add IDs to `data.tombstones.{movements,workouts}`. Future Supabase fetches filter them so stale devices can't resurrect deleted records.

**Distribution:** Capacitor wrap of `fitlog-mobile.html` → App Store ([decisions.md 2026-05-10](decisions.md)). At-launch native plugins: calendar (EKEventStore), local notifications.

**Auth:** Deferred to v1.1. v1 ships without signup/login UI ([decisions.md 2026-05-10](decisions.md)).

**Open architecture decision (P0 launch-blocker):** A-01 — Supabase-primary vs. localStorage-only-v1 mismatch. Flagged in [decisions.md 2026-05-12](decisions.md) and [backlog.md A-01](backlog.md). User has confirmed Supabase is current reality; the resolution path is likely "anonymous Supabase rows in v1, auth UI in v1.1." Owed an explicit decision-log entry before App Store prep.

---

## 4. Information architecture

**Canonical bottom-nav tabs** ([decisions.md 2026-05-12](decisions.md)):

| Tab | Surface |
|---|---|
| **Today** | Current-day session (replaces older "Week" name). Build/log/finish today's training. |
| **Plan** | Weekly grid editor as its own top-level surface. |
| **Momentum** | Progress analytics — PR hero, sparkline, history table. |
| **More** | Overflow: Library, Insights (Readiness/Fatigue/Stimulus/PRs), History, Settings, Theme toggle, Profile. |

Today and Plan are **separate top-level surfaces**, not nested.

**Theme:** Light is the default ([decisions.md 2026-05-12](decisions.md)). Dark is an opt-in toggle. The codebase still ships dark-default in `fitlog-mobile.html`; flipping is backlog item A-02 (P0 launch-blocker).

---

## 5. Core engine concepts (settled)

| Concept | Truth |
|---|---|
| **Fatigue** | `computeOverallFatiguePct` is the single source of truth. `0.6 × max + 0.4 × mean` of trained-muscle fatigue, decayed by days-since (day 0=1.0, 1=0.65, 2=0.35, 3=0.15, 4+=0). Volume coefficient is **3.0**; deload threshold **<45%** (calibrated mobile329). |
| **RPE** | Calibrated RPE feeds the fatigue math. Raw RPE is preserved for 1RM honesty. |
| **Recommendations** | Branch first on `trainedToday`, then on fatigue/readiness tiers. Today-headline rebuild lives in `renderToday`. |
| **PR display** | Uses **raw top-set weight**, not Epley e1RM. Explicit design decision to prevent counter-intuitive sparkline inversions. |
| **1RM** | `Current 1RM = MAX(weight × any completed working set)` (actual). `Estimated 1RM` = Brzycki/Epley blend with RPE sensitivity, kept as a *separate* "Projected Strength" metric. These must remain distinct in UI. |
| **Movement identity** | Every entry carries `(canonicalMovement, equipmentType, variant)`. Equipment and variant are modifier fields, never appended to the movement name. PRs are equipment-specific (Barbell Bench PR ≠ Dumbbell Bench PR). |
| **Sets** | Warm-up and working sets are tagged via `s.warmup` boolean. Only working sets feed 1RM, volume, and progression math. |
| **Same-day sessions** | Multiple "Finish Workout" presses on the same calendar day merge into a single History row (entries deduplicated by `movementId`, keeping the entry with more done sets). Both the local path and Supabase realtime reload path apply the merge (mobile325/327). |

---

## 6. Workflow rules

- **Edit `fitlog-mobile.html` directly.** Do not create new `mobile{N+1}.html` snapshots — retired 2026-05-12.
- **Commit each meaningful change to git.** Small, frequent commits over long-lived branches.
- **Tokens are locked.** Steel blue / lavender / soft-pink gradient (see [feedback_visual_direction.md](../../.claude/projects/-Users-albertrylo/memory/feedback_visual_direction.md)). Reject "new identity" / gaming / cyberpunk redesigns. The progress gradient is `linear-gradient(90deg, #5d9bb8 0%, #9b82c8 55%, #c9a0be 100%)` — no substitutions.
- **No emojis as structural icons.** SVG only.
- **No fabricated demo data** shown as if real.
- **PM artifacts in `~/fitness-app/pm/`.** Update decisions.md (append-only) whenever a meaningful direction is set.

---

## 7. Active work

**Pre-launch punch list (10 items, suggested order — see [roadmap.md](roadmap.md)):**

1. D-08 — Apple Developer Program enrollment
2. A-02 — Flip default theme dark → light
3. A-03 — Tab structure rework → Today / Plan / Momentum / More
4. A-01 — Resolve Supabase-primary vs. localStorage-only-v1 mismatch
5. B-01 — Fix "Save & Exit drops to History" bug
6. D-06 — Capacitor scaffold around `fitlog-mobile.html`
7. D-07 — Calendar native plugin (EKEventStore)
8. D-09 — Local notifications plugin
9. D-02 — Privacy policy + App Store privacy labels
10. D-05 — App Store listing copy + screenshots + preview video

Realistic timeline: ~3.5–4.5 weeks to submission + ~1–2 weeks for Apple review.

**In-flight engineering work:** The Today + Workout Mode prototype port. Full plan in [port-plan.md](port-plan.md) — CSS/HTML/JS/state deltas, 6 phases, ~18–25 hours total. As of 2026-05-13 the Today screen `.mv` cards (compact summary + equipment popover + Remaining/Completed toggle including history-completed movements) are live in production.

**Pre-submission gate:** [launch-quality.md](launch-quality.md) — 8-section checklist (tokens, a11y, polish, copy, App Store assets, eng gates).

---

## 8. Open decisions

| ID | Status |
|---|---|
| **A-01** — Supabase architecture resolution | Flagged 2026-05-12, not yet logged. User confirmed Supabase is current reality on 2026-05-13. Needs a decision-log entry choosing among: feature-flag-off / strip / keep-with-anonymous-rows. |
| **C-01** — "Design visual layout" scope | TBD. Currently treated as P2 polish until clarified. |
| **North Star metric** | Working candidate: weekly active session completion rate. Not yet confirmed. |

---

## 9. Where to read next

| Doc | When to read it |
|---|---|
| [roadmap.md](roadmap.md) | What ships when. Now/Next/Later/Won't. |
| [backlog.md](backlog.md) | Every bug/feature/distribution item with priority + effort. |
| [decisions.md](decisions.md) | Why anything is the way it is. Append-only. |
| [port-plan.md](port-plan.md) | The current largest engineering effort (prototype → production). Read if touching Today or Workout Mode. |
| [launch-quality.md](launch-quality.md) | Pre-submission checklist. Run before App Store assets. |
| [cowork-history.md](cowork-history.md) | Historical session log (mobile15 → mobile332). Background context only; frozen. |
| `feedback_visual_direction.md` (memory) | Locked token system. Read before any visual change. |
| `feedback_positioning_and_voice.md` (memory) | INCYTE voice/positioning. Read before any copy work. |

---

## 10. House style for AI sessions

- Read this doc + relevant linked docs **before** proposing changes. Don't re-litigate settled decisions; flag them if you think they need revisiting.
- The user is solo dev + PM. Help him ship — bias toward concrete, small, verified changes over open-ended exploration.
- When editing `fitlog-mobile.html`, verify visually in the running preview server before reporting done.
- Memory is loaded automatically and reflects user preferences; trust it.
- When the user describes the IA, use the canonical Today / Plan / Momentum / More — even if they say it differently in a given prompt.
