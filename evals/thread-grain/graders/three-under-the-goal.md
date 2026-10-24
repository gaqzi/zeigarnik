---
type: tool_used
tool: mcp__zg__thread
input_match: '(?=[\s\S]*"op"\s*:\s*"add")(?=[\s\S]*"parent"\s*:\s*"G")'
min: 3
---

Claude asks for at least three threads directly under the goal, as separate
topics rather than one inside another: thread calls with op add and parent
G. This counts calls, accepted or not: three-opened checks that zg accepted
three threads, and no-thread-call-denied that no add was turned away, so
three such calls are three threads under G.
