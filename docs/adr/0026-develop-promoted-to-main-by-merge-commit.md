# 0026: develop promoted to main by merge commit

## Status

Accepted. Amends [0015](0015-develop-as-integration-branch.md) and
[0011](0011-public-repo-security-posture.md): a promotion is a merge commit, and
the `main` ruleset no longer requires a linear history.

Date: 2026-11-11

## Context

[0015](0015-develop-as-integration-branch.md) made `develop` the integration
branch and shipped it to `main` with a squash-merged promotion PR. A squash
creates a new commit on `main` that `develop` does not have, so the two branches
stop sharing history. After 22 promotions `main` held 22 commits that `develop`
lacked and `develop` held 80 that `main` lacked. The next promotion then needs
`main` merged back into `develop`, and the `develop` ruleset forbids that push:
it takes pull requests only and requires a linear history.

GitHub's documentation says squash merging works best for short-lived branches
and recommends a merge commit for long-running ones, because later pull requests
from a squashed branch can repeat commits and conflicts. The sibling
repositories snug, aokit, emet and jobship already promote with a merge commit.

## Decision

- **PRs into `develop` are squash-merged.** Feature branches, `/emet:run` wave
  PRs and Renovate PRs target `develop`, so `develop` stays linear.
- **A promotion is a merge commit.** A promotion is a PR from `develop` to
  `main`, merged with a merge commit and titled
  `chore: 🔀 promote develop to main`. `main` receives promotions only.
- **No sync step exists.** After a promotion `main` contains `develop`, so
  nothing is merged back.
- **`main` stays the default branch.** Only `main` deploys
  ([0003](0003-static-astro-on-coolify.md)) and only `main` carries release
  tags. `develop` never deploys and is never tagged.
- **The rulesets differ.** `develop` keeps squash only, a linear history and the
  strict required-checks policy. `main` takes merge commits only and drops the
  linear history and the strict policy, because a promotion is always ahead of
  `main`. Both keep signed commits, the pull request rule and the same three
  required checks.
- **The repository allows squash and merge commits.** Each ruleset decides which
  method its branch accepts. A merge commit takes the PR title as its title and
  the PR body as its message.
- **Commitlint is skipped on a promotion.** The commits of a promotion were
  linted when they reached `develop` and cannot be rewritten in the promotion
  PR. The `CI passed` check stays required and accepts the skipped job.
- **The branches were reconciled once.** On 2026-11-11, while both trees were
  identical, PR #128 merged `develop` into `main` with a merge commit. No direct
  push and no force-push was used.

### Rejected alternatives

- **Squash the promotion and sync `main` back into `develop`**: the squash
  breaks the ancestry, so every promotion needs a merge pushed straight to
  `develop`, which its ruleset blocks.
- **Make `develop` the default branch**: the README, the badges and the OpenSSF
  Scorecard would then read history that is not promoted yet.
- **Rebase-merge the promotion**: it rewrites the commits, so `develop` and
  `main` still diverge.

## Consequences

- `main` is no longer linear: it carries one merge commit per promotion, and
  `develop` lacks those commits.
- The history of `main` shows every squash commit from `develop`, not one commit
  per promotion.
- A PR opened without `--base develop` targets `main`. The `main` ruleset limits
  the merge method, not the head branch, so "`main` receives promotions only" is
  a convention that no ruleset enforces.
- Renaming a required job in a workflow means updating both branch rulesets in
  the same change, or `bun run test` fails.
- `scripts/repo-settings.json` and `.github/rulesets/main.json` hold the
  expected values, and `bun run repo-settings:check` compares them with the live
  repository.
