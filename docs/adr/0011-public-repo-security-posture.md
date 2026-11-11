# 0011: Public repo security posture

## Status

Accepted. Extends [0007](0007-split-license.md). Amended by
[0022](0022-secrets-in-dotenvx-encrypted-env-files.md): the Site has runtime
credentials, kept in an encrypted env file.

Date: 2026-10-17

Revised: 2026-10-19, the tags ruleset has an admin bypass and the settings
section exists

Revised: 2026-10-20, the Site does have runtime credentials (0022)

Revised: 2026-11-11, secret scanning and push protection are applied from the
committed settings list, and `bun run repo-settings:check` reports drift

## Context

The repository went public with a fresh single-commit history. It is maintained
by one person, and its supply chain (GitHub Actions, dependencies, the release
workflow) is the main attack surface. The Site's few credentials (Twitch,
GitHub, the sound repository) are dotenvx-encrypted in the repository
([0022](0022-secrets-in-dotenvx-encrypted-env-files.md)), so the exposure is CI,
the tags that trigger a release and the encryption key.

Some of the posture is already committed as code: two repository rulesets in
`.github/rulesets/` (`main` and `v*` tags), SHA-pinned workflows checked by a
test, `permissions` blocks on every workflow, CodeQL and OpenSSF Scorecard
workflows, and Renovate. The rest lives in GitHub settings, which no commit can
carry. This ADR records both halves and the settings that are still open. The
reference is AFE's ADR 0001, which follows the OpenSSF SCM best-practices guide.

## Decision

### Already in place (read from the GitHub API on 2026-10-17)

- **Rulesets, active.** `main` has no bypass actors and blocks deletion and
  force-pushes, requires linear history, signed commits, a pull request with
  squash as the only merge method and resolved threads, and the checks
  `CI passed`, `Validate PR title` and `Check markdown links`. The `v*` tags
  ruleset blocks deleting, moving and updating tags, with a bypass for the
  repository admin role.
- **0 required approvals**, because a solo maintainer cannot approve their own
  PR and a bypass actor would count against Scorecard's Branch-Protection check.
- **Squash-only merges** with branches deleted on merge.
- **Secret scanning and push protection** enabled.
- **Private vulnerability reporting** enabled.
- **Read-only default `GITHUB_TOKEN`**, and Actions cannot approve pull
  requests.
- **Fork-PR workflows need approval** from every outside contributor, not only
  first-timers (applied 2026-10-17).
- **`sha_pinning_required`** in the Actions settings, so an unpinned `uses:` is
  rejected by GitHub itself. The workflow invariants test enforces the same in
  CI (applied 2026-10-17).
- **Immutable releases**, so a published Release and its assets cannot be edited
  or replaced (applied 2026-10-17).

### Still open (owner action, applied through the GitHub API)

- **CodeQL default setup.** `codeql.yml` is an advanced setup today. Default
  setup would drop a workflow file; keep the workflow until a decision to
  switch.

### Rejected

- **Dependabot alerts and security updates**: Renovate is the single source of
  dependency updates.
- **A merge queue**: unavailable on personal-account repositories and
  unnecessary for one maintainer.
- **Required code-owner review**: no benefit with a single owner.
- **`step-security/harden-runner`**: a third-party agent in every job, for a
  repository with no runtime secrets and pinned actions.
- **`actions/dependency-review-action`**: GitHub's dependency graph does not
  parse `bun.lock`.

## Consequences

- Direct pushes to `main` are blocked for everyone, admin included. Every change
  goes through a PR.
- Scorecard's score is expected to stay in the middle of the range. The checks
  that need a second reviewer or contributor are inherent to the solo setup and
  are not work items.
- Once releases are immutable, a bad release is fixed by publishing a new
  version, never by editing the old one.
- The open settings are tracked in
  [`docs/development.md#repository-settings`](../development.md#repository-settings).
