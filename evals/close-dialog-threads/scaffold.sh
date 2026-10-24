#!/usr/bin/env bash
# Seeds zg's event log under the recorded session's ID, so that resuming
# history.jsonl finds the goal, the two threads and the action it recorded.
# Also creates the refusal trace empty: a regex grader that finds no file
# fails even a not_contains, and the trace only exists after a refusal. Run
# with the workspace as the working directory.
set -euo pipefail
mkdir -p .zg/sessions
cp "$(dirname "$0")/log.jsonl" .zg/sessions/78c3b830-605a-4a0c-a7a0-4b4ff715b313.jsonl
: > .zg/sessions/78c3b830-605a-4a0c-a7a0-4b4ff715b313.refusals.jsonl
