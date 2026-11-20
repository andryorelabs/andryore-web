# Rulesets

The repository rulesets, committed as code. `bun run repo-settings:check`
compares each file with the live ruleset of the same name and reports every
difference; it never changes a setting.

| File                           | Targets              | What it enforces                                                                                     |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| [`main.json`](main.json)       | the `main` branch    | pull requests, required checks, signed commits, no deletion or force pushes                          |
| [`develop.json`](develop.json) | the `develop` branch | pull requests (squash or merge commit), required checks, signed commits, no deletion or force pushes |
| [`tags.json`](tags.json)       | `v*` release tags    | tags cannot be moved, updated or deleted                                                             |

The other repository settings live in
[`../repo-settings.json`](../repo-settings.json). The required check names must
match real job names; `scripts/workflows-invariants.test.ts` enforces it. See
[`docs/development.md`](../../docs/development.md#repository-settings) and
[ADR 0011](../../docs/adr/0011-public-repo-security-posture.md); the merge
methods of each branch are in
[ADR 0028](../../docs/adr/0028-emet-promote-and-sync-pull-request.md).
