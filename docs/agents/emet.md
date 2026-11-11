# `/emet:run` operational specifics for andryore-web

Repo-specific config the global `/emet:run` command reads before running any of its
9 phases. Machine-checkable values (trunk/remote, ticket id shape, concurrency,
preflight's required files, handoff/usage thresholds) live in
[`emet.config.json`](../../emet.config.json) at the repo root, validated against
the emet config schema. This file holds the "why"
prose and everything a JSON value can't express.

**Trunk.** `repo.trunk` is `develop`: waves merge there and a promotion PR ships
them to `main` ([ADR 0015](../adr/0015-develop-as-integration-branch.md)).

## Tracker

Tracker: `linear`. See [issue-tracker.md](issue-tracker.md) for the literal
calls `/emet:run` makes to create, read, and transition tickets here, and
[triage-labels.md](triage-labels.md) for the triage vocabulary.

## Ticket ids and branches

- Ticket id shape: `^AO-\d+$` (e.g. `AO-1`), issued by Linear team `AO`.
- Worker branch: `ao-<n>-<slug>` — each worker checks this out itself at
  worktree step 0. Local-only, never pushed.
- Commit: add a trailer line referencing the ticket at the end of the commit
  body (see `commit.trailer`/`commit.trailerPosition` in `emet.config.json` if
  this repo wants something other than the built-in default).

## Worktree setup

A worker's first action in a fresh worktree is always `git worktree lock` with
the reason the coordinator generated for it (`emet lock-reason`) — that's built
into `/emet:run` itself, identical in every repo, and nothing below needs to
restate it.

**Base commit.** The harness creates `isolation: "worktree"` checkouts at the
old `main` commit, not at `develop`, and the permission system denies
`git reset --hard` there. A worker therefore creates its branch straight from
the trunk: `git checkout -b <branch> develop`, then verifies that
`git rev-parse HEAD` equals `git rev-parse develop` before installing anything.
The dispatch prompt must say so; without it workers stop at bootstrap.

A fresh worktree only needs `bun install --frozen-lockfile --silent`
(`worktree.bootstrap` in `emet.config.json`). No codegen and no env files to
copy from the main checkout.

## Self-check

Commands a worker runs before considering its own change done: see
`commands.selfCheck` in `emet.config.json`, which runs `bun run check` and
`bun run test`. After a docs change, also run `bun run lint:docs`. `build` is
deliberately left out: it's slow and the maintainer asks for it explicitly,
except in tickets whose acceptance criteria require it.

For changes that affect rendered pages, the Lighthouse gate is
`bun run lint:lighthouse` after a `bun run build`: median of 5 runs on home and
a product page in EN and ES, failing below 90 in performance, accessibility,
best practices or SEO; page weight is printed, never enforced. See
[Lighthouse budget](../development.md#lighthouse-budget).

## Concurrency

Max `concurrency.waveSize` live agents per wave, and a global
`concurrency.maxLiveWorkers` cap shared **host-wide** — by every concurrently
running `/emet:run` coordinator on this machine, across _every_ repo and every git
worktree of every repo (e.g. several Orca worktrees of this same repo, or an
entirely unrelated repo, all draw from one pool). The pool lives under
`~/.local/state/emet/slots`, not this repo's own `--git-common-dir`. A slot is
held only while its worker is actually live — it's released as soon as that
worker reports done, not held for the rest of the wave.

`concurrency.maxLiveWorkers` defaults to `"auto"`: derived from this host's own
cpu count and RAM rather than a fixed number, so it scales with the machine
`/emet:run` actually runs on instead of an arbitrary constant. A separate
memory-headroom brake also denies new slot acquisitions when `MemAvailable` is
too low, regardless of how many slots are technically free — see `emet doctor`
for this host's resolved numbers, and pin an explicit integer here instead of
`"auto"` only when there's a specific reason to cap this repo lower than the
host otherwise would. Both settings live in `emet.config.json`.
`EMET_MAX_LIVE_WORKERS` (accepting `"auto"` too) and
`EMET_RUN_IDLE_THRESHOLD_MS` still override their config counterparts when set,
same as before this repo had a config file at all.
