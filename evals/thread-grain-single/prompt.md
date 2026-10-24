---
description: One question raised alone gets at most two threads, not a fan-out of Claude's own. Behaviour, baseline then ratchet (zg-egt). Not exercised - whether the one thread is the right one; only the count is checked, and the case passes when Claude opens no thread at all (2 of 5 baseline runs did). The close guardrails have not been exercised by any run so far, since no run closed anything; they pass when nothing closes. Without the plugin the whole case passes vacuously, as zg's tools are absent.
tags: [slice-2a, threads]
runs: 5
max_turns: 10
allowed_tools: [mcp__zg__open, mcp__zg__thread, mcp__zg__node, mcp__zg__action, mcp__zg__show]
---

/zg:open Pick a name for the new service. It's the thing that batches outbound webhooks.
