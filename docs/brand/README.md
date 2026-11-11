# Brand kit

The public assets of the andryore.dev brand. The kit lives in this folder; see
[ADR 0001](../adr/0001-brand-kit-in-docs-brand.md). Rasters are generated only
by `bun run brand:export` and never edited by hand.

- [tokens.css](tokens.css): palette B7 and the two typefaces as shadcn-style
  variables, light and dark.
- [logo/](logo/): wordmark and "Ao" mark as outlined SVG, in color, dark, black,
  white and grid, plus PNG marks.
- [brandbook/fonts.css](brandbook/fonts.css) and
  [brandbook/fonts/](brandbook/fonts/): the Space Grotesk and JetBrains Mono
  font files and their [license](brandbook/fonts/OFL.md).
- [og/](og/): the Open Graph images, one per language (`og-en.png`,
  `og-es.png`). `brand:export` also writes the site favicons into `public/`.
- [avatar/](avatar/): the current memoji avatar.
- [tools/](tools/): the export script and its tests.

## Export

`bun run brand:export` reads `logo/` and `brandbook/fonts/` and writes the
platform banners and fallback avatars into `social/`, which is not tracked.

## Cross-repo brand rules

These rules hold for every repository and product site under the brand. The
invariant test in [`../standard-invariants.test.ts`](../standard-invariants.test.ts)
checks the ones that can be checked.

### Names

- `AndryOre` is the brand.
- `Andry Orellana` is the person.
- `andryorelabs` is the GitHub org.

### Credit line

Every README and product-site footer carries
`Built by [AndryOre](https://andryore.dev)`.

### Brand kit file set

A product's brand kit holds: a README with a dated decisions table, a brief,
voice, copy, an apply-spec, `tokens.css`, the logo, the og images and the
brandbook; a tested `brand:export` script; and a contrast test on the tokens.

### Palette and type

Each product keeps its own palette and type. The credit line is the only shared
brand element on a product site.

### Public lines of this repository

- Slogan: `The source of andryore.dev, the personal site of Andry Orellana.`
- Description: `The source of andryore.dev, the personal site of Andry Orellana.`

The README slogan, the `package.json` description and these two lines must stay
identical.

## License

See [ADR 0007](../adr/0007-split-license.md).
