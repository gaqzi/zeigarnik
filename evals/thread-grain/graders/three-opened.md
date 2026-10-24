---
type: regex
target: trace
pattern: 'ThreadOpened T3\b'
---

zg accepted at least three threads. Its tool result reports each event it
wrote, and a fresh session numbers threads T1, T2, T3 in the order zg
accepts them (a refused call takes no ID), so T3's result means three were
opened. The pattern names T3 rather than counting results because the
trace carries each result twice, in the tool_result and in
tool_use_result. A grader can't read the log itself, as its path holds the
session ID (zg-bam.10).
