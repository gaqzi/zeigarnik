#!/usr/bin/env bash
# Seeds zg's event log under the recorded session's ID, so that resuming
# history.jsonl finds the goal and the nodes it recorded.
# Run with the workspace as the working directory.
set -euo pipefail
mkdir -p .zg/sessions
cp "$(dirname "$0")/log.jsonl" .zg/sessions/2c0aa468-afb5-435a-a540-a560e2b422e4.jsonl
