---
paths:
  - "src/storage/**"
---

If your bead changes storage or builds on it and lacks `area:storage`, add it
(`bd update <id> --add-label area:storage`) and rerun `script/context <id>`.
Reading here to understand something doesn't need it.

- Storage reads and writes events and refusals; it knows nothing about the
  rules. Keep event types in `src/core/` and only serialise them here.
- Committed logs in `.zg/sessions/` are real history and eval fixtures: never
  hand-edit one.
- Test reading and writing through `$.fs` in wiring tests
  (`script/test wiring`).
