# Cut a release

Releases are tag-driven and have no npm step. The notes come from
`CHANGELOG.md`. Never publish by hand.

## Steps

1. In `CHANGELOG.md`, move the `[Unreleased]` entries into a new
   `## [x.y.z] - YYYY-MM-DD` section and leave an empty `## [Unreleased]` above
   it. Add the matching link reference at the bottom of the file; the
   `scripts/changelog.test.ts` test fails without one.
2. Run `bun run check` and `bun run test`.
3. Open a PR titled `chore: 🔖 release x.y.z` and merge it.
4. Tag the merge commit with a signed tag and push it:
   `git tag -s vX.Y.Z <merge-sha> && git push origin vX.Y.Z`.

## What the tag does

Pushing a `v*` tag triggers `.github/workflows/release.yml`. After the
main-ancestry check, a gate step polls the check runs of the tagged commit and
requires a green `CI passed`, waiting up to 20 minutes for a pending one. A
failed or missing `CI passed` stops the release; re-run the failed CI job on
`main`, then re-run the release workflow. After the gate, the workflow extracts
the matching section of `CHANGELOG.md` as the release notes and creates the
GitHub Release. Nothing is published to npm.

## How to know it worked

The GitHub Release for the tag exists and its notes match the changelog
section.

See also [Development](../development.md#ci) for the workflows and
[Merging](../development.md#merging) for how a promotion reaches `main`.
