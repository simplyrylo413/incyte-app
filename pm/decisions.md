# Decisions Log

Append-only record of meaningful PM decisions. Each entry captures what was decided, what was considered, and why — so future-you (and Claude) don't re-litigate settled questions.

## Format

```
## YYYY-MM-DD — <decision title>

**Decision:** <one sentence>

**Context:** <what triggered this — bug, user feedback, scope pressure, etc.>

**Alternatives considered:**
- Option A — <pros/cons>
- Option B — <pros/cons>

**Rationale:** <why we picked what we picked>

**Revisit when:** <event that would invalidate this decision, or a date>
```

---

## 2026-05-10 — Set up PM workspace

**Decision:** PM artifacts live in `~/fitness-app/pm/` as markdown (roadmap, backlog, decisions). Skill creation deferred.

**Context:** Solo developer using Claude as PM partner for an iOS fitness MVP heading toward App Store submission. Needed durable artifacts that survive across Claude sessions.

**Alternatives considered:**
- Notion / Linear — overkill for solo dev, adds friction.
- Inline in Claude conversation — non-durable, gets truncated.
- Custom skill — premature; built-in judgment + memory + files cover this.

**Rationale:** Markdown files in a known directory are version-controllable, openable in any editor, and Claude reads/writes them across sessions. Codify a custom skill later if recurring patterns emerge.

**Revisit when:** Workspace gets too big (>10 files) or recurring PM patterns emerge that would benefit from a skill.

---

## 2026-05-10 — iOS distribution path: Capacitor-direct → App Store

**Decision:** Wrap the existing `fitlog-mobile.html` in **Capacitor** and ship to the **App Store directly** (no PWA-first detour). Bind a small number of native plugins at launch — at minimum calendar (EKEventStore) to satisfy C-02 and provide the "native value" App Store reviewers expect.

**Context:** Current build is `fitlog-mobile.html` — single-file HTML5 + vanilla JS, ~14,800 lines, mobile-first. User stated intent to be "on iOS." There is also a Next.js + Supabase scaffold (#25) sitting alongside, separate from the HTML build. We need to pick one path before App Store work starts.

**Alternatives considered:**

- **A. PWA (no App Store)** — host the HTML somewhere (Vercel/Cloudflare Pages), users add to home screen on iOS Safari.
  - Pros: Ship today. Zero App Store overhead. No native rewrite. iOS Safari supports localStorage + most Web APIs.
  - Cons: No App Store discoverability. iOS PWA limitations (push notifications via web push only, calendar APIs limited, no HealthKit, install friction). "Calendar event" task (C-02) needs a workaround.

- **B. Capacitor (or Cordova) WebView wrap → App Store** — wrap existing HTML in a native shell.
  - Pros: Reuse the entire 14.8k-line codebase. Get App Store distribution + native APIs (calendar, push, HealthKit, share). Solo-friendly: one codebase, native shell adds days not months.
  - Cons: App Store review can reject pure WebView wrappers as "not enough native value" — mitigation is to use one or two native APIs (calendar, share, HealthKit) so it's not purely web. Some web→native debugging friction.

- **C. Next.js + Supabase scaffold becomes the production app, deployed as web + Capacitor** — invest in the parallel build (#25) and retire the HTML.
  - Pros: Real component architecture. Cloud-first by default. Long-term maintainability of a 14.8k single-file is a known liability.
  - Cons: Likely months of port work — every feature shipped post-#25 was built into the HTML, not the scaffold. Solo developer + scope this large = significant launch delay.

- **D. Native iOS rewrite (Swift/SwiftUI)** — rebuild from scratch.
  - Pros: Best UX, all native APIs, App Store loves it.
  - Cons: Multi-month rewrite for a solo dev with a feature-complete v1 already shipping. Throws away working engine code. Almost certainly the wrong call right now.

**Rationale:**
- Native iOS API access was the deciding factor. Capacitor exposes the full set (HealthKit, calendar, push, share, biometrics) via plugins — the user's concern that Capacitor would lock them out of native APIs was a misconception.
- Reuses all 14,800 lines of working HTML/JS. No port work, no rewrite, no scaffold revival.
- App Store distribution + native APIs at launch matches user's "going to be on iOS" intent.
- PWA-first detour was rejected: the user wants native APIs at launch, so the PWA learning phase doesn't add proportional value.
- Next.js scaffold port (Option C) was rejected as the *next* step but remains the right *eventual* destination once a refactor pressure emerges (a feature the HTML can't ship, or maintainability pain that justifies 2–3 months of porting).

**Plugins to bind at launch (minimum):**
- Calendar (`@capacitor/calendar` or `cordova-plugin-calendar` via Capacitor) — kills backlog item C-02 and provides "native value" for App Store review.
- One more, TBD — likely share sheet (small lift) or HealthKit (high-value but larger lift). Decide during scaffold work.

**Revisit when:**
- A feature lands that the HTML build genuinely can't ship — that's the trigger to start the Next.js port.
- App Store rejects the build for "insufficient native value" — at which point the answer is "bind another native plugin," not "abandon Capacitor."

**Status:** Locked. Roadmap and backlog updated to reflect Capacitor-direct path.

---

## 2026-05-10 — Defer Supabase auth + cloud sync to v1.1; v1 ships localStorage-only

**Decision:** v1 launch ships with localStorage as the only persistence layer. Supabase auth, account creation, and cloud sync are pulled out of the launch scope and become v1.1 (~4 weeks post-launch).

**Context:** Capacitor-direct path locked, push flavor pending. User asked whether to build Supabase auth into v1 or defer. Auth would have added: signup/login UI, password reset, account-deletion flow (D-03, App Store guideline 5.1.1(v)), Supabase upsert field fixes (B-02), and same-day-session-loss investigation (B-03).

**Alternatives considered:**
- **B. Build auth into v1.** ~2–3 extra weeks of work. Cross-device sync at launch. More privacy/legal surface. Required account-deletion flow. The user initially picked this then reversed.
- **A. localStorage-only v1, auth in v1.1** (chosen). Single-device users covered fully. Multi-device users use the existing JSON export/import (#15) as a manual workaround until v1.1.

**Rationale:** Most v1 users are likely single-device for a personal training log. Auth + cloud is a feature to ship to excited users, not a feature to delay launch for. Cuts ~1–2 weeks off the launch path and removes 3 backlog items (D-03, B-02, B-03) from the launch-blocker list.

**Revisit when:** Either (a) v1 is in the App Store and stable, then start v1.1 auth, or (b) early user feedback heavily emphasizes cross-device sync — in which case escalate the v1.1 timeline.

---

## 2026-05-10 — Push notifications: local-only at launch (remote deferred to v1.1)

**Decision:** Use `@capacitor/local-notifications` exclusively for v1. No APNs / remote-push infrastructure at launch.

**Context:** Push was selected as the second native plugin binding (D-09) for App Store "native value." Two flavors were on the table: local notifications (on-device scheduling, no server) and remote push (APNs + backend).

**Rationale:**
- Coheres with localStorage-only v1: no backend exists to send remote pushes from.
- Local notifications cover the highest-value v1 use cases: training reminders, rest timers, streak nudges, "you have a planned session today" alerts.
- ~1 day of work vs. 3–5 days for remote push setup.
- Remote push without a real backend nudge loop tends to be either unused or annoying.

**Revisit when:** v1.1 ships with Supabase auth — at that point a backend exists and remote push has somewhere to push from. Trigger features at that point: re-engagement (haven't trained in N days), social/coach mode, multi-device session conflict alerts.

---

## 2026-05-12 — File workflow: retire numbered snapshots, adopt git commits

**Decision:** Going forward, edit `~/fitness-app/src/fitlog-mobile.html` directly and commit each meaningful change to git. The "save as `mobile{N+1}.html`" pattern (308 numbered files from mobile87 through mobile332) is retired.

**Context:** The Cowork-managed project at `~/Documents/Claude/Projects/Workout tracker/` accumulated 309 numbered HTML snapshots as a manual version-control workflow. Once the project moved to `~/fitness-app/` with git initialized, the snapshot workflow became redundant.

**Rationale:**
- Git provides per-change history, diffs, rollback, branching — all the things the snapshot workflow was approximating.
- Single canonical filename means external references (App Store listing, marketing site, Capacitor build) point at a stable path.
- Disk usage: snapshot workflow grew the project to 671 MB; git keeps it under 2 MB.
- Trivial to roll back via `git checkout` instead of "which mobile{NNN} was the last good one."

**Status:** Locked. Canonical file is `~/fitness-app/src/fitlog-mobile.html` (currently mobile294 baseline). The old snapshots remain in `~/Documents/Claude/Projects/Workout tracker/` as archive — do not write new files there.

**Open reconciliation:** mobile295–332 are WIP iterations that postdate the mobile294 handoff baseline. User should either (a) merge their notable changes into the canonical file (then commit) or (b) declare them experimental and discard. Tracked as a working item, not a launch blocker.

---

## 2026-05-12 — Supabase-primary vs. localStorage-only-v1 architecture mismatch (FLAGGED, NOT RESOLVED)

**Decision:** Hold the "v1 ships localStorage-only" direction (per 2026-05-10 decision), but explicitly acknowledge that the current code is cloud-primary per INCYTE_Handoff.docx — this is engineering work to resolve, not a configuration flip. Added as backlog item **A-01** in the launch punch list, between Apple Dev enrollment and Capacitor scaffold work.

**Context:** The INCYTE handoff (mobile294, May 11) describes persistence as: *"Supabase Realtime (cloud primary) + localStorage (offline cache)."* The v1 launch decision (2026-05-10) was made on the earlier framing that localStorage was primary. The handoff invalidates that assumption.

**Three plausible resolutions** (decide during A-01 work):
- **Feature flag** — `CLOUD_ENABLED = false` for v1 build, sync code remains but is dormant. Cleanest, smallest blast radius. Recommended starting point.
- **Strip cloud calls** — remove Supabase upsert/realtime code from the v1 build entirely. More invasive but produces a smaller, faster app.
- **Re-evaluate the localStorage-only decision** — if A-01 reveals the cloud sync is too entangled to disable safely, the cheaper path may be to keep cloud sync in v1 (with anonymous Supabase rows, no auth/login UI). Would require revisiting the 2026-05-10 decision.

**Rationale for flagging but not reversing 2026-05-10:**
- The user explicitly chose "stay the course" when the mismatch was surfaced on 2026-05-12.
- Anonymous Supabase (no auth) still avoids D-03 (account-deletion flow) and most of the launch-blocker weight.
- The right time to decide between the three resolutions is when scoping A-01, not now.

**Revisit when:** A-01 is being scoped. Update this entry with the chosen resolution.

---

## 2026-05-12 — Light mode is the default theme (RESOLVED)

**Decision:** **Light mode is the default theme for INCYTE.** Dark mode becomes an opt-in toggle, not the default.

**Context:**
- **INCYTE_Handoff.docx (mobile294, May 11):** *"Mobile-first layout, dark theme by default with light theme toggle."*
- **UX Rationale doc (pasted by user May 12):** *"Light frosted glass foundation. Pale blue-gray surfaces. Restrained blue-gray accents. Dark navy primary actions."*

The newer rationale doc describes a light-mode experience. The handoff baseline (`mobile294.html`, currently committed at `~/fitness-app/src/fitlog-mobile.html`) ships dark-by-default.

**Three plausible resolutions:**
- **A. Switch to light-default** per the rationale doc, retire dark-default. The light-mode mockups (`~/fitness-app/pm/mockups/01-03`) become the design baseline.
- **B. Keep dark-default**, treat the rationale doc as describing the light-mode variant. Build dark equivalents of the three mockups.
- **C. Make the toggle real and equal-priority**, with no canonical "default" — both themes are first-class. Slightly more work but matches premium-app convention.

**Rationale:**
- The UX rationale doc (May 12) is more recent than the handoff (May 11) and specifies "light frosted glass foundation, pale blue-gray surfaces, dark navy primary actions."
- Light glass + blue-gray + dark navy reads as "premium / calm" — matches the trained-lifter positioning ("calm mirror, not hype reel"). Dark default tends to read as "gaming / dev tool."
- Lower visual risk for App Store screenshots and listing imagery — pale surfaces photograph more credibly as "premium consumer health app."
- Gym environments are typically well-lit; light surface is the right default for in-use viewing.

**Implementation impact:**
- All three light-mode mockups (`01-today-overview.html`, `02-workout-mode.html`, `03-add-movement-sheet.html`) and `prototype.html` become the design baseline.
- `fitlog-mobile.html` ships dark-default today (per handoff). **A theme switch is required as part of the v1 launch work** — flip the default surface tokens to the light variant, keep dark as an opt-in toggle. Logged as backlog item below.
- Dark variant mockups are not required as launch blockers — they can be added later if dark mode polish needs visualization.

**Revisit when:** A future reason to make dark the default emerges (e.g., user feedback overwhelmingly preferring dark, or App Store competitive analysis showing dark wins). Until then, light is locked.

---

## 2026-05-12 — Canonical tab structure: Today / Plan / Momentum / More (RESOLVED)

**Decision:** The four canonical bottom-nav tabs are **Today, Plan, Momentum, More.**

**Context:**
- **INCYTE_Handoff.docx (mobile294, May 11):** Used Week / Momentum / Library / Insights.
- **UX Rationale doc (May 12):** Centered the surface name "Today" without enumerating all tabs.
- The prototype used Today / Plan / Momentum / Library as a working interpretation, then the user confirmed Today / Plan / Momentum / More.

**Mapping from handoff → canonical:**
- "Today" replaces "Week" — same surface (current week's session view), better day-focused naming for the trained-lifter audience.
- "Plan" is new as a top-level tab — promoted from being a Week sub-view to its own surface for the weekly grid editor.
- "Momentum" unchanged — progress analytics (PR hero, sparkline, history table).
- "More" replaces "Library" + absorbs "Insights" — overflow tab containing the movement library, readiness/fatigue insights, settings, theme toggle, profile, history of past sessions. Standard iOS convention.

**Rationale:**
- Four-tab cap matches iOS HIG recommendation for bottom nav (max 5, recommended ≤4 for clarity).
- "More" pattern is well-understood by iOS users; collapsing Library + Insights + Settings into one overflow tab reduces top-level cognitive load.
- "Today" is concrete and action-oriented; "Week" is broader and less immediate.
- Plan as its own tab makes the weekly grid editor first-class — important for power users planning multiple weeks ahead.

**Implementation impact:**
- `fitlog-mobile.html` tab structure needs to be reworked from Week / Momentum / Library / Insights → Today / Plan / Momentum / More. Tracked as backlog item below.
- Insights content (Readiness, Recovery map, Muscle Stimulus, Recent PRs) moves under More → could become individual More-tab list rows or get a dedicated "Insights" detail screen within More.
- Library moves under More → standard list view, search-first.

**Revisit when:** Usage data post-launch shows a specific tab being undiscoverable (e.g., users can't find Insights). Could promote a frequently-used sub-screen back to top-level.
