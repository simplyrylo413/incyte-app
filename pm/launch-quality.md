# INCYTE — Launch Quality Checklist

> Run before D-05 (App Store assets) and before tapping "Submit" in App Store Connect. Treat each section as gate criteria, not aspirations.

Synthesized from: INCYTE_Handoff.docx, uipro UI/UX guidelines (99 rules), frontend-design anti-patterns, LibreUIUX precision-over-vagueness methodology.

---

## 1. UI Critique Pass (do this once per tab before screenshots)

For each of the four tabs — **Week / Momentum / Library / Insights** — open the canonical `~/fitness-app/src/fitlog-mobile.html` in iOS Safari (or simulator), then verify:

### Token compliance
- [ ] Every color rendered is traceable to a defined token (`--accent`, `--accent-2/3`, `--ok`, `--warn`, `--bad`, `--ink`, `--muted`, `--label`, `--paper`)
- [ ] Progress gradient is the locked one: `linear-gradient(90deg, #5d9bb8 0%, #9b82c8 55%, #c9a0be 100%)` — no substitutions, no solid replacements
- [ ] Type sizes use the defined scale (10/11/12/13/14/15/18/22/28/34px) — no arbitrary sizes
- [ ] Elevation matches `--depth-1/2/3` — no one-off shadows

### Anti-patterns (INCYTE-specific, from handoff)
- [ ] No left-border accents on movement cards
- [ ] No top stripe on the today card
- [ ] No underline bar on Week tab part cards (`vol-bar` height = 0)
- [ ] No emojis as structural icons (SVG only)
- [ ] No "AI purple/pink gradient" applied outside the defined progress-gradient surfaces (Recovery map fatigue bars, sparkline fills)

### Anti-patterns (general)
- [ ] No "Bootstrap-era" generic cards (every card matches `--depth-1/2/3` tier)
- [ ] No mono-cap eyebrows used as content filler — `--text-eyebrow` is for labels/metadata only
- [ ] No fabricated demo data shown as if real

---

## 2. Accessibility (hard numbers)

- [ ] Text contrast ≥ **4.5:1** for body, ≥ **3:1** for large text (use Chrome DevTools color picker)
- [ ] Focus rings visible on every interactive element (no `outline: none` without replacement)
- [ ] **No information conveyed by color alone** — pair color with icon or text (e.g., status badges have a label, not just color)
- [ ] Every input has a real `<label>`, not just placeholder text
- [ ] Error messages adjacent to the affected field, with `role="alert"` or `aria-live`
- [ ] Heading hierarchy is sequential (h1 → h2 → h3, no jumps)
- [ ] Icon-only buttons have `aria-label`
- [ ] Keyboard tab order matches visual order
- [ ] `prefers-reduced-motion` honored (no parallax, no breathing animations, no progress-ring pulses if user opted out)

---

## 3. Interaction Polish

- [ ] Touch targets ≥ **44×44px**, ≥ **8px gap** between adjacent targets
- [ ] All transitions land in **150–300ms** range (no 500ms+ UI animations, no `linear` on UI)
- [ ] Easing: `ease-out` for entering, `ease-in` for exiting
- [ ] Loading feedback for any operation > 300ms (skeleton or spinner — not frozen UI)
- [ ] Buttons disabled during async (no double-submission possible)
- [ ] Disabled states use `opacity-50 + cursor-not-allowed` (not same style as enabled)
- [ ] Active/pressed state on every tappable element (e.g., `active:scale-95`)
- [ ] Confirmation modals on irreversible actions (delete session, clear data)
- [ ] Success feedback after every state-changing action (toast or visual change, not silent)

---

## 4. Mobile / Responsive

- [ ] Viewport height uses `dvh` not `100vh` (mobile browser chrome breaks `100vh`)
- [ ] Body text ≥ **16px** on mobile (no `text-xs` for body)
- [ ] Tested at 375 / 414 / 768 / 1024 widths (iPhone SE / standard / iPad / iPad Pro)
- [ ] No horizontal scroll on any tab at any width
- [ ] Images scale: `max-w-full h-auto`, no fixed pixel widths overflowing
- [ ] Safe areas respected on notched devices (use `env(safe-area-inset-*)` where relevant)

---

## 5. Copy Quality — No AI-Slop Register

INCYTE's voice is **clinical, direct, calibrated** — like a thoughtful coach who respects your time, not a hype reel.

**Reject:**
- [ ] No motivational filler ("Crush your goals!" "Let's get it!" "You got this!")
- [ ] No twee subcopy ("Oops, looks like that didn't work...")
- [ ] No ornamental flourishes ("✨ All set! ✨")
- [ ] No themed replacement of standard UI labels (e.g., "Tracking" instead of "Loading")
- [ ] No emoji punctuation
- [ ] No mono-cap eyebrows used as decorative labels — only as metadata/sublabels

**Aim for:**
- [ ] Empty states state the fact + one next action ("No sessions this week. Plan one.")
- [ ] Error states say what failed + what to do ("Sync paused — check connection.")
- [ ] Success states are brief ("Saved." not "Workout saved successfully! 🎉")
- [ ] Recommendation headlines branch on real state ("Push your planned session today" — not "Time to crush it!")

---

## 6. App Store Assets (D-05)

### Screenshots
- [ ] 5–8 screenshots, latest iPhone size (currently 6.7" / 1290×2796)
- [ ] First screenshot is the strongest single image — typically Today/Week active session with calibrated recommendation visible
- [ ] Each screenshot has a one-line caption that emphasizes the trained-lifter positioning ("Honest feedback, not motivation theatre")
- [ ] No screenshots show fabricated PRs / unrealistic data — use realistic example sessions
- [ ] Anti-pattern: avoid generic "muscle group illustrations" or stock fitness imagery

### App Icon
- [ ] Renders correctly at all required sizes (use `web-asset-generator` skill or `xcrun` icon generation)
- [ ] Readable at 60×60px (the home-screen size)
- [ ] No text in the icon (Apple HIG)
- [ ] No transparency / no alpha channel in the 1024×1024 master
- [ ] Visually consistent with INCYTE palette — steel blue accent on neutral, not orange (resist the "fitness icon = orange" convention)

### Preview Video (optional but recommended)
- [ ] 15–30 seconds, no music required
- [ ] Shows: logging a set → finishing workout → readiness/recovery feedback
- [ ] No text overlays except final brand frame
- [ ] Same audio standards as Apple's HIG (no abrupt cuts, no auto-play volume)

### App Store Listing Copy
- [ ] Subtitle hooks the audience definition explicitly ("for people who already know how to train")
- [ ] First paragraph leads with what INCYTE is *not* (a beginner's tutorial, a social network) before what it is
- [ ] Feature list uses noun phrases, not marketing verbs ("Calibrated RPE" not "Track your effort like a pro!")
- [ ] Privacy section discloses on-device storage clearly

---

## 7. Pre-Submission Engineering Gates

- [ ] B-01 (Save & Exit drops to History) fixed and verified across at least 5 test runs
- [ ] A-01 (Supabase-primary vs. localStorage-only-v1) resolution implemented and tested offline
- [ ] No `console.log` / `console.error` left in production code paths
- [ ] No commented-out debug code blocks
- [ ] Capacitor build runs on iOS simulator without warnings
- [ ] App handles app-state transitions cleanly: foreground → background → foreground with active session intact
- [ ] LocalStorage quota tested with a year of fabricated session data (no silent failures at ~5MB)
- [ ] First-run state (empty data) renders all 4 tabs without errors

---

## 8. Last 24 Hours Before Submission

- [ ] Privacy policy live at a stable URL
- [ ] App Store Connect privacy labels filled (Health & Fitness category, on-device storage)
- [ ] App Store Connect listing draft saved with screenshots + copy
- [ ] Capacitor build archived with correct version number + build number
- [ ] TestFlight build uploaded and self-tested on at least one physical device
- [ ] Demo account / review notes prepared for Apple reviewer (if app requires any state to demonstrate)

---

_Last updated: 2026-05-12. Source of truth — update when launch criteria change._
