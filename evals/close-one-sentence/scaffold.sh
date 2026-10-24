#!/usr/bin/env bash
# Seeds zg's event log under the recorded session's ID, so that resuming
# history.jsonl finds the goal, threads and action it recorded. Also creates
# the refusal trace empty: a regex grader that finds no file fails even a
# not_contains, and the trace only exists after a refusal. Run with the
# workspace as the working directory.
set -euo pipefail
mkdir -p .zg/sessions
cp "$(dirname "$0")/log.jsonl" .zg/sessions/e37b90e5-0070-47a4-a227-388df692a209.jsonl
: > .zg/sessions/e37b90e5-0070-47a4-a227-388df692a209.refusals.jsonl
