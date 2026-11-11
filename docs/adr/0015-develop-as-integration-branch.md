# 0015: develop as the integration branch

## Status

Accepted. Amended by [0026](0026-develop-promoted-to-main-by-merge-commit.md): a
promotion is a merge commit, not a squash.

Date: 2026-10-17

Revised: 2026-10-19, merged the forge trunk ADR (formerly numbered sixteen)

Revised: 2026-11-11, the promotion is a merge commit and the rulesets differ
(0026)

## Context

Until now every branch merged straight into `main`, and `main` is what the Site
serves. The first spec (AO-1964, the Site itself) reached `main` through a
promotion PR (#27), not directly. The next specs are larger than one PR and
should not change what visitors see until they are ready.

## Decision

- **`develop` is the integration branch.** Feature branches (`<type>/<slug>`)
  open PRs against `develop`, not `main`.
- **`main` receives `develop` by PR.** A promotion PR from `develop` to `main`
  ships a finished spec. The promotion is merged with a merge commit
  ([0026](0026-develop-promoted-to-main-by-merge-commit.md)); PRs into `develop`
  stay squash-only, so `develop` keeps a linear history.
- **`develop` has its own ruleset** with the same required checks as `main`,
  committed in `.github/rulesets/develop.json`. It takes squash merges only and
  requires a linear history; `main` takes merge commits only.
- **CI runs on pushes to `develop`** as it does on `main`, in addition to every
  PR.
- **The branch hook accepts `develop`** besides `main`, `renovate/*` and
  `<type>/<slug>`.
- **`/forge` integrates on `develop`.** `repo.trunk` in `forge.config.json` is
  `develop`, so waves, worktrees and PRs from `/forge` target it. It moved
  early, not after AO-1964 was merged.

### Rejected alternatives

- **Everything on `main` behind a feature flag**: the Site is static and has no
  runtime flags to hide a half-built page.
- **Long-lived `feat/site` branch**: passes the hook, but the name hides that it
  is the integration branch for several specs.

## Consequences

- Nothing deploys from `develop`: the only Coolify app, `andryore-web`, builds
  from `main` (0003), so the Site changes only when a promotion PR is merged.
- Releases still tag `main`; the release gate is unchanged.
- A spec ships in two merges: a squash from the feature branch to `develop`,
  then a merge commit from `develop` to `main`. `main` history holds every
  squash commit of `develop` plus one merge commit per promotion.
- `docs/development.md` describes the flow; the rulesets are applied by the
  owner with `gh api`.
