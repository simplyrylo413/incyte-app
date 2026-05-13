# Roadmap

> Living document. Updated whenever priorities shift. Decisions go in `decisions.md`.

## Vision

A workout tracker for trained lifters that turns logged sets into honest feedback — telling you when you've actually pushed, when you should back off, and how today's session moves your week. Not a logger. Not a coach. A mirror calibrated for people who already know how to train.

## Audience

**Primary:** Trained lifters, 1+ year of consistent training experience. Multi-discipline (strength + cardio + mobility). Self-aware enough to report RPE.

**Explicit non-audience:** First-time beginners. The recommendation engine assumes calibrated RPE input from someone who knows what failure feels like.

## North Star Metric (candidate — to confirm)

_Working candidate:_ **Weekly active session completion rate** = sessions finished / sessions planned, averaged across active users over the trailing 4 weeks.

Why this and not retention/DAU: this app's value lies in calibrated feedback on planned training. If users skip sessions, they're getting fewer recommendations and the app's compounding value evaporates. If they complete, the engine has data to work with and Insights/Week tabs become meaningful.

_Alternates considered (low confidence — discuss):_
- D7/D30 retention — standard but doesn't reflect training adherence.
- Sessions logged per user per week — too easy to game with junk sessions.
- Recommendation-followed rate — most aligned with the value prop, but hard to measure honestly.

## Now (Pre-launch punch list — Capacitor-direct → App Store, v1 = localStorage-only)

**Path locked.** Capacitor wrap of `fitlog-mobile.html` → App Store. v1 ships **without** Supabase auth or remote push — both deferred to v1.1. See `decisions.md` 2026-05-10.

**Final 7-item launch list (suggested order):**

1. [ ] **D-08** — Apple Developer Program enrollment ($99/yr). _Start TODAY — has 24–48h lead time, sometimes longer. Doesn't block other work._
2. [ ] **B-01** — Fix Save & Exit dropping today's session into History. Only formally-open bug; don't ship with it.
3. [ ] **D-06** — Capacitor scaffold around `fitlog-mobile.html`. iOS project, build pipeline, asset bundling, splash/icon.
4. [ ] **D-07** — Bind native calendar plugin (EKEventStore). Replaces C-02; provides "native value" for App Store review.
5. [ ] **D-09** — Bind `@capacitor/local-notifications`. Training reminders, rest timers, streak nudges. ~1 day. Second native plugin = stronger App Store review posture.
6. [ ] **D-02** — Privacy policy hosted publicly + App Store privacy labels. Required even without auth (health-data category, on-device storage disclosure).
7. [ ] **D-05** — App Store listing copy + 5–8 screenshots + 30s preview video. Positioning hook: "for people who already know how to train."

**Realistic timeline (solo dev):** ~2.5–3.5 weeks from kickoff to App Store submission. Add ~1–2 weeks for Apple review + any rejection round-trips.

**Open scope questions (don't block launch but worth resolving early):**
- C-01 "Design visual layout" — what's the actual scope? Polish on the #32 redesign, or unfinished work? Until clarified, treat as P2 polish, not P0.

**v1 explicitly out of scope** (now in `## Won't` for v1, moves to Next/Later):
- Supabase auth, accounts, cross-device sync (v1.1)
- Remote push notifications / APNs (v1.1, after auth ships)
- D-03 account deletion (only required when auth lands)
- B-02 Supabase field gaps (only matters when cloud sync ships)
- B-03 same-day session loss investigation (monitor v1; if it still surfaces without cloud, root cause is local)

## Next (First 4–8 weeks post-launch)

Based on real usage signal, in roughly this order:

- D-04: Onboarding / first-run experience (skip-able 30s walkthrough) — lift to launch only if conversion data demands it
- F-01: "Tomorrow's plan" surface (separate from today-headline recommendation)
- H-03: Live re-render of Readiness card on every set toggle (currently partial)
- B-02 / B-03 cloud sync fixes if not done at launch
- HealthKit binding if not picked as the D-09 second plugin

## Later (3–6 months out)

Directional bets, not commitments. Re-evaluate quarterly based on what users actually ask for.

- Apple Health / HealthKit integration (only if going native or via PWA permissions API)
- Multi-user / coach mode (high risk — moves out of the trained-lifter-self-aware audience)
- Training-block templates (4/8/12 week mesocycles) — natural extension of Plan tab
- Apple Watch companion (live RPE input, set timer)
- Subscription / paid tier (only after retention data justifies it; free for v1)

## Won't (Explicit cuts)

_Add to this list as scope decisions are made. The point of this section is to prevent re-litigation._

- Beginner-mode / "guided first lift" flow — explicitly rejected by audience definition
- Social / feed / leaderboard features — drift away from the "calibrated mirror" positioning
- Visual redesign into a non-grayscale identity — see `feedback_visual_direction.md`

---
_Last updated: 2026-05-10_
