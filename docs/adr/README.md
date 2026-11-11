# Architecture decision records

Decisions are recorded in
[Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
`# NNNN: Title`, then `## Status` with a `Date: YYYY-MM-DD` line, `## Context`,
`## Decision` (with the options that were rejected) and `## Consequences`.
`adr-invariants.test.ts` enforces the header format, unique, ascending numbers,
an allowed status, and that this index lists every ADR.

To add one, copy the next number, write the file, and add a row below, filling
the last column when it amends or supersedes another. The rules for editing ADRs
are in [`AGENTS.md`](../../AGENTS.md#adrs).

ADR 0016 does not exist: its decision was merged into
[0015](0015-develop-as-integration-branch.md), and the number is not reused.

| Number | Title                                                                                                    | Status   | Superseded or amended by        |
| ------ | -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------- |
| 0001   | [Brand kit lives in docs/brand](0001-brand-kit-in-docs-brand.md)                                         | Accepted | 0008 (partly)                   |
| 0002   | [Every page exists in English and Spanish](0002-bilingual-parity.md)                                     | Accepted | 0013, 0018                      |
| 0003   | [Static Astro site deployed on Coolify](0003-static-astro-on-coolify.md)                                 | Accepted | 0004, 0006, 0009, 0010, 0018    |
| 0004   | [One runtime endpoint for the Twitch live status](0004-live-status-endpoint.md)                          | Accepted | 0017, 0022                      |
| 0005   | [TSDoc-only code comments](0005-tsdoc-only-code-comments.md)                                             | Accepted | -                               |
| 0006   | [Tailwind v4 and shadcn/ui, as islands](0006-tailwind-and-shadcn-islands.md)                             | Accepted | -                               |
| 0007   | [MIT for code, brand and content reserved](0007-split-license.md)                                        | Accepted | 0011, 0018                      |
| 0008   | [Private docs stay local](0008-private-docs-stay-local.md)                                               | Accepted | -                               |
| 0009   | [No third-party requests from the Site](0009-no-third-party-requests.md)                                 | Accepted | 0010, 0014 (partly), 0017, 0020 |
| 0010   | [Hash-based CSP and security headers](0010-hash-based-csp-and-security-headers.md)                       | Accepted | 0012                            |
| 0011   | [Public repo security posture](0011-public-repo-security-posture.md)                                     | Accepted | 0022                            |
| 0012   | [CSP delivered as an nginx header](0012-csp-delivered-as-an-nginx-header.md)                             | Accepted | -                               |
| 0013   | [AI crawler policy](0013-ai-crawler-policy.md)                                                           | Accepted | -                               |
| 0014   | [Umami Cloud cookieless analytics](0014-umami-cloud-cookieless-analytics.md)                             | Accepted | -                               |
| 0015   | [develop as the integration branch](0015-develop-as-integration-branch.md)                               | Accepted | -                               |
| 0017   | [GitHub contributions served by the runtime endpoint](0017-github-contributions-via-runtime-endpoint.md) | Accepted | 0022                            |
| 0018   | [The Site has no Log](0018-the-site-has-no-log.md)                                                       | Accepted | -                               |
| 0019   | [Optional interface sound](0019-optional-interface-sound.md)                                             | Accepted | 0021, 0022                      |
| 0020   | [External links open in a new tab](0020-external-links-open-in-a-new-tab.md)                             | Accepted | -                               |
| 0021   | [Stack scene scroll sound](0021-stack-scroll-sound.md)                                                   | Accepted | -                               |
| 0022   | [Secrets live in dotenvx-encrypted env files](0022-secrets-in-dotenvx-encrypted-env-files.md)            | Accepted | -                               |
| 0023   | [Oxc toolchain and TypeScript 7.1](0023-oxc-toolchain-and-typescript-7-1.md)                             | Accepted | -                               |
| 0024   | [CI runner standard and sharded Site quality](0024-ci-runner-standard-and-sharded-site-quality.md)       | Accepted | -                               |
| 0025   | [Adopt the cross-repo standard v1](0025-adopt-cross-repo-standard-v1.md)                                 | Accepted | -                               |
