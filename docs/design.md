# Design

How the pieces of zg fit together. The reasoning behind each piece is in its
decision bead (`bd show <id>`, or [decisions.md](decisions.md)); what zg does
for its users is in the [README](../README.md).

## The pieces

zg is a Claude Code mod written in TypeScript.

| Directory | Holds |
|---|---|
| `src/core/` | the domain: commands, events, `decide`, `evolve` and views, as pure functions (zg-orj) |
| `src/mod/` | hooks, tools, the pane, context injection (zg-5mi, zg-zo2) |
| `src/storage/` | the session log and the refusal trace (zg-r1g, zg-vgk) |
| `evals/` | model-behaviour evals (zg-egt) |

Everything under a goal is a node: a thread, a decision or an option.
Containment is one table in `src/core/`, read by `decide` on open, nest and
merge (zg-8ld).

## How an input flows

```
Claude's tool call ┐
reply in chat      ┼─▶ command ─▶ decide(state, command)
press in the pane  ┘                │
                        ┌───────────┴───────────┐
                     events                  refusal
                        │                       │
             append to the session log    refusal trace,
             evolve(state, event)         reason and fix back
                        │                 to the sender
                        ▼
             views: pane, handoff,
             re-injection, review
```

- Claude interprets the conversation and records what it means through
  tools; zg's code only records and enforces (zg-7zf).
- Every input becomes the same command, so the rules live only in `decide`
  (zg-kux), which refuses anything that would break one (zg-su8).
- The session is the only aggregate: one event stream, one `decide` over the
  whole session (zg-orj, after Chassaing's
  [Functional Event Sourcing Decider](https://thinkbeforecoding.com/post/2021/12/17/functional-event-sourcing-decider)).
- Events are domain facts that keep both sides of the conversation
  (zg-tjz), and grow without breaking (zg-8ex).

## Where the session lives

- The log: `.zg/sessions/<session-id>.jsonl`, rewritten on every change
  (zg-r1g). Refusals: `.zg/sessions/<session-id>.refusals.jsonl` (zg-vgk).
- Each command loads the log, folds it and decides; the pane draws the
  overview from `$.state`, which only mirrors the log.
- `/zg:open` and `/zg:close` are prompt commands (`commands/`), so Claude
  records through the tools; `/zg:open`'s typed line also reaches
  UserPromptSubmit, where the session is renamed. `/zg:copy-handoff` is a
  plugin command file answered by zg's command.run hook, so it costs no
  model turn and, hidden from the model (`disable-model-invocation`), no
  fixed context.
- The handoff can be written again until it's right. The session closes
  (SessionClosed) on a `/clear` while a handoff stands; quitting leaves it
  open to resume.
- After a compaction or a resume, SessionStart re-injects the brief view
  (zg-zo2), within 2k tokens (zg-n27).

## An example

The reply `T5: no, two hours with the kids is a no. Keep transfers under
30 min.`:

```
Claude records the reply        ReplyToNode{T5, author: human, text}
                                  → NodeReplied{T5, author: human, text}
Claude records the realization  RecordDecision{parent: T5, title, choice, source: chat, reason}
                                  → DecisionOpened{D2, parent: T5, title}
                                  → OptionAdded{D2.1, decision: D2, title: choice}
                                  → DecisionMade{D2, option: D2.1, source: chat, reason}
Claude adds C5                  AddCriterion{on: G, text, origin: D2}
                                  → CriterionAdded{C5, on: G, text, origin: D2}
```

One command may yield several events; they are appended together or not at
all (zg-tjz).
