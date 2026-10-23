# Design — Lao Gan Ma

<!-- impeccable:design-schema 1 -->

An **app screen**, not a page: a chat you work in. Built to the tasteskill app
sheet **framed-sheet** (`--app --kind devtools`, seed `2075178212`), light.

**The screen's one question:** what is the plan for my idea, and which skills
were trusted to build it?

## Platform

web (React 18 + Vite + TypeScript + Tailwind). Fonts self-hosted.

## The style's move

One tinted L-frame holds the 228px sidebar and the 48px top bar with no rule
between them. The work sits on a **white sheet** inset 8px from the window's
right and bottom edges, 16px radius, 1px edge, **no shadow**. The active tab is
a 2px underline; everything else in the chrome is grey.

## Colour

**Budget: under 3%.** Colour goes on data, status and the one primary action,
never on chrome.

- `--ground #f9fbfc` frame · `--surface #ffffff` sheet · `--raised #f4f6f8`
- `--border #e8eaec` panel edges · `--rule #f0f1f2` row rules
- `--text #131416` · `--muted #5d5f60` · `--faint #6b6b6b`
- `--primary #1d1f20` — the primary button is near-black
- **`--accent #b32b1f`** — the face: the brand's chili hue stands in for the
  sheet's dealt teal. 5.9:1 on white. It appears on the product mark, the 2px
  active underline, focus rings and the one Finalise action.
- Status: `--positive #1e7b4f` · `--negative #c4242a` · `--warning #92400e`,
  each with a pill pair.

Dark is an explicit opt-in, not inherited from the OS, because the dealt style
is a light one. Dark uses one true-neutral ground with elevation by lightness.

## Type

**IBM Plex Sans** 400/500/600, self-hosted. Sizes: title 22 · section 16 ·
body 14 · small 12. **IBM Plex Mono** is the second face, for IDs and keys only
(the skill source on a scan row). `tabular-nums` on every figure.

## The two signature elements

1. **Mala**, the mascot and product mark: a chili character in flat vector
   (no gradients), with moods that report real agent state — idle, thinking,
   scanning, happy, concerned. Large on the first screen, 28px as a chat avatar.
2. **The verification scan**: the live trust-boundary trace, one skill at a
   time, each with its four checks. Every verdict carries **its own mark as well
   as its own colour** (check / alert / cross), so blocked reads apart from
   withheld without relying on hue.

Plus **the pull-down screen**: the finished prompt and skills.md arrive on a
projector screen that unrolls from its housing. A sheet opening is sanctioned
motion and it reports a real state change.

## Motion

App screens have no motion floor: motion here is **feedback, not performance**,
and nothing performs an entrance. What moves: press/hover/focus on controls, a
row arriving (scan results, new turns), a sheet opening (the pull-down screen),
Mala's state, and a beam while a scan is running. All neutralised under
`prefers-reduced-motion`.

## The first screen

Before anything is said, the screen carries its content rather than a void: Mala
at full size, the three real outputs (phased plan, one-shot prompt, skills.md),
and three example projects that are one click from the main job. It centres with
auto margins, so it never clips when the viewport is short.

## Accessibility

One `h1` per screen. Sidebar folds behind a menu button under `md` and the
composer stays pinned at every width. Every control labelled; `aria-current` on
nav, `role="switch"` on the security toggle, `role="alertdialog"` on confirms.
Accent focus ring throughout, `data-ring` opts out where a component paints its
own. Errors are humanised with a recovery path, never raw exceptions.

## Verified

`lint.mjs --app`: 0 FAIL. `inspect.mjs --app` at 1440/768/390: **0 FAIL, 0 WARN**.
impeccable `detect`: clean. Screenshots in `.taste-skill/inspect/`.

## Provenance

No raster assets. Mala, the icon set and every surface are authored SVG and CSS.
The only binaries are the self-hosted IBM Plex woff2 files (OFL).
