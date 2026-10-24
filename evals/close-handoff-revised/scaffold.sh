#!/usr/bin/env bash
# Seeds zg's event log under the recorded session's ID, so that resuming
# history.jsonl finds the goal and action it recorded. Run with the
# workspace as the working directory.
set -euo pipefail
mkdir -p .zg/sessions
cp "$(dirname "$0")/log.jsonl" .zg/sessions/75205cd2-4769-49de-90e3-404efda7ee21.jsonl
