# Backlog

Every feature, bug, and polish item. Roadmap pulls from here.

**Priority:**
- **P0** — launch-blocker. Cannot ship without it.
- **P1** — should-have. Ship if there's time, otherwise post-launch.
- **P2** — nice-to-have. Post-launch.
- **P3** — speculative / future.

**Effort:** S (≤1 day), M (2–5 days), L (1–2 weeks), XL (>2 weeks).

**Type:** feature | bug | polish | infra | content | design | distribution

---

## Active

### Open bugs

| ID  | Title | Type | Priority | Effort | Launch blocker | Notes |
|-----|-------|------|----------|--------|----------------|-------|
| B-01 | Save & Exit on today's date drops session into History instead of staying on Today | bug | P0 | S | Yes | Cowork task #18; surfaces wrong on Today tab after Save & Exit |
| B-02 | Supabase upsert missing newer fields (`completed_at`, `workout_status`, `edited_at`, `autoFinishedFromStale`, `timeNA`, cardio `rpe`) | bug | P1 (v1.1) | M | No | Per 2026-05-10 decision, cloud sync deferred to v1.1. Fix when v1.1 work begins |
| B-03 | Possible same-day session loss (multi-session-per-day visibility) | bug | P1 | M | No | Leading hypothesis was cloud-sync overwrite (tied to B-02). v1 ships localStorage-only — monitor; if it still surfaces, root cause is local-only and needs separate investigation |

### Distribution / launch

| ID  | Title | Type | Priority | Effort | Launch blocker | Notes |
|-----|-------|------|----------|--------|----------------|-------|
| D-01 | ~~Decide iOS distribution path~~ — **DECIDED: Capacitor-direct → App Store** | distribution | DONE | — | — | See `decisions.md` 2026-05-10 |
| D-02 | Privacy policy + App Store privacy labels (health-data category) | distribution | P0 | S | Yes | Apple requires before submission |
| D-03 | Account-deletion flow (App Store guideline 5.1.1(v)) | distribution | P1 (v1.1) | M | No | Deferred per 2026-05-10 decision (auth not in v1). Required when v1.1 ships Supabase auth |
| D-04 | Onboarding / first-run experience | distribution | P1 | M | No | Trained lifters can handle a sparse first-run; lift to P0 only if conversion data later demands it |
| D-05 | App Store listing copy + screenshots + 30s preview video | distribution | P0 | M | Yes | Trained-lifter positioning hook: "for people who already know how to train" |
| D-06 | Capacitor scaffold — wrap `fitlog-mobile.html` in iOS Capacitor project | distribution | P0 | M | Yes | First Capacitor work; sets up the iOS project structure, build pipeline, and asset bundling |
| D-07 | Calendar native plugin (EKEventStore) — replaces C-02 with native implementation | feature | P0 | S | Yes | Doubles as "native value" proof for App Store review; binds to "Add event to calendar" |
| D-08 | Apple Developer Program enrollment + certs/provisioning + App Store Connect setup | distribution | P0 | S | Yes | $99/yr; some lead time for enrollment if not already a member. Confirm status with user |
| D-09 | Local notifications plugin (`@capacitor/local-notifications`) — training reminders, rest timers, streak nudges | feature | P0 | S | Yes | Locked per 2026-05-10 decision: local-only at launch, no remote push / APNs infra in v1. Doubles as the second native plugin binding alongside D-07 |

### Engineering hygiene

| ID  | Title | Type | Priority | Effort | Launch blocker | Notes |
|-----|-------|------|----------|--------|----------------|-------|
| H-01 | Clean up ~196 stale snapshot files (`mobile87.html`–`mobile196.html`) | infra | P2 | S | No | Workspace clutter, not a runtime issue |
| H-02 | Add Cowork tasks beyond #32 to the persistent task list | infra | P2 | S | No | Ledger drift — recent shipped work isn't in the formal task list |
| H-03 | Wire live re-render of Readiness card on every set toggle | feature | P2 | M | No | Investigated, not fully wired; partial because computeOverallFatiguePct already includes active session |

### Open from Cowork (recently surfaced, not yet in main task list)

| ID  | Title | Type | Priority | Effort | Launch blocker | Notes |
|-----|-------|------|----------|--------|----------------|-------|
| C-01 | Design visual layout | design | TBD | TBD | TBD | Need scope clarification — polish on existing #32 redesign, or new direction? |
| C-02 | ~~Add event to calendar~~ — folded into D-07 (native EKEventStore plugin) | feature | DONE-as-D-07 | — | — | Same outcome, native implementation |
| C-03 | Rebuild app from HTML data | infra | P3 | L–XL | No | This is the Next.js port (#25). Per 2026-05-10 decision, deferred until refactor pressure emerges — not the current path |

### Forward-looking / partial

| ID  | Title | Type | Priority | Effort | Launch blocker | Notes |
|-----|-------|------|----------|--------|----------------|-------|
| F-01 | "Tomorrow's plan" surface (separate from today-headline recommendation) | feature | P2 | M | No | Today-headline already in place; tomorrow notes demoted to bullets. Lacks dedicated UI |
| F-02 | Volume tracking as optional Momentum chart axis (sets × reps × weight) | feature | P2 | M | No | From INCYTE_Handoff.docx suggested-next-steps |
| F-03 | Skipped-movement detection — badge/warning when a planned movement has no logged sets after session finished | feature | P2 | S | No | From handoff |
| F-04 | Multi-period sparkline overlay (e.g., last 3 weeks vs lifetime) | feature | P3 | M | No | From handoff |
| F-05 | Import workout templates from structured text — bulk-create a plan week without tapping | feature | P3 | M | No | From handoff |
| F-06 | Dark-mode token layer via `@media (prefers-color-scheme: dark)` | design | P3 | S | No | From handoff. Tokens already separated from semantics |
| F-07 | PWA manifest + service worker | infra | P3 | S | No | From handoff. Superseded by Capacitor decision for App Store; revisit only if PWA fallback becomes path |
| A-01 | **Resolve Supabase-primary vs. localStorage-only-v1 architecture mismatch** | infra | P0 | M–L | Yes | Handoff says Supabase is cloud-primary; v1 plan ships localStorage-only. Either temporarily disable cloud-primary writes for v1, or stash the cloud-sync logic behind a feature flag. Real engineering work — confirm scope before sizing the rest of the punch list |

---

## Shipped

Numbered Cowork tasks that have shipped. Many additional features shipped post-#32 without being added to the formal list — see "Post-#32 unlogged" below.

| ID  | Title | Type | Notes |
|-----|-------|------|-------|
| 1   | Embed plan data into desktop HTML | infra | Bake initial plan rows into HTML |
| 2   | Build Today view on desktop | feature | Daily session screen + active set logging |
| 3   | Add WoW change card to desktop | feature | Week-over-week delta card (later replaced by #19) |
| 4   | Add 3-week history card to desktop | feature | Three-week rolling history view |
| 5   | Add Plan tab (weekly grid) | feature | Mon–Sun grid of planned movements |
| 6   | Mirror changes to mobile HTML | infra | Port desktop features to mobile single-file |
| 7   | Verify both files load and render | infra | Smoke test |
| 8   | Reimport workout xlsx data into seed | infra | Re-seed from external xlsx |
| 9   | Apply new seed to desktop and mobile | infra | Update both files |
| 10  | Fix empty-plan rendering after import | bug | — |
| 11  | Fix Add Movement modal not selecting | bug | Picker click not propagating |
| 12  | Add plan edit/delete on desktop | feature | — |
| 13  | Mirror plan edit to mobile | infra | — |
| 14  | Verify plan edit flow end-to-end | infra | — |
| 15  | Export/import of plan + history (JSON) | feature | Backup mechanism |
| 16  | Fix Done button + Save & Resume + editable workout date | bug+feature | — |
| 17  | Cardio (distance + time) for Run and Swimming | feature | Cardio columns introduced |
| 19  | Replace WoW sidebar with weekly body-part progress | design | Superseded #3 |
| 20  | Edit past sessions in History view | feature | Inline editor under each row |
| 21  | Collapse/expand exercise cards | design | — |
| 22  | Per-set delete button | feature | — |
| 23  | Training-type dropdown on weight exercises | feature | strength/hyp/power/end/mob |
| 24  | Default exercise cards to collapsed | design | — |
| 25  | Build Next.js + Supabase scaffold | infra | Parallel cloud build |
| 26  | Upgrade 1RM + progression engine sensitivity | feature | Brzycki/Epley blend + RPE sensitivity |
| 27  | Auto-finish workout when all sets complete | feature | — |
| 28  | Flat / Decline / Weighted variants | feature | — |
| 29  | Rename Weighted Dips → Dips with migration | infra | — |
| 30  | edited_at + recalc trigger on history edits | feature | — |
| 31  | Stack Movement/Equipment/Variant + collapsible Movement Details | design | — |
| 32  | Modular card UI redesign — dark default, Miami accents, hero modules, bottom nav | design | Most recent ledgered task |

### Shipped post-#32 (unlogged in Cowork — backfill needed; tracked here as H-02)

- Cardio variant chips
- Per-day plan count fix
- RPE calibration (`calibrateRpe`)
- Fatigue scale rework (`computeOverallFatiguePct` unification)
- Today summary panel + Recovery Impact card
- Custom lists CRUD (categories / equipment / variants / canonicals)
- Today-only recommendation rebuild (branch table on `trainedToday` + tier bands)
- Miami palette gradient swap
- Skip / Do-now chips on Week tab
- Cardio RPE column on every cardio movement
- Bike RPE/Variant dropdown (HIIT / Steady State) + BPM column
- N/A checkbox on swimming time inputs

## Cut

_No items consciously cut yet. As scope decisions are made, log them here AND in `decisions.md`._

| ID  | Title | Cut on | Reason |
|-----|-------|--------|--------|
| —   | —     | —      | —      |
