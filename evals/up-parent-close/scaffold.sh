#!/usr/bin/env bash
# Seeds zg's event log under the recorded session's ID, so that resuming
# history.jsonl finds the goal and the threads it recorded.
# Run with the workspace as the working directory.
set -euo pipefail
mkdir -p .zg/sessions
cp "$(dirname "$0")/log.jsonl" .zg/sessions/06ecd14d-ec76-4f54-90ae-a88aaf6f0e07.jsonl
