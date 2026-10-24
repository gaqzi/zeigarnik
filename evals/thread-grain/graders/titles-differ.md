---
type: regex
target: trace
pattern: 'mcp__zg__thread"\s*,\s*"input"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"[\s\S]*mcp__zg__thread"\s*,\s*"input"\s*:\s*\{[^}]*"title"\s*:\s*"\1"'
match: not_contains
---

No two threads are opened with the same title: one thread per topic. The
pattern finds a thread call whose title a later thread call repeats.
