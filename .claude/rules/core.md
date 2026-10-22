---
paths:
  - "src/core/**"
---

If your bead changes the domain core or builds on it and lacks `area:core`,
add it (`bd update <id> --add-label area:core`) and rerun
`script/context <id>`. Reading here to understand something doesn't need it.

- The core imports nothing from `src/mod/`, `src/storage/` or the mod API
  (`$`). Anything it needs from outside, such as the time or new IDs, comes in
  as part of a command.
- One module per concern: commands, events, `decide`, `evolve`, and one per
  view.
- Refer to a rule by its name from the README's Rules section, in code and in
  test names ("children close first"), never by a number.
- Test it as given events, when a command, then events or a refusal; see
  `.claude/rules/testing.md`. `script/test unit` runs these alone.
