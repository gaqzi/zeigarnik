---
paths:
  - "src/mod/**"
---

If your bead changes the mod layer or builds on it and lacks `area:mod`, add
it (`bd update <id> --add-label area:mod`) and rerun `script/context <id>`.
Reading here to understand something doesn't need it.

- Load the `plugin-authoring` skill before changing hooks, tools or the pane:
  it has the mod API (`$`), surfaces and hook events.
- Keep this layer thin: turn the input into a core command, hand it to the
  core, and pass any refusal back to whoever sent it.
- Tool descriptions and standing instructions reach the model on every turn.
  After changing them, `script/test wiring` checks the fixed budget (zg-n27).
- `script/test wiring` runs the wiring tests alone.
