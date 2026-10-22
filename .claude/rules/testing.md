---
paths:
  - "**/*.test.ts"
  - "evals/**"
---

The three layers, and what goes in each, are in `docs/development.md`.

- Put a behaviour in the cheapest layer that can show it: domain core first,
  mod wiring when it needs the engine, evals only for what the model does.
- Domain core tests read as given events, when a command, then events or a
  refusal. Each rule gets tests by its name, refusals included.
- Wiring tests are `*.test.ts` beside the code, run by `claude plugin test`
  with the kit from `claude-code/testing`.
- `script/test` runs the free layers; `script/test unit` or `wiring` runs one.
  `eval` costs tokens: see `.claude/rules/evals.md`.
