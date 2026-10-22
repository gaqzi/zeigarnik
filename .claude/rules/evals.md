---
paths:
  - "evals/**"
---

If your bead adds or changes evals and lacks `area:evals`, add it
(`bd update <id> --add-label area:evals`) and rerun `script/context <id>`.
Reading here to understand something doesn't need it.

- One directory per behaviour, each with its `case.yaml` and graders.
- `script/test eval` costs tokens and takes minutes. Run it on big changes
  and before closing a slice, and say so to the human before you do.
- Check with an assertion on the event log wherever the outcome can be
  checked mechanically; reach for an LLM grader only when it can't.
- See `.claude/rules/testing.md` for the test layers.
