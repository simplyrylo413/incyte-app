// INCYTE design tokens — Phase 1 of the Next.js port.
// Every value here mirrors the `:root` block in src/fitlog-mobile.html (lines 20–115).
// If the HTML build's tokens change, update both files in the same commit.
//
// Usage: reference these as Tailwind utilities in JSX:
//   text-ink, bg-paper, text-accent, font-display, text-eyebrow, font-mono, etc.

import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // ─── Color palette ────────────────────────────────────────────────────
      // Matches --ink, --ink-2, --muted, --label, --paper*, --accent* in :root
      colors: {
        // Primary text + border
        ink: "#0f1622",
        "ink-2": "#2c3548",

        // Secondary + faint text
        muted: "#5e6a82",
        label: "#8893a8",

        // Surface tiers (light, app-bg, cards)
        paper: "#ffffff",
        "paper-2": "#f4f5f7",
        "paper-3": "#eceef2",

        // Brand accent family — steel blue / icy lavender / misty silver
        accent: "#5d9bb8",
        "accent-2": "#7fa5c7",
        "accent-3": "#9eb5cb",

        // Semantic
        ok: "#4f9aa8",   // cool teal — success / working-set badge
        warn: "#8e9bb0", // slate
        bad: "#b08092",  // desaturated mauve — warmup / destructive

        // Hairlines (borders + separators)
        hairline: "rgba(15,22,34,0.25)",
        "hairline-soft": "rgba(15,22,34,0.11)",
        "hairline-strong": "rgba(15,22,34,0.20)",

        // Gradient component stops (for bg-gradient-* utilities)
        // The locked brand gradient: linear-gradient(155deg, stop-a 0%, stop-b 55%, stop-c 100%)
        // Alpha values vary per surface — use CSS variables in component modules.
        "grad-a": "rgb(93,155,184)",   // steel blue
        "grad-b": "rgb(155,130,200)",  // lavender
        "grad-c": "rgb(201,160,190)",  // soft pink
      },

      // ─── Typography ────────────────────────────────────────────────────────
      // Matches --font-display, --font-text, --font-mono in :root
      fontFamily: {
        display: [
          "DM Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        sans: [
          "DM Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },

      // ─── Type scale ────────────────────────────────────────────────────────
      // Matches --text-eyebrow through --text-display in :root.
      // Format: [fontSize, { lineHeight, letterSpacing, fontWeight }]
      fontSize: {
        // 12px mono-caps — dominant micro-text (equipment pills, eyebrow headers)
        eyebrow: ["12px", { lineHeight: "1.2", letterSpacing: "1.5px", fontWeight: "700" }],
        // Utility sizes
        "2xs": ["11px", { lineHeight: "1.3" }],
        xs:    ["12px", { lineHeight: "1.35" }],
        sm:    ["13px", { lineHeight: "1.45" }],  // --text-base
        base:  ["14px", { lineHeight: "1.4" }],   // --text-md  (movement name)
        md:    ["14px", { lineHeight: "1.4" }],
        lg:    ["15px", { lineHeight: "1.35" }],
        xl:    ["18px", { lineHeight: "1.25" }],
        "2xl": ["22px", { lineHeight: "1.15" }],
        "3xl": ["28px", { lineHeight: "1.1" }],
        display: ["34px", { lineHeight: "1.05", letterSpacing: "-0.018em" }],
      },

      // ─── Font weight ladder ─────────────────────────────────────────────────
      // Matches --weight-normal through --weight-heavy in :root
      fontWeight: {
        normal:    "400",
        medium:    "500",
        semibold:  "600",
        bold:      "700",
        heavy:     "800",
      },

      // ─── Letter spacing ────────────────────────────────────────────────────
      letterSpacing: {
        tight:   "-0.018em",  // --track-tight  (display numerics)
        normal:  "-0.005em",  // --track-normal (body)
        eyebrow: "1.5px",     // --track-eyebrow (mono-caps labels)
      },

      // ─── Line height ───────────────────────────────────────────────────────
      lineHeight: {
        tight:  "1.1",
        snug:   "1.25",
        normal: "1.45",
      },

      // ─── Border radius scale ───────────────────────────────────────────────
      borderRadius: {
        pill:  "999px",  // tags, badges, progress chips
        chip:  "6px",    // small buttons, count chips
        btn:   "10px",   // standard button
        card:  "14px",   // list row cards
        hero:  "22px",   // glass hero cards
        modal: "24px",   // bottom sheets
      },

      // ─── Border width ──────────────────────────────────────────────────────
      borderWidth: {
        DEFAULT: "1.2px",  // INCYTE spec: all separators are 1.2px, never 1px
        "0":     "0px",
        "2":     "2px",
      },

      // ─── Box shadows (elevation tiers) ─────────────────────────────────────
      // Matches --depth-1/2/3 in :root. Glass card shadows are in CSS modules.
      boxShadow: {
        "depth-1": "0 1px 3px rgba(15,22,34,0.07), 0 1px 2px rgba(15,22,34,0.05)",
        "depth-2": "0 4px 12px rgba(15,22,34,0.10), 0 2px 4px rgba(15,22,34,0.06)",
        "depth-3": "0 8px 24px rgba(15,22,34,0.14), 0 3px 8px rgba(15,22,34,0.08)",
        // Hero glass card shadow (matches .hero-card in HTML build)
        hero: "0 8px 32px rgba(93,155,184,0.18), 0 2px 8px rgba(15,22,34,0.10)",
        // Back chip shadow (matches .back-chip)
        chip: "0 2px 10px rgba(93,155,184,0.28), 0 1px 3px rgba(15,22,34,0.12)",
      },

      // ─── Backdrop blur ──────────────────────────────────────────────────────
      backdropBlur: {
        glass: "20px",       // standard glass surface
        "glass-light": "12px",
        "glass-heavy": "28px",
      },

      // ─── Animation ─────────────────────────────────────────────────────────
      transitionTimingFunction: {
        "out-cubic":  "cubic-bezier(0.33, 1, 0.68, 1)",   // --ease-out-cubic
        "premium":    "cubic-bezier(0.22, 1, 0.36, 1)",   // --ease-premium
        "spring":     "cubic-bezier(0.34, 1.56, 0.64, 1)", // --ease-spring
      },

      transitionDuration: {
        "fast":   "150ms",
        "normal": "220ms",
        "slow":   "300ms",
      },
    },
  },

  plugins: [
    // ─── bg-incyte-gradient utility ─────────────────────────────────────────
    // Adds `bg-incyte-gradient` for the locked brand gradient at standard alphas.
    // For surface-specific alpha variants, use CSS modules with the raw gradient.
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".bg-incyte-gradient": {
          background:
            "linear-gradient(155deg, rgba(93,155,184,0.18) 0%, rgba(155,130,200,0.13) 55%, rgba(201,160,190,0.10) 100%)",
        },
        ".bg-incyte-gradient-mid": {
          background:
            "linear-gradient(155deg, rgba(93,155,184,0.24) 0%, rgba(155,130,200,0.17) 55%, rgba(201,160,190,0.12) 100%)",
        },
        ".bg-incyte-gradient-strong": {
          background:
            "linear-gradient(155deg, rgba(93,155,184,0.32) 0%, rgba(155,130,200,0.22) 55%, rgba(201,160,190,0.16) 100%)",
        },
        // Glass sheen overlay (::after pseudo-element equivalent as a utility)
        ".glass-sheen": {
          position: "relative",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: "0",
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            borderRadius: "inherit",
          },
        },
      });
    }),
  ],
};

export default config;
