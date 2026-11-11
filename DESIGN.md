---
name: AndryOre Site
description: Static, bilingual personal site with a cool blue-grey neutral ground, one
  indigo accent and a light and dark theme.
colors:
  background: "oklch(0.963 0.005 258.3)"
  foreground: "oklch(0.212 0.013 258.4)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.549 0.249 264)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.93 0.009 258.3)"
  muted-foreground: "oklch(0.446 0.026 256.8)"
  destructive: "oklch(0.539 0.194 26.7)"
  success: "oklch(0.492 0.109 157)"
  border: "oklch(0.883 0.013 255.5)"
  ring: "oklch(0.549 0.249 264)"
  background-dark: "oklch(0.176 0.014 258.4)"
  foreground-dark: "oklch(0.942 0.009 258.3)"
  card-dark: "oklch(0.22 0.018 255.7)"
  primary-dark: "oklch(0.661 0.179 265.2)"
  primary-foreground-dark: "oklch(0.176 0.014 258.4)"
  secondary-dark: "oklch(0.254 0.022 257.3)"
  muted-foreground-dark: "oklch(0.715 0.023 256.8)"
  destructive-dark: "oklch(0.712 0.181 22.8)"
  success-dark: "oklch(0.779 0.165 157.3)"
  border-dark: "oklch(0.314 0.023 256.4)"
  ring-dark: "oklch(0.661 0.179 265.2)"
typography:
  body:
    fontFamily: "'Space Grotesk Variable', 'Space Grotesk', sans-serif"
  mono:
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace"
rounded:
  base: "0.25rem"
  card: "1rem"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.base}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
---

# Design System: AndryOre Site

The tokens above mirror [`docs/brand/tokens.css`](docs/brand/tokens.css), the
single source of truth for the Site's palette, radii, easing, durations and
typefaces. Do not redefine them here or in a component: change the file, then
this one. The `-dark` colors are the `.dark` set; every other color is the
`:root` (light) set. Brand assets and Site content changes need the owner's
approval ([ADR 0007](docs/adr/0007-split-license.md)).

## Overview

A static, bilingual personal Site that presents Andry Orellana's work and its
product pages. The theme mode follows the system and honors the visitor's choice
of system, light or dark. The page is calm and typographic: a cool neutral
ground, one indigo accent, flat surfaces and almost no decoration. Interactivity
is the exception, never the default (ADR 0006).

## Colors

- **Neutral ground.** A blue-grey tinted neutral (hue about 258) carries both
  themes. `background` is the page, `card` and `popover` sit one tonal step
  apart, `secondary`, `muted` and `accent` share one subtle fill.
- **One accent.** `primary` (indigo, hue 264) does every accent job: links,
  primary buttons, the focus ring. Its dark counterpart is lighter and less
  saturated so it keeps contrast on the dark ground.
- **Status.** `destructive` is a red and `success` a green, used only for state,
  never decoration.
- **Dark theme.** A tonal inversion of the same hues, not a separate palette.
- **Contrast is tested.** `docs/brand/tokens-contrast.test.ts` asserts text
  pairs at 4.5:1 and UI and focus pairs at 3:1 in both themes. A token change
  that breaks it is a brand change and needs the owner.

## Typography

Space Grotesk for text and headings, JetBrains Mono for code, file names and
small labels. Both are self-hosted (ADR 0009); never load a hosted font. Every
page exists in English and Spanish, so no heading or control may rely on a fixed
width.

## Layout

Single centered column of readable measure, generous vertical rhythm, one
content idea per section. Pages are static Astro; the layout works from phone
width up without horizontal scroll.

## Elevation & Depth

Flat and tonal. Depth is a `card` one step off the `background` plus a 1px
`border` hairline. No drop shadows and no gradients in UI chrome.

## Shapes

`--radius` (0.25rem) for controls, `--radius-card` (1rem) for cards and panels,
`--radius-pill` for chips and badges. Do not mix in other radii.

## Components

- **Primary button:** flat `primary` fill, `primary-foreground` label, base
  radius.
- **Card:** `card` fill, `border` hairline, card radius, `card-foreground` text.
- **Focus:** every interactive element shows a solid `ring` outline at 3:1
  against its background; never a translucent ring.

## Motion

Use `--ease-out` with `--duration-fast` (160ms) for state changes,
`--duration-base` (320ms) for entrances and `--duration-slow` (560ms) for large
transitions. Animate `transform` and `opacity` only, and honor
`prefers-reduced-motion`: the static end state is always complete.

## Do's and Don'ts

- Do keep one accent per view and use `muted-foreground` for supporting text
  only, never for primary claims.
- Do keep all user-facing copy in content files, in both languages (ADR 0002).
- Don't load anything from another origin: no CDNs, hosted fonts, analytics or
  embeds (ADR 0009).
- Don't add inline scripts without their hash in the CSP (ADR 0010).
- Don't use gradient text, side-stripe borders, drop shadows or a second accent.
- Don't invent colors: add a token to `docs/brand/tokens.css` with the owner's
  approval, then reference it.
