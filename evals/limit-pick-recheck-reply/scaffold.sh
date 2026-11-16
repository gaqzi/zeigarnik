#!/usr/bin/env bash
# Seeds zg's event log under the recorded session's ID, so that resuming
# history.jsonl finds the goal and the nodes it recorded.
# Run with the workspace as the working directory.
set -euo pipefail
mkdir -p .zg/sessions
cp "$(dirname "$0")/log.jsonl" .zg/sessions/5347c50f-de2f-4b54-a2c7-f8410f9dabcf.jsonl
