# 0027: Adopt the cross-repo standard v2

## Status

Accepted. Extends [0025](0025-adopt-cross-repo-standard-v1.md).

Date: 2026-11-16

## Context

On 2026-11-15 the andryorelabs repositories agreed on standard v2, published in
[aokit](https://github.com/andryorelabs/aokit/tree/main/docs/standards). It adds
rules on top of v1: a raise-only coverage gate, one toolchain version table
with a drift check, one `sortImports` order and format scope, tested
TypeScript hooks, committed agent deny rules, release guards and more. Some v2
rules are written for a project type this repository is not, and a few are
optional. This repository also still missed several v1 rules that
[0025](0025-adopt-cross-repo-standard-v1.md) adopted.

## Decision

Adopt standard v2 from aokit as the baseline for this repository, together with
the v1 rules it was still missing. As with 0025, the ADRs of this repository
keep the detail and the standard is the common floor.

Where the standard's rules are met in this repository:

- **Toolchain versions (E15).** The pins in `package.json`, `.node-version` and
  the workflows equal the standard's table. Every pin is Renovate-managed,
  including actionlint, zizmor and the lychee binary through custom managers,
  and `scripts/toolchain-versions.test.ts` fails when a pin drifts from the
  table it carries.
- **Format scope and import order (E13).** `.oxfmtrc.json` uses the standard's
  Astro `sortImports` with `ignoreCase`, and `.mts`, `.cts` and `.jsonc` files
  are formatted by `bun run fix` and by lint-staged.
- **Type-checked root configs (E14).** `tsconfig.json` includes root `*.ts` and
  `*.mts` files and sets `moduleDetection`, `isolatedModules`,
  `forceConsistentCasingInFileNames` and `resolveJsonModule`.
- **Committed secrets (H4, H6).** The dotenvx-encrypted `.env` of
  [0022](0022-secrets-in-dotenvx-encrypted-env-files.md) is committed as H6
  allows: `.gitignore` covers `.env.keys`, `.emet/` and `.claude/worktrees/`,
  and the pre-commit hook refuses a staged `.env.keys`.

The standard's items that do not apply here, each with its reason:

- **V36 (F14), release binaries.** The repository ships no binary, so there are
  no checksums, native smoke runs or platform lists to publish.
- **V38 (F16), package shape.** The repository is a Site, not a library; it
  publishes no package for `publint`, `attw` or a size budget to check.
- **V39 (I1, I2), CLI contract.** The repository ships no CLI.
- **V40 (I3), plugin contract.** The repository ships no agent plugin.

Items decided against for now:

- **E12, one lint-policy module (should), deferred.** Oxlint and ESLint share
  rule values today, but not one consumed module with its own test. It is
  revisited when ESLint's role shrinks further or the parity gate shows drift.
- **H5, dependency review, harden-runner and SBOM (may), skipped.** The
  repository ships no binary, and the rule is a may for a Site.

No standard item was left open by the adoption work: the grid snapshot workflow
checks out without persisted credentials and pushes with a token in the step
environment, so it needs no exception.

## Consequences

- A change to the standard's toolchain table is copied into
  `scripts/toolchain-versions.test.ts`, so the drift test keeps comparing
  against the standard and not against itself.
- The N-A, deferred and skipped lists above are the only places a v2 item is
  declined; a new exception needs a revision here.
- `.mts` and `.cts` files are now formatted, and lint-staged passes
  `--no-error-on-unmatched-pattern` to Oxlint, so a commit of files Oxlint
  ignores, such as `.d.mts` declarations, still runs.
