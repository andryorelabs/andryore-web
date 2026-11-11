# AGENTS.md

Instructions for coding agents working in this repository.

## Layout

A single-package bun repository for the personal site
[andryore.dev](https://andryore.dev): a static Astro site, TypeScript (strict),
ESM-only. The root holds the tooling (husky, commitlint, oxfmt, oxlint, eslint,
knip) and the documentation:

- [`docs/adr`](docs/adr): architecture decision records.
- [`docs/brand`](docs/brand): the public brand assets and their export tooling.
- [`docs/agents`](docs/agents): the tracker and `/forge` specifics for agents.
- [`docs/configuration.md`](docs/configuration.md): every environment variable
  and the dotenvx workflow.
- [`eslint-rules`](eslint-rules): local lint rules, such as the TSDoc-only
  comment rule, which run in Oxlint and in ESLint.
- [`scripts`](scripts): repo scripts (commit lint, docs link check) and their
  tests.

The domain vocabulary is in [`GLOSSARY.md`](GLOSSARY.md). Skills live in
`.claude/skills` (25 of them, including `playwright-component-testing`,
`product-marketing` and `typescript-advanced-types`) and are pinned in
`skills-lock.json`. A map of the docs tree is in
[`docs/README.md`](docs/README.md).

[`DESIGN.md`](DESIGN.md) is the public design context that design skills read.
`PRODUCT.md` and `.agents/` are local-only and gitignored; they are built from
the private brand docs and must never be committed or quoted in public docs
([ADR 0008](docs/adr/0008-private-docs-stay-local.md)).

## Running scripts

Always use `bun run <script>` — never call the underlying tool directly, and
never use another package manager (this repo uses `bun.lock`). Read
`package.json`'s `scripts` before inventing a command.

- `bun run check` — format check, lint, typecheck and knip. Run this after any
  change. `typecheck` runs `astro sync` and then TypeScript 7.1 (`typescript7`)
  with the `@astrojs/ts-content-mapper`, so `.astro` files are type-checked too.
  `lint` runs Oxlint (type-aware) on everything but `.astro` and ESLint on
  `.astro` only ([ADR 0023](docs/adr/0023-oxc-toolchain-and-typescript-7-1.md)).
- `bun run test` — the `bun test` suite, with coverage on. `bunfig.toml` sets a
  `coverageThreshold` (lines 0.55, functions 0.4); a run below it fails, so add
  tests with new code instead of lowering the threshold.
- `bun run cache:clear` — removes the Node compile cache and the ESLint cache.
  Run it when a command crashes inside `typescript.js`; more failures by symptom
  in [`docs/troubleshooting.md`](docs/troubleshooting.md).
- `bun run ci:local` mirrors the PR gates that do not need a build: frozen
  install, `lint:commits`, `check`, `lint:docs` and `test`. CI also runs
  `build`; you do not.
- `bun run lint:docs` — offline link and anchor check of the Markdown. Run this
  after any docs change.
- `bun run fix` — formats the repository with Oxfmt, then autofixes Oxlint and
  ESLint. Prose keeps its line breaks (Oxfmt default).
- `bun run build` — **do not run unless explicitly asked.** It is slow and not
  needed to verify most changes.

## Site rules

Rules for any change to the Site. Each one is backed by an ADR:

- **No third-party requests.** The Site loads nothing from another origin: no
  CDNs, hosted fonts or embeds, and no analytics beyond the one script ADR 0014
  allows. [ADR 0009](docs/adr/0009-no-third-party-requests.md).
- **Hash-based CSP.** An inline script needs its computed hash in the policy;
  never use `unsafe-inline` or `unsafe-eval`.
  [ADR 0010](docs/adr/0010-hash-based-csp-and-security-headers.md).
- **The CSP is an nginx header.** It is delivered as a header with hashes
  computed at build time, not as a `<meta>` tag; Astro's meta policy is only a
  fallback for `astro preview`.
  [ADR 0012](docs/adr/0012-csp-delivered-as-an-nginx-header.md).
- **AI crawler policy.** `robots.txt` allows search and answer crawlers and does
  not allow training crawlers; change it only through a new ADR.
  [ADR 0013](docs/adr/0013-ai-crawler-policy.md).
- **One analytics script.** The only allowed third-party script is the
  cookieless Umami Cloud tracker, with attribute-only events; every other
  third-party request stays forbidden.
  [ADR 0014](docs/adr/0014-umami-cloud-cookieless-analytics.md).
- **Islands only for real interactivity.** Pages are static Astro; use a React
  island only where the UI needs client behaviour.
  [ADR 0006](docs/adr/0006-tailwind-and-shadcn-islands.md).
- **Copy stays in content files.** Never hardcode user-facing text in
  components; every page and product page exists in English and Spanish.
  [ADR 0002](docs/adr/0002-bilingual-parity.md).

## Coverage manifest

Every source module under `scripts`, `eslint-rules`, `docs/brand/tools` and
`src` needs a colocated test, or an entry with a written reason in `EXEMPTIONS`
of `scripts/coverage-manifest.test.ts`. Add the test with the module; exempt
only what cannot be tested in isolation.

## Astro docs

The `astro-docs` MCP server is declared in `.mcp.json`. Use its
`search_astro_docs` tool before guessing an Astro API or config option.

## Architecture decision records

A new ADR must add its row to [`docs/adr/README.md`](docs/adr/README.md);
`docs/adr/adr-invariants.test.ts` fails when an ADR is missing from the index.
ADRs are living documents: edit one in place to keep it true and add a
`Revised: YYYY-MM-DD, what changed` line under its `Date:`. A reversed or
replaced decision gets a new ADR.

## Branch and commit conventions

Branches are `<type>/<slug>`; `main` and `develop` are the long-lived ones
([ADR 0015](docs/adr/0015-develop-as-integration-branch.md)). Commits and PR
titles are `type: emoji lowercase subject`, for example `feat: ✨ add log page`,
in English with a bulleted body when it helps. The emoji is a convention, not
lint enforced. Detail:
[`docs/development.md#branch-naming`](docs/development.md#branch-naming),
[`docs/development.md#commit-format`](docs/development.md#commit-format).

## Code comments

Every code comment is a TSDoc block on a non-obvious export. No `//` or
non-JSDoc `/* */` comments, except lint or type directives. Detail:
[`docs/development.md#code-documentation`](docs/development.md#code-documentation),
[ADR 0005](docs/adr/0005-tsdoc-only-code-comments.md).

## Escalating a `@shadcn/lint` finding

When `bun run lint` reports a `shadcn/*` finding (for example
`shadcn/no-restyle`) on a component you are changing, work up this ladder —
never disable the rule file-wide or project-wide:

1. Use an existing shadcn/ui variant that already covers the styling you need.
2. Add a new variant to the component if no existing one fits.
3. Add or change a `no-restyle` contract in `shadcnNoRestyleContracts`
   (`shadcnNoRestyleContracts` is a single-source export of the Oxlint config),
   encoding one real, bounded design decision. Detail:
   [`docs/development.md#adding-a-shadcnlint-contract`](docs/development.md#adding-a-shadcnlint-contract).
4. Last resort: a single-line `eslint-disable-next-line -- <reason>` on the
   exact offending line, with a reason that says why it does not generalize.
   Never a file-level or project-level disable.

## Quirks and gotchas

- Never print or decrypt env values (`.env`, `.env.keys`), in output, logs,
  commits or tickets. Variables and workflow:
  [`docs/configuration.md`](docs/configuration.md).
- Run `eslint` and `tsc` without `--bun`; the scripts already do. `tsc` is
  `node_modules/typescript7/bin/tsc`, called by path; `typescript` stays 6.x for
  tools that use its JS API. ESLint (`.astro` only) uses
  `--cache --cache-strategy content`, so a stale cache is never a reason to
  delete files: run `bun run lint` again.
- Four `unicorn` design-choice rules are on, in Oxlint and in ESLint with the
  same values: `single-line-block-comment-style`, `consistent-boolean-name`,
  `no-null` and `name-replacements`. Do not rename `props`, `Props`, `ref` or
  `Ref`; `no-null` is off only in tests and `e2e/**`
  ([ADR 0023](docs/adr/0023-oxc-toolchain-and-typescript-7-1.md)). Fix a finding
  by renaming or returning `undefined`, never by disabling the rule.
- Bun is pinned to `1.4.4` (`packageManager` and `engines`).
- Oxfmt runs on its defaults (double quotes, semicolons, prose line breaks
  preserved); run `bun run fix` instead of reformatting by hand.
- Actions are SHA-pinned and workflows are linted; edit them with care:
  [`docs/development.md#ci`](docs/development.md#ci).
- Releases are tag-driven and have no npm step; never publish by hand:
  [`docs/development.md#releasing`](docs/development.md#releasing).
- Brand assets and Site content changes need the owner's approval:
  [ADR 0007](docs/adr/0007-split-license.md).
