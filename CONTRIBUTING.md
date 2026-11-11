# Contributing

Thanks for your interest in andryore.dev. Participation is covered by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Where to start

For a question, a bug or a concrete proposal, open an issue first so the reason
is on the record. Issues labelled
[`good first issue`](https://github.com/andryorelabs/andryore-web/labels/good%20first%20issue)
or
[`help wanted`](https://github.com/andryorelabs/andryore-web/labels/help%20wanted)
are the best entry points.

[`ROADMAP.md`](ROADMAP.md) lists the [out-of-scope](ROADMAP.md#out-of-scope)
items, including the brand assets and Site content, which are not open to
contributions. [`GOVERNANCE.md`](GOVERNANCE.md) explains how decisions are made.

## Set up and check your work

Fork, clone and install with bun. The setup steps and every script are in
[Development](docs/development.md#scripts). Run `bun run check` and
`bun run test` before you push.

## Open a pull request

Pull requests target `develop`
([ADR 0015](docs/adr/0015-develop-as-integration-branch.md)). The conventions
live in one place each:

- [Branch naming](docs/development.md#branch-naming)
- [Commit format](docs/development.md#commit-format), which also applies to the
  PR title
- [Code documentation](docs/development.md#code-documentation)
- [Merging](docs/development.md#merging)
- [CI](docs/development.md#ci)

## Security

Report vulnerabilities privately, as described in
[`.github/SECURITY.md`](.github/SECURITY.md).
