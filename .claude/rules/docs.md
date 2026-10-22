---
paths:
  - "docs/**"
  - "README.md"
---

If your bead is about the docs themselves and lacks `area:docs`, add it
(`bd update <id> --add-label area:docs`) and rerun `script/context <id>`.
Updating the docs to match a change made elsewhere doesn't need it.

- The README is for people using zg: what it does and how to use it. How it's
  built goes in `docs/`.
- `docs/decisions.md` is generated: change the decision bead, then run
  `script/decisions`. Never edit the file by hand.
- In `docs/design.md`, state the design tersely and name the decision bead
  that holds the reasoning; don't copy the rationale.
- Slices and open questions live only in beads, not in any document.
