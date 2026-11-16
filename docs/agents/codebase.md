# Codebase map

Where things live, for coding agents that need to find the right file before
changing it. Rules for changes are in [`AGENTS.md`](../../AGENTS.md); the why
behind the structure is in [Architecture](../architecture.md).

## Source

| Path                | What it holds                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/pages`         | Astro routes, one per page and locale, plus the sitemap and the endpoints that build static output.       |
| `src/layouts`       | `BaseLayout.astro`, the shell every page uses (head, meta, analytics, CSP-relevant inline scripts).       |
| `src/components`    | Astro components for tiles and pages, and the few React islands (`.tsx`) that need client behaviour.      |
| `src/components/ui` | shadcn/ui primitives. Restyling them is bound by the `shadcn/no-restyle` contracts.                       |
| `src/content`       | All user-facing copy as JSON, in English and Spanish, with the tests that check parity and shape.         |
| `src/i18n`          | Locale list, route helpers and the parity check between the two languages.                                |
| `src/lib`           | Framework-free logic (clock, dock, GitHub grid, analytics, credentials) with colocated tests.             |
| `src/server`        | The runtime endpoint server for the Twitch live status and GitHub contributions, compiled into the image. |
| `src/seo`           | Structured data and metadata builders.                                                                    |
| `src/scripts`       | Small client scripts that run in the browser.                                                             |
| `src/styles`        | Global CSS and the Tailwind theme tokens.                                                                 |
| `src/assets`        | Images and icons imported by components.                                                                  |

## Tooling and checks

| Path                                | What it holds                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts`                           | Repo scripts (commit lint, docs link check, settings check, CSP rendering) and their tests. |
| `eslint-rules`                      | Local lint rules that run in Oxlint and in ESLint.                                          |
| `parity`                            | Oxlint-versus-ESLint parity harness for the local rules.                                    |
| `e2e`                               | Playwright specs and visual snapshots. Run only through the `bun run` scripts.              |
| `oxlint.config.ts`                  | The Oxlint rules, including the `shadcn/no-restyle` contracts.                              |
| `eslint.config.mjs`                 | ESLint, used for `.astro` files only.                                                       |
| `knip.jsonc`                        | Unused file, export and dependency detection.                                               |
| `bunfig.toml`                       | The `bun test` setup and the coverage threshold.                                            |
| `scripts/coverage-manifest.test.ts` | The colocated-test rule and its written exemptions.                                         |

## Delivery

| Path                         | What it holds                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`, `docker`       | The image build, the nginx config and the CSP header template ([ADR 0012](../adr/0012-csp-delivered-as-an-nginx-header.md)). |
| `.github/workflows`          | CI, CodeQL, release, label sync and the scheduled grid snapshot. Actions are SHA-pinned.                                     |
| `.github/rulesets`           | The branch rulesets for `main` and `develop`.                                                                                |
| `.github/repo-settings.json` | The expected repository settings, compared with the live ones by `repository-settings-check`.                                |
| `renovate.json5`             | Dependency updates, targeted at `develop`.                                                                                   |
| `.env`                       | dotenvx-encrypted values ([Configuration](../configuration.md)). Never print or decrypt them.                                |

## Documentation and agent files

| Path                     | What it holds                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `docs`                   | Published documentation; the map is [`docs/README.md`](../README.md).                                       |
| `docs/adr`               | Architecture decision records and their [template](../adr/0000-template.md).                                |
| `docs/how-to`            | Step-by-step runbooks, such as [cutting a release](../how-to/cut-a-release.md).                             |
| `docs/agents`            | Tracker, domain and `/emet:run` specifics for agents.                                                       |
| `GLOSSARY.md`            | The domain vocabulary.                                                                                      |
| `.claude/skills`         | The pinned skills, listed in `skills-lock.json`.                                                            |
| `PRODUCT.md`, `.agents/` | Local-only and gitignored; never commit or quote them ([ADR 0008](../adr/0008-private-docs-stay-local.md)). |

## Where to put a change

- New copy: a content JSON file in both languages, never a component.
- New page logic: `src/lib` with a colocated test, then a component in
  `src/components`.
- New decision: a new ADR from the template, with its row in
  [`docs/adr/README.md`](../adr/README.md).
- New environment variable: a row in [Configuration](../configuration.md); a
  test fails otherwise.
