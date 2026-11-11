# Accessibility

The goal is for every page of andryore.dev to meet
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, in English and Spanish, in
the light and dark themes.

## What enforces it

The Playwright suite in [`e2e/`](e2e) runs on the built Site:

- [`accessibility.spec.ts`](e2e/accessibility.spec.ts) runs axe-core with the
  `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`
  tags on every page, in both languages and both themes, and fails on any
  violation.
- [`focus-ring.spec.ts`](e2e/focus-ring.spec.ts) checks that the focus ring has
  3:1 contrast.
- [`reduced-motion.spec.ts`](e2e/reduced-motion.spec.ts) checks that no
  animation or transition runs when the visitor prefers reduced motion.

How to run the checks is in [Development](docs/development.md#browser-checks).

## Known barriers

Axe catches only part of the possible barriers. The suite has no screen reader
or keyboard-only walkthrough, and no manual audit is on record. No barrier is
currently known.

## Report a barrier

Open an issue with the
[bug report template](https://github.com/andryorelabs/andryore-web/issues/new/choose),
naming the page, the browser and any assistive technology you use. For other
questions, see [`.github/SUPPORT.md`](.github/SUPPORT.md).
