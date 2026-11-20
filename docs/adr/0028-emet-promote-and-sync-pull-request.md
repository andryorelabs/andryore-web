# 0028: emet promote and the sync pull request

## Status

Accepted. Amends [0026](0026-develop-promoted-to-main-by-merge-commit.md) and
[0011](0011-public-repo-security-posture.md): a
promotion is opened and merged by `emet promote` and is followed by a sync pull
request into `develop`, and the `develop` ruleset no longer requires a linear
history, which 0011 described as squash-only with a linear history.

Date: 2026-11-20

## Context

[0026](0026-develop-promoted-to-main-by-merge-commit.md) promotes `develop` to
`main` with a merge commit and states that no sync step exists. That holds for
the tree, but the promotion's merge commit itself lands only on `main`, so after
every promotion `develop` is one commit behind `main`.

emet 0.14 runs the promotion when `handoff.afterSpec` is `promote`: once a
spec's last wave has merged clean, `emet promote` opens a `develop` to `main`
pull request titled `chore: 🔖 promote develop`, waits for CI, merges it with a
merge commit, and then, when `develop` is behind `main`, opens a `main` to
`develop` pull request titled `chore: 🔖 sync main into develop` and merges it
with a merge commit too.

The `develop` ruleset blocks that second pull request twice: it allows the
squash method only and it requires a linear history, and a merge commit
satisfies neither. A squash of the sync pull request would not help: it would
add a new commit to `develop` instead of the promotion's merge commit, so
`develop` would still not contain `main`.

## Decision

- **`emet promote` opens and merges the promotion.** The promotion is a pull
  request from `develop` to `main` titled `chore: 🔖 promote develop`, merged
  with a merge commit once its CI passes. It replaces the hand-made
  `chore: 🔀 promote develop to main` pull request of
  [0026](0026-develop-promoted-to-main-by-merge-commit.md).
- **A sync pull request follows each promotion.** It goes from `main` to
  `develop`, is titled `chore: 🔖 sync main into develop` and is merged with a
  merge commit, so `develop` contains every commit of `main` again.
- **The sync pull request may wait for its checks.** `develop` requires the
  same checks as before, and `emet promote` tries to merge the sync pull request
  right after opening it, before they finish. When that merge is refused, the
  pull request stays open until its required checks pass and is then merged by
  hand: `gh pr merge <n> --merge --auto`.
- **`develop` drops the linear-history rule and allows squash and merge.**
  `.github/rulesets/develop.json` has no `required_linear_history` rule and its
  `allowed_merge_methods` are `squash` and `merge`. It keeps signed commits, the
  pull request rule, no deletion or force push and the strict required-checks
  policy.
- **Feature, wave and Renovate pull requests stay squash-merged.** This is now a
  convention: the ruleset accepts a merge commit on `develop`, and only the sync
  pull request uses one.
- **Commitlint is skipped on the sync pull request.** Like a promotion, it
  carries commits already linted on their own pull requests. The skip covers a
  same-repository pull request from `main` to `develop`, as it covers one from
  `develop` to `main`; a fork branch with either name is still linted.
- **The live ruleset is changed by hand.** The owner applies the changed
  `develop.json` to the repository; no script or agent changes a ruleset through
  the API. Until then `bun run repo-settings:check` reports the `develop`
  differences.

### Rejected alternatives

- **Keep the linear history and skip the sync**: `develop` falls one merge
  commit behind `main` on every promotion, and `emet promote` reports a sync
  pull request that can never merge.
- **Squash the sync pull request**: it adds a new commit instead of the
  promotion's merge commit, so `develop` never contains `main`.
- **A ruleset bypass for the sync**: a bypass actor would let any pull request
  skip the rules and, as [0011](0011-public-repo-security-posture.md) notes,
  counts against Scorecard's Branch-Protection check.

## Consequences

- `develop` is no longer linear: it carries one sync merge commit per
  promotion.
- Nothing enforces squash for other pull requests into `develop`; a merge
  commit there is a review finding, not a ruleset error.
- A promotion can leave the sync pull request open until someone merges it with
  `gh pr merge <n> --merge --auto`.
- `scripts/promotion-invariants.test.ts` asserts the `develop` ruleset and the
  commitlint skip condition, so a change to either fails `bun run test` unless
  the test changes with it.
