# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately** using GitHub's built-in
Private Vulnerability Reporting:

**→
[Open a security advisory](https://github.com/andryorelabs/andryore-web/security/advisories/new)**

Do **not** open a public issue for security reports. That exposes the
vulnerability before a fix is available.

**Response times:**

| Severity | Acknowledge (target) | Patch target |
| -------- | -------------------- | ------------ |
| Critical | 48 h                 | 7 days       |
| High     | 5 days               | 14 days      |
| Medium   | 10 days              | 30 days      |

## Supported Versions

Only the latest deployed version of the Site, built from `main`, is supported.
There are no maintained release branches. A fix lands on `main` and is deployed
with the next build.

## Scope

The Site is static, apart from one runtime endpoint that serves the live Twitch
status and the GitHub contribution grid. Reports about the source code, the
build and deploy pipeline, and the runtime endpoint are in scope. The design
behind the policy, the headers and the secrets is in
[`docs/security.md`](../docs/security.md).

## Credit

Reporters are credited by name (or handle) in the GitHub Security Advisory
unless you ask to stay anonymous when you report. State your preference in the
initial report.
