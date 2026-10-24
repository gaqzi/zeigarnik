---
type: regex
target: trace
pattern: '\b(?:add|thread) needs (?:the (?:title|parent)|op:)'
match: not_contains
---

No thread add is turned away for missing input (the "add needs …" and
"thread needs op" texts in src/mod/tools.ts). Without this, a refused add
under G would still count towards three-under-the-goal. A refused resolve
is not checked here; closes are left to the close guardrails.
