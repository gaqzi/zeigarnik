---
paths:
  - ".beads/PRIME.md"
  - "CLAUDE.md"
  - ".claude/rules/**"
---

If your bead changes how we work and lacks `area:project`, add it
(`bd update <id> --add-label area:project`) and rerun `script/context <id>`.
Reading here to understand something doesn't need it.

- `.beads/PRIME.md` is what `bd prime` prints at the start of every session;
  `CLAUDE.md` is loaded into every session. Every line in them costs context
  every time, so keep them short.
- `CLAUDE.md` holds only rules that apply to all work, one line each, with the
  bead ID for the reasoning.
- Each file in `.claude/rules/` covers one area's directories (in its `paths`
  frontmatter), opens with the line asking for the area label, then gives
  practical how-to. It never restates a decision.
- `.claude/` isn't writable from the sandbox; ask the human before writing
  there.
