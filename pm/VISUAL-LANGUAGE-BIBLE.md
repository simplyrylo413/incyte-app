# INCYTE — Visual Language & Art Direction Bible

> **The visual source of truth for all INCYTE implementation.**
> Every screen, component, and interaction must obey this document. When implementation conflicts with this bible, the bible wins.
> **Mandate:** INCYTE is *a believable physical hardware interface rendered digitally* — manufactured, not drawn. Approach every surface as industrial product design, not app UI.
> **Anchored to:** the cassette/MPC prototype (`public/workout-alt.html`) and the locked button-lighting standard (`CLAUDE.md §14`). These are the ground truth; this bible generalizes them into a system.
> **Compiled:** 2026-05-23.

---

## 0. The One Rule

> **If it looks like it was designed in Figma, it's wrong. If it looks like it was manufactured in a factory, it's right.**

Every pixel must answer: *what is this made of, how is it lit, and how is it assembled?* A surface that can't answer those three questions is a flat drawing and must be rebuilt. We are rendering objects with mass, material, and a light source — not arranging rectangles.

---

## 1. Core Visual Philosophy

### Emotional tone
**Controlled intensity.** The feeling of sitting at a professional console — a recording studio's mixing desk, a high-performance car's cockpit, a tactical operations terminal. Quiet authority. The machine is precise, built to last, and respects the operator. No hype, no celebration, no softness. Confidence through engineering.

### Industrial philosophy
INCYTE is a **manufactured instrument**. It has a chassis, panels bolted to that chassis, components recessed into or raised off those panels, and a single light source raking across it from the upper-left. Nothing floats. Nothing is "placed" — everything is *assembled*. Every element has an implied manufacturing process: machined, cast, injection-molded, brushed, anodized, screen-printed.

### Tactile philosophy
Every interactive element must look like it has **physical travel**. Buttons depress. Switches throw. Dials rotate with friction. Faders slide in a track. The user should feel, looking at a control, that they know exactly how it would respond to a finger — before they touch it. Affordance through realism, not labels.

### Hardware inspiration (the canon)
- **Akai MPC / Roland TR drum machines** — pad grids, LED steps, matte chassis, model nameplates
- **Studio mixing consoles (SSL, Neve)** — fader banks, channel strips, VU meters, recessed metering
- **Luxury automotive cockpits (Porsche, classic Mercedes)** — knurled aluminum dials, recessed gauges, rocker switches, leather-and-metal material contrast
- **Tactical / military electronics** — ruggedized housings, illuminated readouts, ribbed grips, warning-colored indicators
- **Vintage cassette decks (Nakamichi, TEAC)** — chrome trim, glossy translucent windows, spinning reels, illuminated meters
- **Hi-fi separates (McIntosh)** — blue VU meters, brushed-steel faceplates, glass fascia

### Realism principles
1. **One consistent light source.** Upper-left, ~125° rake. Every highlight, every shadow, every bevel agrees on where the light comes from.
2. **Material before color.** Decide what something is made of before what color it is. Aluminum reflects differently than plastic differently than glass.
3. **Assembly logic.** If two surfaces meet, there is a seam, a bevel, a rivet, or a shadow gap. Surfaces never simply abut with no transition.
4. **Implied weight.** Heavy elements (the chassis) sit low and cast long shadows. Light elements (LEDs, labels) are screen-printed onto surfaces, flush.
5. **Wear is earned, not added.** Subtle — a faint specular scuff on a glossy surface, a slightly worn label edge. Never distressed-for-style. This is well-maintained professional equipment, not abandoned junk.

---

## 2. Material System

There are exactly **five materials**. Every surface in INCYTE is one of these. No surface may be "none of the above."

### Material 1 — Matte Black Chassis (`MAT-CHASSIS`)
The structural body. The frame everything bolts to.
- Base: flat `#161618` (the outer frame is intentionally *flat* matte — the lighting lives on the components, not the chassis)
- No gloss. Absorbs light. This is the negative space that makes lit components pop.
- Edge: 1px `#0d0d0e` border, near-black.
- **Recipe (chassis frame):**
  ```css
  background: #161618;
  border: 1px solid #0d0d0e;
  box-shadow:
    0 16px 32px rgba(0,0,0,0.9),   /* heavy drop — the chassis has mass */
    0 4px 8px rgba(0,0,0,0.6),
    0 0 0 1px #0a0a0b;             /* hairline seam to the world */
  ```

### Material 2 — Machined Metal Panel (`MAT-METAL`)
Raised panels, stat housings, the chrome rim of the cassette. Brushed/anodized aluminum with a directional sheen.
- A vertical gradient simulates a curved or beveled metal face catching the raking light:
  ```css
  /* Chrome rim — bright top edge, dark belly, bright bottom edge */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 8%),
    linear-gradient(180deg, #3a3f44 0%, #1a1d20 12%, #0e1012 50%, #1a1d20 88%, #3a3f44 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.55),   /* polished top lip */
    inset 0 -1px 0 rgba(255,255,255,0.18),  /* catch on bottom lip */
    0 4px 12px rgba(0,0,0,0.6);             /* sits above the chassis */
  ```
- **Brushed-aluminum variant** (stat panels): add a fine-noise texture overlay (SVG `feTurbulence` baseFrequency ~0.75, very low alpha ~0.04–0.06) over a steel gradient. The noise is the brush grain — barely perceptible, never decorative.
  ```css
  background:
    url("data:image/svg+xml;...feTurbulence baseFrequency='0.75'...alpha 0.06"),
    linear-gradient(160deg, #2a2e33 0%, #1a1d21 50%, #111316 100%);
  border: 1px solid #3a3f44;
  border-top-color: #4a5055;   /* the top edge catches more light */
  ```

### Material 3 — Glossy Translucent Plastic (`MAT-PLASTIC`)
The cassette window, lens covers, smoked acrylic over displays. Semi-transparent, high-gloss, with a hard specular highlight.
- Multi-layer gradient stack — top gloss, diagonal specular sheen, ambient warm corner, base tint:
  ```css
  background:
    linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 30%),     /* top gloss band */
    linear-gradient(125deg, transparent 32%, rgba(255,255,255,0.18) 50%, transparent 68%), /* diagonal sheen */
    radial-gradient(ellipse at 25% 5%, rgba(255,255,255,0.20), transparent 45%), /* warm ambient UL */
    linear-gradient(180deg, rgba(220,225,230,0.55) 0%, rgba(160,168,175,0.50) 100%); /* plastic body */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),    /* bright top rim */
    inset 0 -2px 4px rgba(0,0,0,0.35),       /* bottom inner shadow */
    0 2px 6px rgba(0,0,0,0.5);
  ```
- **Mandatory:** a `::before` "crystal stripe" — a 2px white→transparent highlight inset 8px from the top edge. This is the hard glint that sells "glass," not "frosted."

### Material 4 — Deep Inset LCD Glass (`MAT-LCD`)
Display surfaces. The deepest, darkest material — a near-black well that illuminated characters glow out of.
- Base: `#050607` (deeper than the chassis — it's a recessed cavity).
- Inset shadow makes it read as a sunken window:
  ```css
  background: #050607;
  border: 1px solid #2a2e33;
  box-shadow:
    inset 0 2px 10px rgba(0,0,0,0.95),       /* deep well */
    inset 0 0 0 1px rgba(255,255,255,0.03),  /* faint glass edge */
    0 1px 0 rgba(255,255,255,0.06);          /* tiny bottom catch */
  ```
- **Optional scanline overlay** for authenticity: `repeating-linear-gradient(0deg, transparent 0-2px, rgba(0,0,0,0.28) 2-3px)` — pixel-grid texture on the glass.
- **Side vignette** fade at left/right edges (the glass curves into the bezel).

### Material 5 — Chrome Hardware (`MAT-CHROME`)
Rivets, screws, dial caps, small accents. Tiny polished domes that catch a sharp specular point.
- Radial gradient simulating a spherical chrome dome lit from upper-left:
  ```css
  /* Rivet */
  background: radial-gradient(circle at 30% 30%, #c0c5ca 0%, #5a6065 60%, #0a0a0a 100%);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 1px 1px rgba(0,0,0,0.7);
  border-radius: 50%;
  ```
- **Phillips-head screw variant** (stat panels): a square-ish metal nub with a cross-slot drawn via `::before`/`::after` (two 1px dark lines crossing center). The cross must align consistently (all screws "tightened" to the same angle, or deliberately varied for realism — pick one and commit).

### Material adjacency rules
- **Metal never touches metal without a seam** — a 1px dark border or shadow gap.
- **Plastic sits proud of metal** — it casts a small drop shadow onto the panel below.
- **LCD is always recessed into** metal or chassis — never raised, never floating.
- **Chrome hardware sits on top of** everything as the final assembly step — rivets bolt panels down.
- **Chassis is always the backmost layer** — nothing is behind it.

### Surface wear philosophy
- Permitted: a single faint specular scuff on a large glossy surface; a 1px softening on a screen-printed label edge.
- Forbidden: grunge textures, scratches-for-style, rust, distressing, "worn paint" overlays. INCYTE is *professionally maintained equipment*. Wear is a whisper, never a statement.

---

## 3. Depth & Lighting System

### The light source (immutable)
- **Position:** upper-left, ~125° diagonal rake.
- **Consequence:** top and left edges catch light (lighter); bottom and right edges fall into shadow (darker). Every bevel, every inset, every drop shadow obeys this. A highlight on the bottom edge is a bug.

### The five depth planes (z-order, back to front)
1. **Chassis (z0)** — flat matte black, the structural ground. Heavy outer drop shadow.
2. **Recessed chambers (z-1, sunk INTO chassis)** — inner shadow on all four sides, darker than the chassis. Holds LCDs and component clusters.
3. **Panels (z1, raised OFF chassis)** — metal faces with top-light bevel + outer drop shadow.
4. **Components (z2, mounted ON panels)** — buttons, dials, displays. Their own bevels + shadows onto the panel.
5. **Hardware (z3, the final layer)** — rivets, labels, LED lenses. Sit on top, cast tiny shadows.

### Recessed element construction (sunk in)
A thing pushed *into* a surface reads via **inset shadows on top + left** (the lip casts inward) and an **inset highlight on bottom + right** (the far wall catches light):
```css
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.08),   /* faint top-inner catch */
  inset 0 0 0 1px rgba(0,0,0,0.6),         /* the cut edge */
  inset 0 2px 6px rgba(0,0,0,0.5);         /* depth into the well */
```

### Elevated element construction (raised up)
A thing standing *off* a surface reads via **outer drop shadow (down-right)** + **inset top highlight** (top edge catches light) + **inset bottom shadow** (underside curls away):
```css
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.20),    /* lit top edge */
  inset 0 -2px 5px rgba(0,0,0,0.45),       /* shadowed underside */
  3px 8px 16px rgba(0,0,0,0.85),           /* drop shadow, offset down-right per light */
  1px 3px 6px rgba(0,0,0,0.65);
```

### Shadow stacking rule
Shadows are **layered, never single**. A real object casts: (1) a tight contact shadow, (2) a mid drop, (3) a soft ambient. Every elevated element uses at least a 2-layer shadow; primary controls use 4+. A single `box-shadow: 0 2px 4px` is a flat-app tell and is forbidden on any physical component.

### Glow hierarchy (illumination)
Glow = a component is *powered on*. Three tiers:
1. **Indicator glow (LEDs)** — small, intense, localized. `box-shadow: 0 0 5px <color>, 0 0 10px rgba(<color>,0.5)`. Status dots, active markers.
2. **Display glow (LCD characters)** — characters emit. `text-shadow: 0 0 6px, 0 0 14px, 0 0 28px` stacked + `filter: drop-shadow(0 0 5px ...)` on SVG numerals. The character is the light source.
3. **Active-control glow (engaged button)** — text/icon ignites yellow on press: `text-shadow: 0 0 8px var(--yellow), 0 0 18px rgba(245,236,0,0.5)`.

Glow is **never decorative ambient wash**. It always means "this is energized." Dark = off, glowing = on. No glow without function.

### Cinematic contrast
- The chassis and chambers are genuinely dark (`#0e1012`–`#161618`). The lit elements (LCDs, LEDs, polished metal edges) are genuinely bright. The *range* between them is the drama.
- No mid-gray flatlands. If a large area is sitting at 40% gray with no light interaction, it's a flat-app surface and must be rebuilt as metal or chassis.

### Edge lighting (the signature)
Every panel and component gets a **bright top rim** (`inset 0 1px 0 rgba(255,255,255,0.2–0.55)`) and a **dark bottom/right** (`inset -1px -1.5px 0 rgba(0,0,0,0.65)`). This single technique — angled rim-light — is what makes surfaces read as manufactured metal. It is the locked standard (`CLAUDE.md §14`). It is non-negotiable on every raised surface.

---

## 4. Industrial Design Language

### Physical construction logic
The layout is read as an **assembly diagram**: a chassis, panels screwed into it, components mounted on panels, a model nameplate at the bottom. The user should be able to imagine disassembling it. Every cluster of controls is a "module" that could be a separately-manufactured part.

### Hardware spacing density
**Dense, deliberate, gridded.** Real equipment packs controls tightly because panel space is expensive. INCYTE is *not* generous-whitespace mobile UI. Components sit close, separated by thin seams and bevels, not by air. Spacing is *engineered tolerance* (the 1–2px gap between a button and its housing), not *visual breathing room*.

- Inter-component gaps: 6–10px (the tooling clearance between mounted parts).
- Panel internal padding: 14px (the bezel around a recessed chamber).
- Outer chassis padding: 4–7px (the frame lip).

### Tactical realism
- **Model nameplates:** every major chassis carries a screen-printed spec line — `INCYTE · MDL-X7 · 04CH` (6px mono, letter-spacing 2.5px, low-opacity). This is the regulatory/spec print on real equipment.
- **Port/IO markings:** small functional-looking labels (USB, power-in glyphs) along edges — the cassette nav's left "I/O column" is the template. They imply the device connects to things.
- **Channel/unit indicators:** "1/3", "04CH" — count indicators that imply the machine tracks discrete units.

### Machine-like layouts
- Controls align to an implied **manufacturing grid**. Buttons in a row share exact dimensions and spacing — they came from the same mold.
- Labels are screen-printed *onto* surfaces in mono caps, flush, slightly inset — not floating UI text.
- Symmetry within a module (a button row is evenly spaced), asymmetry between modules (the I/O column is narrow, the main display is wide) — like a real faceplate.

### Asymmetry rules
Real panels are *functionally* asymmetric: a narrow status column beside a wide display, an off-center power button, metering that's wider than its label. **Embrace functional asymmetry; reject decorative asymmetry.** The asymmetry must read as "this is where the engineering put it," never "this looks more dynamic."

### Industrial detailing (the texture of realism)
- **Ribbing/knurling** — grip texture on dials and tape windows (stacked thin lines).
- **Vents/grilles** — implied cooling slots where appropriate.
- **Pin rows** — the small connector pins flanking nav pads (the cassette nav template).
- **Seams** — visible parting lines where molded parts meet.
- **Spec print** — tiny mono text in low-opacity corners.

### Screw/rivet usage
- Rivets/screws appear at **structural corners** — where a panel bolts to the chassis. Four-corner placement on stat panels, the cassette frame.
- They are `MAT-CHROME` domes (§2). Size: 6px. Inset from the corner by 4–9px.
- **Rule:** rivets imply load-bearing assembly. Don't scatter them decoratively — they go where the panel would actually need fastening.

### Chassis construction
Every screen is a chassis. The bottom nav is the clearest example: a matte-black housing (`#161618`) with a model nameplate, an I/O column, pin rows, and mounted pads. Every other screen inherits this logic — content lives in panels mounted on a chassis, not in cards floating on a background.

---

## 5. Display System (LCD / digital readouts)

### Construction
Displays are **recessed glass wells** (`MAT-LCD`, §2) with characters that **emit light**. The display is never a light rectangle with dark text — it is always a dark well with glowing characters. (Inverse of fintech.)

### Character rendering
- Font: `Share Tech Mono` (numerals/data), or DSEG-7 for true 7-segment. Mono, mechanical, even-width.
- Color: `--yellow #f5ec00` for primary readouts; white for secondary (timers).
- **Glow is mandatory:** numerals carry `filter: drop-shadow(0 0 5px rgba(245,236,0,0.7))` (SVG) or stacked `text-shadow` (HTML). The character is a light source behind glass.
- Empty values render as `—` (em-dash), never `0` and never blank. A powered display always shows *something*.

### Glow intensity tiers
- **Primary readout** (the number you're acting on): full glow, 38px, drop-shadow blur 5–6px.
- **Secondary readout** (timer, sub-values): medium glow, white, 16px.
- **Label print** (WEIGHT/REPS): NOT glowing — these are screen-printed onto the bezel in flat white, 10.5px mono. Labels are paint; values are light.

### Display contrast
- Well: `#050607` (near-black).
- Character: full-saturation yellow with glow.
- This is maximum contrast by design — readable at arm's length in a bright gym.

### Inset display construction
- Deep inset shadow (the well, §2 `MAT-LCD`).
- Optional scanline overlay + side vignette for CRT/LCD authenticity.
- A 1px faint top-inner highlight where the glass meets the bezel.

### Behavior
- **Value change:** brief flicker or odometer-roll, never a soft cross-fade (LCDs switch, they don't dissolve).
- **Active vs idle:** an active display glows full; an idle/disabled one dims toward `#1a1814` character with no glow (powered down).

---

## 6. Control System

### The locked button standard (`CLAUDE.md §14` — never violate)
Every button is **matte black with angled rim-light**:
```css
background: linear-gradient(145deg, #4a4a4e 0%, #38383c 35%, #28282c 100%);
border: 1px solid #111113;
box-shadow:
  inset 1.5px 1.5px 0 rgba(255,255,255,0.20),   /* top-left rim catch */
  inset 0 1px 0 rgba(255,255,255,0.12),           /* top ambient */
  inset -1px -1.5px 0 rgba(0,0,0,0.65),           /* bottom-right shadow */
  inset 0 -2px 5px rgba(0,0,0,0.45),              /* base shadow */
  3px 8px 16px rgba(0,0,0,0.85),                  /* angled drop */
  1px 3px 6px rgba(0,0,0,0.65);
```
- Idle text/icon: `rgba(245,245,240,0.65)`.
- Radius: nav pads 3px, toolbar buttons 5px.
- **NEVER** flat black (`#141618`), **NEVER** a plastic/SaaS gradient, **NEVER** a solid fill. Always ask before altering a button treatment.

### Tactile press states
- **On press:** `transform: translateY(1px)` + the drop shadow collapses to an inset press shadow + text ignites yellow with glow. The button physically sinks into the panel.
  ```css
  :active {
    transform: translateY(1px);
    color: var(--yellow);
    text-shadow: 0 0 8px var(--yellow), 0 0 18px rgba(245,236,0,0.5);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.04),
      inset 0 2px 3px rgba(0,0,0,0.5),
      0 1px 0 -1px #050607;   /* drop shadow nearly gone — button is down */
  }
  ```
- Press travel must be **visible and weighted** — the button moves, the shadow responds, the light shifts. A button that only changes color on tap is a flat-app tell.

### Control density
Controls cluster like a real faceplate — a row of pads, a pair of dials, a fader bank. Dense, gridded, each control framed by its housing. Not spaced-out floating taps.

### Switch behavior (toggles)
Toggles are **physical switches/rockers**, not iOS pill-toggles. A lever that throws, a rocker that tilts, a button that latches (stays depressed + glowing while engaged — like the cassette OPEN button's `is-open` persistent glow). State is shown by physical position + illumination, never by a sliding pill.

### Dial behavior
Dials are **knurled rotary controls** (`MAT-METAL` cap + `MAT-CHROME` center + ribbed grip edge). They rotate with implied friction. The cassette reels are the reference: a hub, spokes, a center spindle, a position marker. Rotation is mechanical (linear or eased-with-inertia), never bouncy.

### Navigation behavior
The bottom nav is a **chassis of mounted pads** (the MPC template): matte housing, pin rows flanking each pad, LED dot per pad, model nameplate. Active pad = red LED glow + red icon + pulse. Tabs are physical buttons on a control surface, not text links.

---

## 7. Motion Language

### Core principle: weighted mechanical motion
Nothing in INCYTE eases like software. Everything moves like it has **mass and friction**. A button has travel. A panel slides on rails. A reel spins with rotational inertia. Motion simulates physics, not CSS defaults.

### Mechanical movement vocabulary
- **Press travel:** 0.08s, `ease-out` — fast, decisive, like a real key bottoming out.
- **Panel slide (fader/drawer open):** 0.45s, `cubic-bezier(0.4, 0, 0.2, 1)` — slides on a track, decelerates as it seats.
- **Reel spin:** 2s `linear` infinite — the ONE place linear is correct (constant rotational speed). Reels spin while "tape plays" (rest active).
- **Switch throw:** 0.18s, `cubic-bezier(0.4, 0, 0.2, 1)` — snaps to position.

### Inertial movement
Dials and faders dragged by the user should carry a hint of momentum on release where appropriate — they don't stop dead, they settle. (Subtle; never a long coast.)

### Industrial timing
- Interactive feedback: 80–150ms (a real control responds *instantly*).
- Mechanical transitions (panels, drawers): 300–450ms (parts have travel distance).
- Illumination changes (glow on/off): 150ms.
- **Forbidden:** anything > 500ms on UI; `linear` on anything except continuous rotation; spring/bounce overshoot (machines don't bounce).

### Weighted transitions
Screen-to-screen and state changes should feel like a machine reconfiguring, not a slide deck advancing. Prefer: a panel sliding into its track, a display reflashing, an indicator illuminating — over generic fade/slide page transitions.

### Tactile animations (the feedback loop)
Every action gets a **mechanical acknowledgment**: button sinks + glows, LED lights, display reflashes, reel starts. The machine *responds physically*. Pair with haptics (medium tap on log, double-tap on timer complete) so the digital control feels like it has real travel.

### Idle animations
- LED pulse (1.2s) on active indicators — the machine is "powered and waiting."
- AI status LED blink (1.5s) — armed-and-listening.
- VU meter resting at a level — the machine is monitoring.
- **No idle motion on inert surfaces** — chassis, panels, labels are dead still. Only powered components animate at idle.

---

## 8. Color System

INCYTE runs **two coordinated palettes**: the brand palette (app-wide identity) and the hardware palette (the industrial console layer). They coexist — brand colors govern data/accents; hardware colors govern the physical chrome.

### Brand palette (locked — `CLAUDE.md §4`)
| Token | Value | Role |
|---|---|---|
| `--accent` | `#5d9bb8` | steel blue — primary brand |
| `--accent-2` | `#7fa5c7` | icy lavender-blue |
| `--accent-3` | `#9eb5cb` | misty silver-blue |
| `--ok` | `#4f9aa8` | cool teal — success/working |
| `--warn` | `#8e9bb0` | slate |
| `--bad` | `#b08092` | desaturated mauve — warmup/destructive |
| brand gradient | steel→lavender→soft-pink @ 155° | the locked signature wash |

### Hardware palette (the console layer)
| Token | Value | Role |
|---|---|---|
| `--chassis` | `#161618` | matte black structural body |
| `--chamber` | `#0e1012`–`#14171a` | recessed well |
| `--lcd-well` | `#050607` | display cavity (deepest) |
| `--metal-hi` | `#3a3f44` | lit metal edge |
| `--metal-lo` | `#1a1d20` | shadowed metal belly |
| `--btn-face` | `#38383c` | button face |

### Illumination colors (powered states)
| Token | Value | Meaning |
|---|---|---|
| `--yellow` | `#f5ec00` | **primary active** — LCD readouts, engaged controls, the signature glow |
| `--yellow-glow` | `rgba(245,236,0,0.5)` | the glow halo |
| `--green-led` | `#4ecb71` | status OK / armed (AI assist) |
| `--red-active` | `#FF3D3D` | active nav pad / alert / critical |

### Warning colors
- Caution: `--yellow` at higher intensity (the same active color pushed brighter).
- Critical/destructive: `--red-active #FF3D3D` (LED red) or brand `--bad #b08092` for soft-destructive (warmup, remove).

### Metallic tones (the grayscale ladder of metal)
```
#c0c5ca  chrome highlight (rivet top)
#4a5055  lit metal top edge
#3a3f44  metal mid-light
#28282c  metal mid
#1a1d20  metal shadow
#0e1012  metal deep shadow / chamber
#050607  LCD well (deepest)
```
This ladder is how metal is shaded. A metal surface samples from it top-to-bottom per the light source.

### Cinematic contrast rules
- The console layer lives in the dark end (`#050607`–`#3a3f44`). Illumination lives at the bright end (yellow/green/red glows + chrome highlights + white rim-lights).
- **Forbidden mid-gray flatlands.** No large `#808080`-ish areas. Every surface is either dark structural material or a lit edge — the contrast between them is the cinematography.
- Brand accent colors (steel-blue family) are used for **data and content** (charts, progress, body-part coding) — they are the "information color." Hardware yellows/greens/reds are the "machine status color." Don't mix roles: data isn't yellow, machine status isn't steel-blue.

---

## 9. Proportion & Spacing Rules

### Compressed hardware density
INCYTE rejects mobile-app generosity. Like a real faceplate, panel space is precious — components pack tightly with engineered tolerances, not breathing room.
- **Component-to-component gap:** 6–10px (tooling clearance).
- **Chamber bezel (internal panel padding):** 14px.
- **Chassis frame lip:** 4–7px.
- **Seam between abutting metal:** 1px dark border.

### Tactical spacing
Spacing is *functional separation*, not aesthetic rhythm. A gap exists because two parts are different components, not because the layout wanted air. Ask "is this a manufacturing seam?" — if not, the gap shouldn't be there.

### Industrial proportions
- Modules are sized by **function and information density**, producing functional asymmetry: a narrow I/O column (40–50px) beside a wide display (rest of width); a tall fader bank beside a compact readout.
- Buttons in a row are **identical** (same mold). Modules differ (different functions).

### Visual weight distribution
- **Heavy at the base:** the chassis and primary controls sit low and dark, anchoring the screen. The bottom nav is a substantial chassis. Lighter elements (labels, LEDs) sit on top.
- **The primary action is the heaviest control** — biggest, brightest-on-press, most reachable.

### Hierarchy rules
1. **Illumination = importance.** The thing glowing brightest is the thing you act on (the primary LCD readout, the LOG button on press).
2. **Recession = data, elevation = action.** Displays sink in (you read them); buttons rise up (you press them).
3. **Size tracks function** — the number you're logging is 38px; its label is 10.5px; the spec print is 6px. Three orders of magnitude, by function.
4. **Center-stage the current task** — one primary readout dominates; everything else is peripheral instrumentation.

### Radius scale (manufacturing tolerances)
```
50%   chrome hardware (rivets, dial caps)
3px   nav pads, buttons (tight machined corners)
4px   LCD wells, small displays
5px   toolbar buttons
8px   recessed chambers
10px  glossy plastic windows
12px  outer chassis panels
```
Radii are **small and machined** — real equipment has tight corners. Large pill/rounded-card radii (16–24px) are a mobile-app tell and are forbidden on hardware components. (The only large radii allowed are on genuinely "soft" overlays like bottom sheets, which are explicitly a different surface class.)

---

## 10. Visual Restrictions (forbidden)

### The app must NEVER look like:
- A **fintech app** (Revolut, Cash App) — flat cards, generous whitespace, friendly gradients, rounded everything.
- A **SaaS dashboard** (Linear, Notion, Stripe) — clean flat panels, subtle shadows, sans-serif neutrality.
- A **minimalist mobile app** — airy layouts, single accent color, hairline everything, lots of white/empty space.
- A **flat cyberpunk interface** — neon-on-black with no material depth, glowing outlines drawn on flat shapes, "Tron lines."
- A **generic neon fitness app** — orange/lime energy gradients, motivational confetti, hype typography.

### Forbidden UI patterns
- **Flat cards floating on a background** — every "card" must be a panel mounted on a chassis with bevels + shadows + (where structural) rivets.
- **Single-layer shadows** (`box-shadow: 0 2px 4px`) on physical components — shadows are always stacked (§3).
- **Material Design elevation** — no Google-style soft uniform shadows. Our shadows are directional, hard, light-source-aware.
- **iOS pill toggles** — toggles are physical switches/rockers/latching buttons.
- **Bouncy/spring animation** — machines don't overshoot. No `cubic-bezier` with overshoot, no spring physics on UI.
- **Soft cross-fades on displays** — LCDs switch/flicker, they don't dissolve.
- **Decorative glow / ambient neon wash** — glow only ever means "powered." No glow for vibe.
- **Gradient text, glassmorphism-for-style, frosted blur as the primary surface** — these are the previous (rejected) direction. Glass is a *material with a hard specular highlight*, not a blurry translucent card.

### Forbidden styling approaches
- Designing color before material. (Material first, always.)
- Light source inconsistency (a highlight on a bottom edge; a shadow pointing up-left).
- Flat fills on anything that should be metal, plastic, or glass.
- "It looks clean" as a justification — clean is a SaaS value. Our value is *manufactured*.

### Forbidden spacing behaviors
- Generous whitespace / "breathing room" as a layout strategy.
- Large rounded-card radii (16px+) on hardware components.
- Symmetric, evenly-padded grids of equal cards (that's a dashboard). Use functional asymmetry.
- Centered, floating, isolated elements with air all around (that's minimalism).

### Forbidden simplifications
- Removing bevels/rim-lights "for performance" or "for cleanliness" — the rim-light IS the identity.
- Replacing a recessed LCD with light-background dark-text (that's a form field, not a display).
- Flattening a button to a solid color with a color-change-on-tap (no physical travel).
- Dropping the model nameplates, spec print, rivets, pin rows "because they're not functional" — they are the tactical-realism layer; they are functional *to the identity*.
- Substituting generic icons for the inline-SVG hardware glyphs.

---

## Enforcement checklist (run on every screen before it ships)

- [ ] Can I name the **material** of every surface? (chassis / metal / plastic / LCD / chrome)
- [ ] Does **every** surface obey the upper-left light source?
- [ ] Are all shadows **stacked** (2+ layers on elevated components)?
- [ ] Does every button have **visible press travel** + ignition glow?
- [ ] Are displays **recessed wells with emitting characters** (not light boxes)?
- [ ] Is glow used **only for powered states**, never decoration?
- [ ] Is the layout **dense and functionally asymmetric** (not airy and gridded)?
- [ ] Are radii **small and machined** (no 16px+ on hardware)?
- [ ] Are there **rivets/nameplates/spec-print** anchoring the chassis realism?
- [ ] Would this look **manufactured in a factory**, or **designed in Figma**? (If Figma — rebuild.)

---

## Material recipe quick-reference (copy-paste source)

All recipes are extracted from the canonical prototype `public/workout-alt.html` and the locked standard `CLAUDE.md §14`. They are the manufacturable ground truth — implementation should reference these, not reinterpret them.

| Material | Where defined |
|---|---|
| Chassis frame | workout-alt.html — `.mpc-chassis` / BottomNav `.chassis` |
| Machined metal panel | workout-alt.html — `.cassette-panel` (CSS line ~525) |
| Brushed-aluminum stat panel | TodayPage.module.css — `.statPanel` |
| Glossy plastic window | workout-alt.html — `.cassette-svg-wrap` (line ~620) |
| Deep inset LCD | workout-alt.html — `.led-ticker-wrap` (line ~397) |
| Chrome rivet | workout-alt.html — `.cassette-panel > .panel-rivet` (line ~539) |
| Phillips screw | TodayPage.module.css — `.panelRivet` |
| Locked button | CLAUDE.md §14 + workout-alt.html `.nav-btn` / `.cassette-log-btn` |
| LED indicators | workout-alt.html — `.active-dot`, `.ai-led` |
| LCD numerals | workout-alt.html — `#weightReadout` SVG text |

---

_Compiled 2026-05-23. This is the visual source of truth. All future implementation defers to this document. Conflicts resolve in favor of the bible. The mandate is singular: **render a believable physical machine, not an app.**_
