# Beads in zeigarnik

All work is tracked in bd (beads). Lasting design constraints are also kept
here, as decision beads. Don't use TodoWrite, TaskCreate or markdown TODO
lists for tracking work.

## Starting work

```bash
bd ready                         # open, unblocked work
script/context <id> --claim      # claim it, and print what you need to start
```

`script/context` prints the bead (as `bd show` would), its epic's design,
its dependencies, an index of the accepted decisions for the bead's areas
(bead ID and title), and the path rules that apply. The titles state each
decision; read the full rationale with `bd show <id>` when it matters for the
work. Without `--claim` it only prints.

## Creating and updating

```bash
bd create --title "…" --description "what and why" --type task|feature|bug|chore \
  --parent <epic> --labels area:<area> --acceptance "…"
bd update <id> --design "how" | --notes "what we learned"
bd comments add <id> "what happened, as it happens"
bd dep add <issue> <depends-on>
bd close <id> --reason "…"
```

Every work bead and decision has at least one area label, for the areas its
work is about: what it changes or builds on, not every file it reads or
touches in passing (a feature that updates the README isn't `area:docs`):

| Label | Directories |
|---|---|
| `area:core` | `src/core/`: commands, events, decide/evolve, views as pure functions |
| `area:mod` | `src/mod/`: hooks, tools, pane drawing, injection |
| `area:storage` | `src/storage/`: the session log and trace |
| `area:evals` | `evals/` |
| `area:tooling` | `script/`, config files |
| `area:docs` | `docs/`, `README.md` |
| `area:project` | `.beads/PRIME.md`, `CLAUDE.md`, `.claude/rules/` |

`mod`, `storage` and `evals` also load `core`'s decisions.
`script/context` warns about unknown area labels; `script/decisions` refuses
to render while a decision lacks a valid one.

## Decisions

A decision bead records a lasting constraint. The test:

> Would an agent working on a different bead, months from now, go wrong
> without knowing this?
> Yes: a decision bead. Only this bead: its design field. Only this session:
> the handoff.

- Only the human makes decisions. Propose one; never record it unasked.
- The title is the rule, stated so it reads alone and applies beyond the
  case that raised it (ask: which other beads would it constrain?). The
  case goes in `## Context`; the why in the body, never the title.
- The description has `## Context`, `## Decision`, `## Rationale` and
  `## Alternatives Considered`. Refer to rules and other decisions by name or
  bead ID, never by number.
- The notes say how it was decided: the human's own words, including any
  hedges ("good start, change it later").
- Status: open means still to decide (it can block work); closed with reason
  "accepted" means in force. Replace one with
  `bd supersede <old> --with <new>`.
- Never run `bd compact` or `bd prune` on decisions.
- After creating or changing one, run `script/decisions` and commit
  `docs/decisions.md` with the change.

```bash
bd create --type decision --validate --labels area:<area> --title "…" --body-file <file>
```

## Git and sync

Never commit, push, or run `bd dolt push` unless the human asks in this
session. At the end of a session, report what changed (`git status`) and
propose the commands; the human decides.

## Ending a session

1. File beads for anything left to do.
2. If code changed, run `script/test`.
3. Close finished beads; update the ones in progress.
4. Hand off: what changed, what was validated, bead status, and the next
   goal.
