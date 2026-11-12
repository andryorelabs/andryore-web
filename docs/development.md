# Development

## Prerequisites

- **Bun `1.4.4`**, pinned by `packageManager` and `engines` in `package.json`.
  This repository uses Bun only; never another package manager.
- **Docker**, only for the visual, cross-browser and smoke tests (`test:visual`,
  `test:browsers`, `test:smoke`) and to run the production image.
- **Chrome or Chromium**, only for `lint:lighthouse`; set `CHROME_PATH` when it
  is not on the default path.

No key is needed to work on the Site: `dev`, `build`, `test` and `check` run on
a fresh clone ([Configuration](configuration.md#keyless-clones)).

## Running locally

```sh
bun install --frozen-lockfile
bun run dev
```

Husky installs the hooks on install through the `prepare` script. `bunfig.toml`
sets `linker = "isolated"`.

- `bun run dev` serves the Site with hot reload at `http://localhost:4321`, the
  Astro default.
- `bun run preview` serves a built `dist/` on the same port. It needs
  `bun run build` first, which stays opt-in for agents. The Playwright suites
  start their own preview on port 4417 (`E2E_PORT`) and `audit:fidelity` on 4418
  (`AUDIT_BASE_URL`).
- Neither command serves `/api/stream-status` or `/api/github-contributions`;
  those endpoints exist only in the production image.

To run the production image (nginx on port 80, with the endpoint server behind
it on an internal port 3000):

```sh
docker build -t andryore-web .
docker run --rm -p 8080:80 andryore-web
```

Then open `http://localhost:8080`. Without a key the image builds with the
committed grid snapshot and no credentials ([Configuration](configuration.md)).

## Scripts

| Script                    | What it does                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`             | Starts the Astro dev server at `http://localhost:4321`.                                                                                                               |
| `bun run build`           | `astro build` into `dist/`. Opt-in for agents; CI runs it.                                                                                                            |
| `bun run preview`         | Serves the built `dist/` with `astro preview`.                                                                                                                        |
| `bun run astro`           | Runs the Astro CLI, for example `bun run astro -- check`.                                                                                                             |
| `bun run i18n:status`     | Fails when a Spanish entry no longer matches its English source.                                                                                                      |
| `bun run grid:update`     | Refreshes `src/content/github-grid.json` from the GitHub API; needs `GITHUB_TOKEN`. The `grid-snapshot.yml` workflow runs it weekly.                                  |
| `bun run env:encrypt`     | `dotenvx encrypt`: encrypts the plaintext values of the env files ([Configuration](configuration.md#dotenvx-workflow)).                                               |
| `bun run prepare`         | Installs the Husky hooks; runs on `bun install`.                                                                                                                      |
| `bun run check`           | Aggregate gate: `format:check`, `lint`, `typecheck` and `knip`.                                                                                                       |
| `bun run fix`             | Formats the repository with Oxfmt, then autofixes Oxlint and ESLint findings (`format:write`, `lint:fix`).                                                            |
| `bun run cache:clear`     | Removes `/tmp/node-compile-cache`, `.eslintcache` and `node_modules/.cache`.                                                                                          |
| `bun run format:check`    | Checks formatting with Oxfmt (no writes).                                                                                                                             |
| `bun run format:write`    | Formats the repository with Oxfmt.                                                                                                                                    |
| `bun run lint`            | Oxlint (`--type-aware --deny-warnings`) on every file but `.astro`, then ESLint on `**/*.astro` with zero warnings, using `--cache --cache-strategy content`.         |
| `bun run lint:fix`        | Oxlint and ESLint with autofix.                                                                                                                                       |
| `bun run typecheck`       | `astro sync`, then `tsc --noEmit --runExternalCode` from `typescript7` with the content mapper.                                                                       |
| `bun run knip`            | Finds unused files, exports and dependencies.                                                                                                                         |
| `bun run test`            | Runs `bun test` with coverage and the `bunfig.toml` threshold.                                                                                                        |
| `bun run lint:docs`       | Offline link and anchor check of the Markdown with lychee.                                                                                                            |
| `bun run lint:lighthouse` | Lighthouse budget over the built `dist/`; see [Lighthouse budget](#lighthouse-budget).                                                                                |
| `bun run lint:commits`    | Runs commitlint over the commits of the current branch.                                                                                                               |
| `bun run ci:local`        | Frozen install, `lint:commits`, `check`, `lint:docs` and `test`: the PR gates that need no build.                                                                     |
| `bun run brand:export`    | Regenerates the brand rasters from the logo SVGs. Never edit the generated rasters by hand.                                                                           |
| `bun run test:e2e`        | Playwright axe, layout and hydration specs against `astro preview` of a built `dist/`.                                                                                |
| `bun run test:visual`     | Visual snapshots inside the pinned Playwright image; `-- --update` regenerates them.                                                                                  |
| `bun run test:browsers`   | Layout specs in WebKit and Firefox inside the pinned Playwright image.                                                                                                |
| `bun run test:smoke`      | Builds the nginx image and checks status codes, `/es/`, both 404s, headers and the sitemap.                                                                           |
| `bun run audit:dist`      | Scans a build directory (default `dist`) for third-party requests and unsafe external links.                                                                          |
| `bun run audit:fidelity`  | Compares a built `astro preview` with the saved design canvas (pass its path or set `FIDELITY_CANVAS`, for example `~/canvas.html`). Writes `audit-output/report.md`. |

When a command crashes inside `typescript.js`, see
[Troubleshooting](troubleshooting.md). `eslint` and `tsc` run without `--bun`.
The toolchain is explained in
[ADR 0023](adr/0023-oxc-toolchain-and-typescript-7-1.md). Agents do not run a
`build` script unless explicitly asked. Never print or decrypt env values while
running any script.

### Design-choice lint rules

`unicorn/single-line-block-comment-style`, `unicorn/consistent-boolean-name`,
`unicorn/no-null` and `unicorn/name-replacements` are on in both engines with
identical values (`eslint-rules/oxlint-rules.mjs` and `eslint.config.mjs`).
Booleans start with `is`, `has`, `should` and similar; absent values are
`undefined`, not `null`. The name allow list keeps only `props`, `Props`, `ref`
and `Ref`, each required by an external API. `unicorn/no-null` is off for
`**/*.{test,spec}.{ts,tsx,mjs}` and `e2e/**` only. `bun run lint:parity` must
report 0 unexplained and 0 accepted gaps; `parity/accepted.json` stays `[]`.

### Fidelity audit exceptions

`audit:fidelity` does not report these accepted deviations (the list is
`DOCUMENTED_EXCEPTIONS` in `scripts/fidelity-audit-core.ts`):

- The `← Home` link on About and Uses.
- The Chrome Web Store button in the Snug header.
- The header floating as a blurred pill after scroll, which canvas v29 shows and
  the audit's top-of-page canvas capture does not.
- The hero art border and shadow where the canvas differs.
- The Epidemic sound files being absent (404 on `/sounds/`) in local and CI
  builds.
- The dock buttons shrinking to 36 px (34 px under 360 px) below 400 px, so the
  dock fits phones.
- The Astro badge dark text, JSON Flow without a website tile, the 404 tiles
  behind the content at 390 px, and the 404 tiles keeping their positions with
  reduced motion.

The audit starts `astro preview` on port 4418; if another process holds it, run
your own preview and pass `AUDIT_BASE_URL`.

## Coverage

`bunfig.toml` turns coverage on for `bun test` and sets
a `coverageThreshold` for lines and functions. A run under either
value fails, locally and in CI. Test files are skipped from the report
(`coverageSkipTestFiles`).

`scripts/coverage-manifest.test.ts` enforces the manifest rule: every source
module under `scripts`, `eslint-rules`, `docs/brand/tools` and `src` needs a
colocated `.test.ts` or `.test.mjs`, or an entry in its `EXEMPTIONS` map with a
written reason. The test also fails on a stale exemption: the module is gone,
now has a test, or the reason is empty.

## Browser checks

`bun test` is the unit runner and never picks up `e2e/` (`bunfig.toml` ignores
it). Playwright (`@playwright/test`) owns `e2e/`; keep specs there, never under
`src/pages`. Unit tests cover logic; e2e specs cover what only a browser shows:
accessibility, layout, hydration and rendered pixels.

Run `bun run build` first; the checks read `dist/`, and `build` stays opt-in for
agents.

- **E2E**: `bun run test:e2e` runs axe (tags `wcag2a`, `wcag2aa`, `wcag21a`,
  `wcag21aa`, `wcag22aa`, `best-practice`) over every route in English and
  Spanish, light and dark, plus the hydration spec (no console errors, failed or
  4xx/5xx requests, nor requests outside the Umami allowlist) and the layout
  sweep at 1280, 768, 375 and 320 px (no horizontal overflow, 43.5 px touch
  targets, no clipped text). Further specs cover the stream tile states (live,
  offline and the unavailable fallback), reduced motion (no animation or
  transition on any route), the focus ring (3:1 contrast, light and dark),
  internal links (200 with no redirect) and browser language (no redirect).
  Locators come from the message files in `src/content` through
  `e2e/messages.ts`. Use `--project=chromium` for the default run. Set
  `E2E_BASE_URL` to run the specs against a server that is already up, such as
  the nginx image, so the real header CSP applies instead of the meta policy.
- **Mobile**: the `mobile-android` (Pixel 7) and `mobile-ios` (iPhone 14)
  projects use Playwright device descriptors, so `isMobile` and `hasTouch` are
  on. Both run in Chromium, because CI installs only Chromium; the iPhone
  project covers its viewport, user agent and touch, not WebKit rendering. They
  run the layout, overflow and Theme tile orientation specs, plus
  `e2e/landscape.spec.ts`: every route at 844x390 with no horizontal overflow,
  the first heading in view and no interactive element under the Dock. Run them
  with `bun run test:e2e --project='mobile-*'`; CI runs them next to `chromium`.
  Set `E2E_PORT` when port 4417 is taken by another server.
- **Other browsers**: `bun run test:browsers` runs the layout spec in `webkit`
  and `firefox` inside the pinned Playwright image (Docker required), because
  the host libraries those browsers need are not installed on a server.
- **Visual**: `bun run test:visual` compares full-page snapshots at 1280, 768,
  375 and 320 px, light and dark, with `maxDiffPixelRatio` 0.002 and reduced
  motion forced. It runs in `mcr.microsoft.com/playwright`, tagged with the
  Playwright version read from `bun.lock`, so pixels match everywhere. The
  snapshots in `e2e/__snapshots__` regenerate only through
  `bun run test:visual -- --update` (Docker required); never commit snapshots
  captured outside the container.
- **Smoke**: `bun run test:smoke` builds the `Dockerfile`, runs it and fails on
  a missing `/es/` route, a missing 404 status, a missing security header, a CSP
  with a third-party origin or `unsafe-inline`, a non-gzipped page, or a sitemap
  URL without `lastmod`. It also fails when the CSP lacks `sha256` script hashes
  or `require-trusted-types-for 'script'`. The image renders those hashes into
  the nginx header at build time with `scripts/render-csp.ts` (ADR 0012), which
  fails the build if an inline script or style has no hash.
- **Dist audit**: `bun run audit:dist [dir]` fails on a third-party request in
  HTML or CSS, and on an external link without `rel="noopener noreferrer"` (ADR
  0009). The only allowed origins are the two Umami hosts (ADR 0014).

`.github/workflows/site-quality.yml` runs the same commands on PRs that touch
the Site, all on `ubuntu-latest`
([ADR 0024](adr/0024-ci-runner-standard-and-sharded-site-quality.md)). The e2e
job (`chromium` and `mobile-*`) runs as four parallel shards (`--shard=N/4`,
with `fullyParallel: true` in `playwright.config.ts`), and each shard uploads
its own `e2e-report-N` artifact on failure. Keep every test independent of the
order within its file. The snapshots (`visual`) and the WebKit and Firefox
layout specs (`browsers`) run as two parallel jobs; both skip fork PRs because
they mount the repository into a container. The flaky-test summary
(`scripts/flaky-summary.ts`) writes to the job summary and never fails the
build. Conventions for specs: use `test.fixme` with a `BUG:` note instead of
deleting a failing test, assert something meaningful, and never call
`waitForTimeout`.

## Git hooks

Hooks live in `.husky/`:

- **`pre-commit`** runs `lint-staged`: Oxlint on staged `ts`, `tsx` and `mjs`
  files, ESLint on staged `astro` files, and Oxfmt on every staged file it
  formats (`lint-staged.config.mjs`).
- **`commit-msg`** runs `commitlint` with `@commitlint/config-conventional`. It
  enforces the Conventional Commits shape and type list, not the emoji.
- **`pre-push`** rejects a push whose branch name does not match `<type>/<slug>`
  (or `main`, `develop`, `ao-<n>-<slug>`, `worktree-*`, `renovate/*`). When the
  names pass, it runs
  `bun run typecheck` once and blocks the push on a type error. A push that only
  deletes branches or only pushes tags skips the typecheck. Put it in a hook
  rather than a line in AGENTS.md, because agents skip steps.

## Branch naming

`<type>/<slug>`, where type is one of `feat`, `fix`, `docs`, `style`,
`refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` and the slug is
lowercase kebab-case, for example `feat/add-log-page`.

`main` and `develop` are the two long-lived branches. Feature branches open PRs
against `develop` and are squash-merged, so `develop` keeps a linear history. A
promotion PR from `develop` to `main` ships a finished spec and is merged with a
merge commit ([ADR 0015](adr/0015-develop-as-integration-branch.md),
[ADR 0026](adr/0026-develop-promoted-to-main-by-merge-commit.md)), as the
rulesets enforce ([Merging](#merging)). This section, [Commit format](#commit-format) and
[Merging](#merging) are the single home of the branch, commit and merge rules;
other docs link here.

## Commit format

`type: emoji lowercase subject`, for example `feat: ✨ add log page`, in
English, with a bulleted body when it helps. PRs into `develop` are
squash-merged, so the PR title follows the same format and becomes the commit
message on `develop`. A promotion is merged with a merge commit, so it adds one
merge commit to `main` titled `chore: 🔀 promote develop to main`; commitlint is
skipped on a promotion. The hook does not enforce the emoji; it is a convention.

## Code documentation

Comments are TSDoc blocks only, on non-obvious exports. A local lint rule
(`eslint-rules/`, run by Oxlint and by ESLint on `.astro`) rejects `//` and
plain `/* */` comments; the only exceptions are directive comments a tool reads,
such as `eslint-disable`, `@ts-expect-error` and format-ignore comments.
Rationale: [ADR 0005](adr/0005-tsdoc-only-code-comments.md).

## External links

`externalLinkAttributes(href)` in `src/lib/external-link.ts` is the only place
that decides how a link opens. It returns `{ target: '_blank', rel }` for a
cross-origin `http(s)` href and `undefined` for `mailto:`, `tel:`, `#` anchors,
relative and same-origin links and the language switch. Spread it on the anchor:
`<a href={href} {...externalLinkAttributes(href)}>`. Never write `target` or
`rel` by hand.

Announce the new tab with `chrome[locale].opensInNewTab`
(`src/content/chrome.json`): as visually hidden text on a link with visible
text, and appended inside the `aria-label` of an icon-only link. Rationale:
[ADR 0020](adr/0020-external-links-open-in-a-new-tab.md).

## Adding a `@shadcn/lint` contract

The `shadcn/no-restyle` rule restricts which classes a call site may pass to a
shadcn/ui component. A contract is an entry of `shadcnNoRestyleContracts`, a
single-source export that the Oxlint config imports. Add or widen one only when
a finding reveals a real, repeating design decision, not to silence a single
finding. Work up the ladder in
[`AGENTS.md`](../AGENTS.md#escalating-a-shadcnlint-finding) first: an existing
variant, then a new variant, then a contract, and only then a one-line
`eslint-disable-next-line -- <reason>`. Record the decision in an ADR when the
contract is new. See [ADR 0006](adr/0006-tailwind-and-shadcn-islands.md).

`shadcnNoRestyleContracts` is empty until the first shadcn/ui component lands;
the `@shadcn/lint` rules run on the React island files (`src/**/*.tsx`), not on
`.astro` files.

## Adding a product page

Add two Markdown files under `src/content/products/`, `<key>.en.md` and
`<key>.es.md`. Both carry the same `key` (it is also the URL slug) and their own
`lang`; the front matter is validated by the product schema in
`src/lib/products.ts`. The build fails on a missing pair or a repeated title
([ADR 0002](adr/0002-bilingual-parity.md)).

## Skills install and update

`.claude/skills` holds 25 third-party skills. They are installed with
`bunx skills add <owner>/<repo>#<commit> -s <skill> -a claude-code`, always
pinned to a commit so `skills-lock.json` records the exact `ref`. Read each
`SKILL.md` and any bundled script before committing it. `bunx skills update`
moves the pins, so review the diff the same way.

## MCP servers

`.mcp.json` declares two HTTP servers: `linear-server` (the issue tracker) and
`astro-docs` (the Astro documentation search; use it before guessing an Astro
API).

## ADR index

`docs/adr/README.md` indexes every ADR. A new ADR adds its row there, and
`docs/adr/adr-invariants.test.ts` enforces the header format, unique, ascending
numbers, an allowed status and that the index lists every file.

## CI

Every PR runs `.github/workflows/ci.yml`, and pushes to `main` and `develop` run
it too. Job names:

- **Quality**: format check, lint (Oxlint, then ESLint on `.astro`), typecheck,
  knip.
- **Test**: `bun test`.
- **Build**: `bun run build`, so a broken build fails the PR. It is the only
  place the build runs; locally it stays opt-in.
- **Commitlint**: validates the PR's commit messages.
- **CI passed**: aggregates the jobs above; it is the single required status
  check, and the release gate reads it (see [Releasing](#releasing)).

Other workflows:

- `lighthouse.yml`: the Lighthouse budget on PRs
  ([Lighthouse budget](#lighthouse-budget)).
- `site-quality.yml`: e2e (four shards), mobile, visual, browser and smoke
  checks on PRs that touch the Site ([Browser checks](#browser-checks)).
- `release.yml`: creates the GitHub Release when a `v*` tag is pushed
  ([Releasing](#releasing)).
- `lint-pr.yml` (PR title), `lint-docs.yml` (offline link and anchor check with
  lychee) and `lint-workflows.yml` (workflow linting).
- `codeql.yml` (CodeQL analysis of the `actions` and `javascript-typescript`
  languages, skipped while the repository is private because
  code scanning is unavailable on GitHub Free) and `scorecard.yml` (OpenSSF
  Scorecard).
- `labels.yml` (label sync) and `grid-snapshot.yml` (weekly refresh of
  `src/content/github-grid.json`, opened as a PR against `develop`).

All third-party actions are pinned to a commit SHA, and
`scripts/workflows-invariants.test.ts` asserts the workflow invariants: every
`uses:` pinned to a 40-character SHA, explicit permissions (top-level
`contents: read` or stricter), `timeout-minutes` on every job,
`persist-credentials: false` on every checkout (a job with `contents: write` may
opt in with `true`), no `pull_request_target`, and no expression interpolated
inside a `run` script. `scripts/workflow-files.ts` parses the workflow files for
those tests.

### Runners

The light jobs follow the andryorelabs CI runner standard
([ADR 0024](adr/0024-ci-runner-standard-and-sharded-site-quality.md)): Quality,
Test, Commitlint and CI passed in `ci.yml`, and the jobs of `lint-pr.yml`,
`lint-docs.yml`, `labels.yml` and `lint-workflows.yml` use
`${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}`.
Every other job, Build and Site quality included, stays on a literal
`ubuntu-latest`. The `BLACKSMITH_RUNNER` repository variable is unset, so every
job runs on `ubuntu-latest`, and fork PRs always do. Only the owner turns it on,
with `gh variable set BLACKSMITH_RUNNER --body blacksmith-2vcpu-ubuntu-2404`,
and rolls it back with `gh variable delete BLACKSMITH_RUNNER`.
`scripts/workflows-invariants.test.ts` keeps the list of routed jobs and fails
when a job leaves it, uses another expression, or names a self-hosted runner.

## Lighthouse budget

`bun run lint:lighthouse` serves `dist/` locally, gzipping text assets the way
`docker/nginx.conf` does, and audits the home page and the Snug product page in
English and Spanish, five runs each, with the Lighthouse version pinned in
`scripts/lighthouse-budget.ts`. It prints a table with the median performance,
accessibility, best practices and SEO scores plus the page weight. It exits
non-zero when any median is below 90 or any score is null; weight is reported
and never fails. It needs a built site (`bun run build`, opt-in locally) and a
Chrome binary: set `CHROME_PATH` when Chrome is not on the default path. The
local server answers `/api/stream-status` with the offline state, as the nginx
image's upstream does, so the missing endpoint does not log a console error. CI
runs it in `.github/workflows/lighthouse.yml`. Renovate bumps the pinned version
through a custom manager in `renovate.json5`.

## Renovate

Renovate (`renovate.json5`) opens the dependency update pull requests and tracks
them in the Dependency Dashboard issue. Review them like any other PR: the
`CI passed` check must be green. Renovate branches are named `renovate/*`, which
the `pre-push` hook allows.

Renovate pull requests target `develop`, the integration branch that is promoted
to `main` by merge commit
([ADR 0026](adr/0026-develop-promoted-to-main-by-merge-commit.md)). Renovate
reads its config from the default branch `main`, so a change to
`renovate.json5` takes effect after a promotion.

## Releasing

Releases are tag-driven and have no npm step. The notes come from
`CHANGELOG.md`.

1. In `CHANGELOG.md`, move the `[Unreleased]` entries into a new
   `## [x.y.z] - YYYY-MM-DD` section and leave an empty `## [Unreleased]` above
   it.
2. Run `bun run check` and `bun run test`.
3. Open a PR titled `chore: 🔖 release x.y.z` and merge it.
4. Tag the merge commit with a signed tag and push it:
   `git tag -s vX.Y.Z <merge-sha> && git push origin vX.Y.Z`.

Pushing a `v*` tag triggers `.github/workflows/release.yml`. After the
main-ancestry check, a gate step polls the check runs of the tagged commit and
requires a green `CI passed`, waiting up to 20 minutes for a pending one. A
failed or missing `CI passed` stops the release; re-run the failed CI job on
`main`, then re-run the release workflow. After the gate, the workflow extracts
the matching section of `CHANGELOG.md` as the release notes and creates the
GitHub Release. Nothing is published to npm.

## Deploying

Coolify builds the `Dockerfile` and serves the image behind its proxy. The
`andryore-web` application tracks `main` and serves `andryore.dev`; `develop`
has no deployment, so it ships only through a promotion PR. The DNS record is a
DNS-only A record. `www.andryore.dev` resolves to the same server, and nginx
answers it with a `301` to the apex, keeping the path and query.

A push to `main` triggers a deploy through a GitHub push webhook that calls the
application's Coolify GitHub webhook endpoint; the secret lives only in the
webhook and in Coolify. PR preview deployments stay off so a fork PR can never
run on the server; the CI gates cover pre-merge checks.

### The `docker/` folder

The `Dockerfile` builds the Site in a Bun stage and serves it from nginx:

- `docker/nginx.conf`: the main nginx config (gzip and shared settings).
- `docker/site.conf`: the two server blocks (the `www` redirect to the apex and
  the Site), the 404 pages and the proxy of `/api/` to the endpoint server on
  `127.0.0.1:3000`.
- `docker/security-headers.conf.template`: the header template that
  `scripts/render-csp.ts` fills with the CSP script and style hashes at build
  time ([ADR 0012](adr/0012-csp-delivered-as-an-nginx-header.md)).
- `docker/entrypoint.sh`: starts the compiled endpoint server as the `nginx`
  user, then nginx in the foreground.

### Sound files and credentials

The Glass sound set is a private build input
([ADR 0019](adr/0019-optional-interface-sound.md)). The Dockerfile defaults
`SOUNDS_REPO` to `AndryOre/andryore-private` and `SOUNDS_REF` to `main`.
`SOUNDS_TOKEN` and the other credentials come from the encrypted `.env`, which
the build decrypts with the `DOTENV_PRIVATE_KEY` BuildKit secret
([ADR 0022](adr/0022-secrets-in-dotenvx-encrypted-env-files.md)). In the Coolify
application, turn on Docker Build Secrets and keep one variable, named exactly
`DOTENV_PRIVATE_KEY`; the full list of variables and the key workflow are in
[Configuration](configuration.md). Without the key the build succeeds and the
Site hides the Sound switch. To try it locally:
`docker build --secret id=DOTENV_PRIVATE_KEY,env=DOTENV_PRIVATE_KEY .`

To roll back, redeploy the previous good commit from the Coolify application
page (Deployments, then Redeploy on the earlier entry), or revert the commit on
`main` and let the webhook deploy the revert.

## Merging

PRs into `develop` are squash-merged, and `develop` keeps a linear history.
Individual commits in a PR need not follow the commit format, but the PR title
does, since it becomes the squashed commit message.

A promotion is a PR from `develop` to `main` merged with a merge commit
([ADR 0026](adr/0026-develop-promoted-to-main-by-merge-commit.md)):

```sh
gh pr create --base main --head develop --title "chore: 🔀 promote develop to main"
gh pr merge --merge
```

No sync step exists: a merge commit keeps `develop` in the history of `main`, so
`develop` never diverges from it. Commitlint is skipped on a promotion, and the
`CI passed` check stays required. The branch and tag rulesets are committed in
[`.github/rulesets`](../.github/rulesets) (`main.json`, `develop.json`,
`tags.json`) and applied with `gh api`, not by code in the repository.

Apply when the repository is public: on GitHub Free, the API rejects rulesets on
a private repository with
`403 Upgrade to GitHub Pro or make this repository public to enable this feature.`
Once the repository is public, apply each file:

```sh
gh api -X POST repos/andryorelabs/andryore-web/rulesets --input .github/rulesets/main.json
gh api -X POST repos/andryorelabs/andryore-web/rulesets --input .github/rulesets/develop.json
gh api -X POST repos/andryorelabs/andryore-web/rulesets --input .github/rulesets/tags.json
```

The required check names (`CI passed`, `Validate PR title`,
`Check markdown links`) are the job names in `ci.yml`, `lint-pr.yml` and
`lint-docs.yml`.

To apply a changed ruleset file to a ruleset that already exists, update it by
id:

```sh
gh api --method PUT "repos/andryorelabs/andryore-web/rulesets/$(gh api repos/andryorelabs/andryore-web/rulesets --jq '.[] | select(.name == "main") | .id')" --input .github/rulesets/main.json
```

A test (`scripts/workflows-invariants.test.ts`) also asserts that the required
check names in the rulesets match the jobs the workflows define, so renaming a
job without updating `.github/rulesets` fails CI.

## Repository settings

This repository follows the andryorelabs
[standard v1](https://github.com/andryorelabs/aokit/tree/main/docs/standards)
([ADR 0025](adr/0025-adopt-cross-repo-standard-v1.md)). The rulesets above are
committed as code. The remaining GitHub repository settings are listed in
`scripts/repo-settings.json`:

- merge modes: squash and merge commits, each with the PR title and body as the
  message, auto-merge, update-branch and delete-on-merge
- security features that are on: secret scanning, push protection and private
  vulnerability reporting
- the homepage and the topics

`bun run repo-settings:check` reads the live values with `gh api` and compares
them with that list and with `.github/rulesets/*.json`. It prints each
difference, exits non-zero when there is one, and never changes a setting. To
see the live values by hand:

```sh
gh api repos/andryorelabs/andryore-web
gh api repos/andryorelabs/andryore-web/private-vulnerability-reporting
gh api repos/andryorelabs/andryore-web/rulesets
```

The check does not cover two settings from the posture: the read-only default
`GITHUB_TOKEN` and fork-PR approval for outside contributors. Verify those in
the repository's Actions settings. Dependabot security updates stay off, because
Renovate is the single source of dependency updates.
[ADR 0011](adr/0011-public-repo-security-posture.md) records the posture and
which settings are still open (only the CodeQL default setup).
Settings are owner actions; an agent changes one only when the owner asks for
it.
