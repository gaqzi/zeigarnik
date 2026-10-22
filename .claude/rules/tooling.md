---
paths:
  - "script/**"
  - "*.json"
  - ".tool-versions"
  - ".gitignore"
---

If your bead is about the scripts or the build and lacks `area:tooling`, add
it (`bd update <id> --add-label area:tooling`) and rerun
`script/context <id>`. Reading here, or a small change that follows from work
elsewhere, doesn't need it.

- Scripts are bash, start with `set -euo pipefail` and `cd` to the repo root,
  and may rely on `bd` and `jq`. Read bd's data through `--json`, not its
  human output.
- Shared code goes in `script/lib/`. The area list there
  (`script/lib/areas.sh`) mirrors the table in `.beads/PRIME.md`: change both
  together.
- Update the Scripts table in `docs/development.md` when a script is added or
  its usage changes.
