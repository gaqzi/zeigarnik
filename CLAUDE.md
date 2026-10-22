# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Beads

This project tracks all work in bd (beads), and keeps lasting design
constraints there as decision beads. The workflow and conventions arrive
through `bd prime` (a SessionStart hook runs it); run `bd prime` yourself if
they're missing, e.g. in a subagent.

Never commit, push, or run `bd dolt push` unless the human asks in this
session.

Don't run `bd setup claude`, or `bd init` without `--skip-agents`: they
rewrite this file. `bd setup claude --check` reports it as stale; that's
expected.

## Build & Test

See [docs/development.md](docs/development.md): testing layers, tooling and
scripts. Start on a bead with `script/context <id> --claim`.

- `script/bootstrap` once; `script/test` before handing over (free: format,
  typecheck, lint, domain core, mod wiring).
- `script/test unit` or `wiring` for one layer. `script/test eval` costs
  tokens: ask the human first, and run it outside the Bash sandbox.
- Try zg in a session with `claude --plugin-dir .`.

## Architecture Overview

See [docs/design.md](docs/design.md) for how zg is built, and the
[README](README.md) for what it does. The reasoning behind both is in the
decision beads, rendered in [docs/decisions.md](docs/decisions.md).

## Rules for all work

- When zg's behaviour or shape changes, update the README in the same change
  (zg-t5d).
- Label a bead with the areas its work is about, not every directory it
  touches or reads (zg-nti).

## Conventions & Patterns

### Working agreement (until zg exists)

We discuss design the way zg will structure a session, so the habits carry
over once the plugin can track them for us.

- Number open points `T1`, `T2`…; decisions `D1`…; actions `A1`…
- The user replies by ID (`t4: …`); several per message is normal. Answer
  each one under its ID.
- Record lasting decisions as decision beads, with the human's agreement
  (see `bd prime`).
- End a discussion with what is decided, what is still open, and the next
  step.
