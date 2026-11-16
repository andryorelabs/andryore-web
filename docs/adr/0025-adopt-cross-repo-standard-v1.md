# 0025: Adopt the cross-repo standard v1

## Status

Accepted. Amended by [0027](0027-adopt-cross-repo-standard-v2.md): standard v2
is adopted on top of v1.

Date: 2026-11-11

Revised: 2026-11-16, "no root llms.txt" now reads "no repository-root llms.txt",
F3 and H6 point to the ADRs that meet them (0024 and 0022), and 0027 amends it.

## Context

The andryorelabs repositories share one set of repository standards, kept in
[aokit](https://github.com/andryorelabs/aokit/tree/main/docs/standards): agent
docs, settings, security features, CI and release conventions. Until now this
repository followed its own copy of those conventions, so the sibling
repositories drifted from each other and from this one. The brand kit has its
own rules and stays in [`docs/brand/README.md`](../brand/README.md).

## Decision

Adopt standard v1 from aokit as the baseline for this repository. Where this
repository already decided something, its ADRs keep the detail; the standard is
the common floor.

The standard's items that do not apply here, each with its reason:

- **Site footer credit.** The Site has no footer credit line; the brand rules in
  [`docs/brand/README.md`](../brand/README.md) and [0001](0001-brand-kit-in-docs-brand.md)
  govern what the Site shows.
- **npm publishing.** The repository is a Site, not a package, and releases are
  tag-driven with no npm step.
- **Build attestation.** No release artifact is published, so there is nothing
  to attest.
- **Plugin manifests.** The repository ships no agent plugin.
- **Repository-root `llms.txt`.** Crawler and agent access is set by
  `robots.txt` ([0013](0013-ai-crawler-policy.md)); the Site serves its own
  `/llms.txt`, and no repository-root `llms.txt` is kept.

Two standard items are met by earlier decisions: the runner expression with
`BLACKSMITH_RUNNER` (F3) by [0024](0024-ci-runner-standard-and-sharded-site-quality.md),
and the dotenvx-encrypted `.env` that may be committed while `.env.keys` never is
(H6) by [0022](0022-secrets-in-dotenvx-encrypted-env-files.md).

Repository settings that the standard lists are applied from a committed
settings list, and `bun run repo-settings:check` reports drift against GitHub
([0011](0011-public-repo-security-posture.md)).

## Consequences

- A change to the standard in aokit is a reason to revisit this ADR, not to
  edit the sibling repositories one by one.
- The N-A list above is the only place a standard item is declined; a new
  exception needs a revision here.
- Settings stay owner actions: the check reports drift and does not change
  GitHub.
