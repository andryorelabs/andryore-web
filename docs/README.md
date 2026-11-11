# Documentation

Technical documentation for the andryore.dev repository. Each entry is labelled
by what it is for: **How-to** (steps to do a task), **Reference** (facts to look
up) or **Explanation** (the why behind a choice).

## Start here

- [Contributing](../CONTRIBUTING.md): How-to. How to propose and land a change.
- [Development](./development.md): Reference. Prerequisites, running locally,
  the `package.json` scripts, tests, git hooks, branch, commit and merge rules,
  CI, releasing and the repository settings.
- [Configuration](./configuration.md): Reference. Every environment variable and
  the dotenvx workflow for the encrypted env files.
- [Troubleshooting](./troubleshooting.md): How-to. Common failures grouped by
  symptom, each with its root cause and fix.

## How the Site works

- [Architecture](./architecture.md): Explanation. How the Site is built, served
  and deployed.
- [Security](./security.md): Explanation. The threat model, headers, secrets and
  repository posture.
- [Design](../DESIGN.md): Reference. The public design context that design
  skills read.
- [Accessibility](../ACCESSIBILITY.md): Reference. The accessibility commitments
  and how they are checked.

## Project

- [Roadmap](../ROADMAP.md): Explanation. Where the project is heading.
- [Changelog](../CHANGELOG.md): Reference. What changed in each release.
- [Governance](../GOVERNANCE.md): Explanation. Who decides what and how.

## Decisions

[Architecture decision records](./adr/README.md)

## Brand

- [Brand kit](./brand/README.md): Reference. The public logo, tokens, OG and
  avatar assets and the export tooling. The brand strategy documents are private
  and stay out of the repository
  ([ADR 0008](./adr/0008-private-docs-stay-local.md)).

## Agent configuration

- [Domain docs](./agents/domain.md): Reference. How skills consume the domain
  documentation.
- [Issue tracker](./agents/issue-tracker.md): Reference. The Linear conventions.
- [Triage labels](./agents/triage-labels.md): Reference. The label vocabulary.
- [`/emet:run`](./agents/emet.md): Reference. The repo-specific rules for the
  parallel worktree pipeline.

The root [`AGENTS.md`](../AGENTS.md) holds the rules every coding agent follows,
and [`GLOSSARY.md`](../GLOSSARY.md) the domain vocabulary.
