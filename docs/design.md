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

## An example

The reply `T5: no, two hours with the kids is a no. Keep transfers under
30 min.`:

```
Claude records the reply  ReplyToThread{T5, author: human, text}
                            → ThreadReplied{T5, author: human, text}
Claude decides            MakeDecision{T5, choice, because}
                            → DecisionMade{D1, T5, choice, because}
                            → ThreadResolved{T5, outcome, by: D1}
Claude adds C5            AddCriterion{on: G, text, from: T5}
                            → CriterionAdded{C5, on: G, text, origin: T5}
```
