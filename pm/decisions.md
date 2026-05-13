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
