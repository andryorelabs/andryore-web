# 0023: Oxc toolchain and TypeScript 7.1

## Status

Accepted

Date: 2026-11-01

Revised: 2026-11-11, Oxfmt runs on its defaults: the style keys (`printWidth`,
`semi`, `singleQuote`, `trailingComma`, `tabWidth`, `arrowParens`, `endOfLine`,
`proseWrap`) are removed from `.oxfmtrc.json`.

Revised: 2026-11-02, removed the four `unicorn` formatting overrides that
replaced `eslint-config-prettier` for `.astro` files, and moved
`.prettierignore` into the Oxfmt `ignorePatterns`.

Revised: 2026-11-02, the parity gaps are closed by checked equivalences, so
`parity/accepted.json` is empty. The four design-choice rules are on in both
engines: `unicorn/single-line-block-comment-style`,
`unicorn/consistent-boolean-name`, `unicorn/no-null` and
`unicorn/name-replacements`. The name allow list keeps only `props`, `Props`,
`ref` and `Ref`, which the Astro and React component contracts and the
`@eslint-react` `useRef` naming rule require. `unicorn/no-null` is off for
`**/*.{test,spec}.{ts,tsx,mjs}` and `e2e/**`, because tests assert against DOM,
Web Storage, `JSON.parse` and Playwright results that return `null`, and pass
raw `null` input on purpose. `no-asterisk-prefix-in-documentation-comments`
stays off.

## Context

Linting, formatting and type-checking took about 60 seconds on a cold run:
ESLint 36 s, Prettier 7 s, `tsc` 5 s and `astro check` 11 to 15 s. Every agent
run and every CI run waited on them. Streamboss already moved to the Oxc
toolchain, and Andry wants the same speed here without losing or loosening a
single rule the repository enforces. The one hard limit is Astro: Oxlint
jsPlugins cannot see the template of an `.astro` file
([oxc#23207](https://github.com/oxc-project/oxc/issues/23207)).

## Decision

- **Oxfmt replaces Prettier everywhere**, `.astro` included (`"astro": true`
  with `@astrojs/compiler-rs`). Its config reproduces the old Prettier options,
  the import order (astro, built-ins, third-party, `@/`, relative) and Tailwind
  class sorting. Sorting classes in `.astro` files is a new, accepted change.
  The one reformat commit is listed in `.git-blame-ignore-revs`.
- **Oxlint replaces ESLint for every file except `.astro`.** It runs
  `--type-aware` (tsgolint) and loads the rule families ESLint enforced through
  native rules or jsPlugins, with the same options and severity: typescript-
  eslint strict and stylistic, jsx-a11y, unicorn, jsdoc, `@eslint-react`, the
  `@shadcn/lint` rules, the local rules and the eslint-comments rules. A rule is
  never turned off, downgraded or narrowed to make Oxlint pass: the code is
  fixed, or a diverging native port is swapped for the original ESLint-engine
  rule through a jsPlugin. `oxlint.config.ts` is the config and imports the
  single-source policy exports.
- **ESLint stays for `**/*.astro` only**, with the rules it applied to those
  files before: astro recommended, jsx-a11y, unicorn,
  `local/no-non-doc-comments` and eslint-comments. Oxlint ignores `.astro`, and
  ESLint lints nothing else. **Exit condition**: when oxc#23207 lets jsPlugins
  see the Astro template, `.astro` moves to Oxlint and ESLint is removed.
  `eslint.config.mjs` documents this in a TSDoc block.
- **`bun run lint` runs both** (`oxlint --type-aware --deny-warnings` and then
  ESLint on `**/*.astro`) and fails if either does. Oxlint reports unused
  disable directives as errors.
- **TypeScript 7.1 type-checks, `typescript` stays 6.x.** `typescript` is the
  real 6.x package, because tools that use the JS API still need it. The
  `typescript7` alias (`npm:typescript@7.1.0-beta`, exact) provides the native
  compiler, and the scripts call `node_modules/typescript7/bin/tsc` by path. A
  test asserts that bin reports 7.1 and that `require('typescript')` is still
  6.x. Renovate pins both, never automerges them and cannot move `typescript`
  onto 7.
- **The content mapper replaces `astro check`.** `@astrojs/ts-content-mapper`
  (exact `0.2.0`, declared in the root `contentMappers` of `tsconfig.json`) lets
  `tsc` read `.astro` files. A probe on a scratch copy compared both tools on
  seven error classes: a frontmatter type error, a template expression, a bad
  `href` type, a wrong prop, an unknown prop, an unresolved `.astro` import and
  an unresolved TypeScript import. Both reported the same seven errors with the
  same codes and positions, so `astro check` and `@astrojs/check` were removed.
  `typecheck` runs `astro sync` first, because `astro check` used to, and
  without the generated `.astro/` types `astro:content` silently falls back to
  `any`.
- **A differential parity gate proves no rule was lost.** `bun run lint:parity`
  runs ESLint (the pre-switch config) and Oxlint over violation fixtures for
  every enforced rule and policy, over a pinned external TypeScript and React
  corpus that the script downloads, and over type-aware rules. It compares
  findings per `(file, line, rule)`. The gate is zero unexplained ESLint-only
  findings on non-`.astro` files. A gap that cannot be closed is reported and
  Andry decides; `parity/accepted.json` lists only gaps he accepted, each with a
  reason, and nothing is accepted automatically.
- **Policy rules survive one to one**: the un-awaited `.rejects` and `.resolves`
  selectors, the `shadcn/*` rules with their `no-restyle` contracts and the
  `src/components/ui/**` exemption, and `unicorn/filename-case` with its
  ignores. The eslint-comments rules become local replacements where the
  jsPlugin fails (oxc#23330). The rule tests in `eslint-rules/` were ported to
  run against Oxlint.

### Measured timings

Baseline, on a cold run before the change: ESLint 36 s, Prettier 7 s, `tsc` 5 s,
`astro check` 11 to 15 s.

Measured on a scratch copy while the spec was written: Oxlint type-aware 3.6 s,
ESLint on `.astro` only 7.3 s, Oxfmt 0.9 s, and `tsc` 7.1 with the mapper 0.7 s
(about 1.5 s more for `astro sync`). The final before and after numbers for
`lint`, `format`, `typecheck` and `bun run check` are recorded in the pull
request that switched the gate, not here, so they stay measured and not
estimated.

### Rejected alternatives

- **Keeping ESLint for everything and only swapping Prettier**: saves 6 s of 60
  and leaves the biggest cost, ESLint at 36 s.
- **Dropping `.astro` linting until Oxlint supports templates**: loses the astro
  recommended rules, jsx-a11y on templates and the comment policy on the files
  that hold most of the markup.
- **Running Oxlint's `@oxlint/migrate` output as the config**: it skips 205
  unicorn and 17 jsdoc rules and emits wrong plugin names and overrides. It was
  a hint only.
- **Aliasing `typescript` to 7.1**: breaks tools that use the TypeScript JS API,
  which 7.1 does not provide.
- **Keeping `astro check` next to `tsc`**: the probe found no error class it
  catches that `tsc` with the mapper misses, and it costs 11 to 15 s.

## Consequences

- A cold `bun run check` drops from about a minute to a few seconds. See the
  pull request for the numbers.
- Two linters run in CI and in lint-staged until oxc#23207 ships. Each rule
  lives in exactly one of them, chosen by file type.
- `typescript7` is a beta. Editor and tsserver behaviour on 7.1 is not covered
  by this decision.
- The Oxc packages, `typescript7` and the content mapper are exact-pinned and
  update through manual Renovate pull requests.
- The parity gate is a permanent tool. Run it again after any rule or Oxlint
  version change.
