---
name: add-adr
description: Write or update an architecture decision record in docs/adr. Use when a decision is hard to reverse, surprising without context, and the result of a real trade-off.
---

# Writing an ADR

Installed from aokit Module `adr-docs@1.1.0` (`registry-src/adr-docs/files/skill/add-adr.md`),
adapted to this repository's ADR form.

1. Read `docs/adr/README.md` and the ADRs touching the area; flag a contradiction instead of
   overriding it.
2. Decide whether the change is an edit or a new ADR. An ADR is a living document: to keep one
   true, edit it in place and add a `Revised: YYYY-MM-DD, what changed` line under its `Date:`.
   A reversed or replaced decision gets a new ADR instead.
3. For a new ADR, copy `docs/adr/0000-template.md` to `docs/adr/NNNN-kebab-title.md`, using the
   next free number. Never reuse a retired number (0016 does not exist and stays unused).
4. Keep the Nygard form the invariant test checks: `# NNNN: Title`, then `## Status` (Accepted,
   Proposed, Deprecated or Superseded, plus any relation such as
   `Amends [0015](0015-develop-as-integration-branch.md)`) with a `Date: YYYY-MM-DD` line,
   `## Context`, `## Decision` (with the options that were rejected) and `## Consequences`. Use
   the terms in `GLOSSARY.md`.
5. Add a row to the index table in `docs/adr/README.md`, and fill the last column of every row
   the new ADR amends or supersedes.
6. Add any new term to `GLOSSARY.md`.
7. Never quote `PRODUCT.md`, `.agents/` or the private brand docs
   ([ADR 0008](../../../docs/adr/0008-private-docs-stay-local.md)).
8. Run `bun test docs/adr/adr-invariants.test.ts` and `bun run lint:docs`, and fix every failure.
