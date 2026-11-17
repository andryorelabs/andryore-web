---
name: cut-release
description: Cut a release of this project. Use when the user asks to release, tag or publish a new version.
---

# Cutting a release

Installed from aokit Module `release-skills@1.0.0` (`registry-src/release-skills/files/cut-release.md`),
adapted to this repository's tag-driven release. Releases have no npm step and no binaries; never
publish by hand.

1. Read `docs/how-to/cut-a-release.md` and follow it; this skill only orders the steps.
2. Confirm the working tree is clean and start a `chore/release-x.y.z` branch from an up-to-date
   `develop`, the integration branch ([ADR 0015](../../../docs/adr/0015-develop-as-integration-branch.md)).
   Never push to `main` or `develop` directly.
3. Run `bun run ci:local` and stop on any failure.
4. Check that `[Unreleased]` in `CHANGELOG.md` has entries. This repository has no release
   script, so move them by hand into a new `## [x.y.z] - YYYY-MM-DD` section, leave an empty
   `## [Unreleased]` above it and add the matching link reference at the bottom of the file.
5. Set `"version": "x.y.z"` in `package.json`; the release workflow compares it with the tag.
   Run `bun run check` and `bun run test` again.
6. Open the release pull request titled `chore: 🔖 release x.y.z` and stop until the owner merges
   it.
7. Once the release commit is on `main` (a promotion merges `develop` with a merge commit,
   [ADR 0026](../../../docs/adr/0026-develop-promoted-to-main-by-merge-commit.md); the release
   workflow refuses a tag that is not on `main`), tag that merge commit with a signed, annotated tag and push it:
   `git tag -s vX.Y.Z <merge-sha> && git push origin vX.Y.Z`. The tag must be signed with an SSH
   key registered on the owner's GitHub account; when none is configured, hand the command to
   the owner. Never move or reuse a tag.
8. Verify that `.github/workflows/release.yml` passed its guards and its `CI passed` gate, and
   that the GitHub Release for the tag exists with notes that match the changelog section. Report
   the version and the release link.
