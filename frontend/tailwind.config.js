/** @type {import('tailwindcss').Config}
 *  Tokens come from the tasteskill app sheet: framed-sheet, seed 2075178212.
 *  Every colour is a CSS variable so the dark theme swaps in one place.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        active: "var(--active)",
        edge: "var(--border)",
        rule: "var(--rule)",
        control: "var(--control)",
        ink: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-quiet": "var(--accent-quiet)",
        primary: "var(--primary)",
        "primary-ink": "var(--primary-ink)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
        "pill-pos-bg": "var(--pill-positive-bg)",
        "pill-pos-ink": "var(--pill-positive-ink)",
        "pill-neg-bg": "var(--pill-negative-bg)",
        "pill-neg-ink": "var(--pill-negative-ink)",
        "pill-warn-bg": "var(--pill-warning-bg)",
        "pill-warn-ink": "var(--pill-warning-ink)",
        "pill-neutral-bg": "var(--pill-neutral-bg)",
        "pill-neutral-ink": "var(--pill-neutral-ink)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        title: ["22px", { lineHeight: "28px" }],
        section: ["16px", { lineHeight: "22px" }],
        kpi: ["28px", { lineHeight: "34px" }],
        body: ["14px", { lineHeight: "20px" }],
        small: ["12px", { lineHeight: "16px" }],
      },
      borderRadius: {
        card: "8px",
        control: "6px",
        sheet: "16px",
      },
      spacing: {
        sidebar: "228px",
        sheet: "8px",
      },
      height: {
        row: "48px",
        control: "32px",
        topbar: "48px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        /* A sheet opening — the pull-down screen. Sanctioned motion. */
        "screen-roll": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
        /* A row arriving — scan results and new turns. Sanctioned motion. */
        "row-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        /* The mascot: the product's face, reporting agent state. */
        "mala-breathe": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2.5px)" },
        },
        "mala-think": {
          "0%,100%": { transform: "rotate(-2.5deg)" },
          "50%": { transform: "rotate(2.5deg)" },
        },
        "mala-cheer": {
          "0%,100%": { transform: "translateY(0) scale(1,1)" },
          "35%": { transform: "translateY(-7px) scale(0.97,1.04)" },
          "70%": { transform: "translateY(0) scale(1.03,0.97)" },
        },
        "mala-scan": {
          "0%,100%": { transform: "translateX(-2.5px)" },
          "50%": { transform: "translateX(2.5px)" },
        },
        "mala-blink": {
          "0%,93%,100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.08)" },
        },
        "dot-step": {
          "0%,100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        /* The scan beam: shows work in progress on a running process. */
        "beam": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(900%)" },
        },
      },
      animation: {
        "screen-roll": "screen-roll 420ms cubic-bezier(0.22,1,0.36,1) both",
        "row-in": "row-in 180ms cubic-bezier(0.22,1,0.36,1) both",
        "mala-breathe": "mala-breathe 3.4s ease-in-out infinite",
        "mala-think": "mala-think 1.5s ease-in-out infinite",
        "mala-cheer": "mala-cheer 850ms cubic-bezier(0.22,1,0.36,1)",
        "mala-scan": "mala-scan 1.3s ease-in-out infinite",
        "mala-blink": "mala-blink 5s ease-in-out infinite",
        "dot-step": "dot-step 1s ease-in-out infinite",
        beam: "beam 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
