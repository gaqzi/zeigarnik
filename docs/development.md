# Development

How to work on zg: testing, tooling, scripts, and how work is tracked. The
design is in [design.md](design.md).

Set up a clone with `script/bootstrap`, and run `script/test` before handing work
over.

## Testing

There are three layers. Most of the logic should live in the first.

| Layer | What it covers | How |
|---|---|---|
| **Domain core** | State machines, the [rules](../README.md#rules), propagation candidates, building the handoff | Pure TypeScript functions. Given/when/then unit tests (given these events, when this command, then these events or a refusal), TDD. No Claude involved. |
| **Mod wiring** | Tool calls updating state, the pane rendering, buttons and inputs, prompt hooks | `claude plugin test` runs `*.test.ts` against the real engine. It fakes tool calls and prompt submits, mounts the pane on the terminal surface, presses buttons, types input and reads state. |
| **Model behaviour** | Whether Claude opens threads at the right grain, attributes replies to threads, propagates (each direction on its own), recaps, checks the goal and steers | Evals with `claude plugin eval`: scripted conversations run headless, scored mostly by assertions on the event log, with an LLM grader only for what can't be checked mechanically (is the recap any good). This is where tool descriptions and standing instructions are tuned. |

Tests and evals both run in Claude Code's own runtime (zg-4nn). The first two
layers are `*.test.ts` files beside the code, importing `test` and `expect`
from `claude-code/testing`; a domain core test just never touches the engine.
`claude plugin test` runs every test under a plugin folder and has no filter,
so `script/test unit` and `wiring` run it on a temporary copy holding one
layer's tests.

Evals live in `evals/<case>/`: a `prompt.md` and `graders/*.md`, or a
`case.yaml` (schema_version "1.1") with the graders inline. There are no
custom-code graders: the event log is checked with a `regex` grader on the
file's contents. A case with a fixed session ID (a resumed transcript) names
the log's path with `target: {source: file, path: .zg/sessions/<id>.jsonl}`;
`record-action` reads the trace, since its ID is unknown. Each run is a
headless `claude -p` in a fresh temporary directory. Runs can't start inside
Claude Code's Bash sandbox (they make directories in `/tmp`), so an agent runs
`script/test eval` outside it.

A longer conversation is a recorded transcript, and only `case.yaml` can
resume one: `context.history_file` goes to `claude --resume`, which keeps the
session ID, and `execution.prompt` is the next human turn. zg's log lives at
`.zg/sessions/<session-id>.jsonl`, so `context.scaffold_script` (bash, run in
the workspace, `$(dirname "$0")` is the case dir) copies the recorded log
there. Scaffold scripts only run with `--scaffold`, which `script/test eval`
passes since the cases are ours. A history holding a command's expansion
goes stale when that command changes: re-record it then.

To record one, in a scratch dir run
`claude --plugin-dir <repo> -p --output-format json --allowedTools='mcp__zg__*' -- "<prompt>"`,
and `--resume <session_id>` for each later turn. Copy
`~/.claude/projects/<dir>/<id>.jsonl` to `history.jsonl`, keeping only the
`user`, `assistant` and `custom-title` lines, and the scratch dir's
`.zg/sessions/<id>.jsonl` to `log.jsonl`.

### Eval pass bars

From zg-egt. Each case runs 5 times, since the model isn't deterministic.
Guardrails (no rule broken, nothing done without the human's confirmation)
must pass every time. Behaviours start at the baseline the first run
measures, and the bar only ratchets up; slice 4 closes at 80% or better.
`claude plugin eval` also runs a no-plugin baseline, which shows what zg adds.

### Context budgets

From zg-n27. The plugin's own code costs no tokens; only what reaches the
model counts. `src/mod/budget.test.ts` checks the fixed part: it starts a
session, collects the tools zg registers in front of the model, and counts
about four characters a token.

| Part | Budget |
|---|---|
| Fixed: tool schemas and standing instructions | 3k, hard cap 5k |
| Per-turn index of open items | 300 + ~15 per open item |
| Re-injection after compaction | 2k |

Rarely used tools are deferred, loaded through tool search when needed, and
details arrive on request (`zg_show T4`), not every turn. The pane is for the
human and costs Claude nothing.

## Tooling

Node and TypeScript, installed with [asdf](https://asdf-vm.com) from
`.tool-versions`, used only for `tsc --noEmit` and
[Biome](https://biomejs.dev) (lint and format) (zg-4nn). Biome covers the
code and JSON, not Markdown. The scripts are bash and need `bd` and `jq`.

The repo is the plugin: `.claude-plugin/plugin.json`, and `hooks/hooks.json`
naming the hooks module `src/mod/register.tsx`, which must define `register`
itself (a re-export is refused). The engine follows `$` across an import
only into a `function` declaration, and only spelled `$.noun.call(...)`, so
a module outside `register.tsx` takes `$` itself, never `$.fs`; a `$.state`
reference is a const in the file that reads it. `claude plugin validate .`
says when one isn't. `tsc` reads the mod API from `vendor/`: the
declarations Claude Code writes for its own build. The API is early access
and changes between releases, so `script/test` warns when they were written
by another version than the `claude` installed; `script/update-vendor-deps`
refreshes them.

## Scripts

The repo follows
[scripts to rule them all](https://github.blog/engineering/scripts-to-rule-them-all/)
(zg-564).

| Script | Does |
|---|---|
| `script/bootstrap` | Install the toolchain (asdf), bd and jq (Homebrew), and dependencies |
| `script/fmt` | Format the code |
| `script/test` | The free tests: typecheck, lint, domain core and mod wiring. Runs `script/fmt` first unless `CI` is set; on CI it checks formatting instead |
| `script/test unit` / `wiring` / `eval` | One layer. `eval` costs tokens and takes minutes, so it's run on big changes and before closing a slice. It grants zg's own tools (`--allow-tools 'mcp__zg__*'`), judges with sonnet (haiku failed correct answers) and keeps the report local |
| `script/test all` | Every layer, cheapest and fastest first, stopping at the first gate that fails |
| `script/cibuild` | What CI runs |
| `script/update-vendor-deps` | Replace the mod API declarations in `vendor/` with the installed Claude Code's. Spends one short haiku turn |
| `script/context <id> [--claim]` | Everything needed to start on a bead: the bead, its epic's design, its dependencies, the decisions and path rules for its areas. Warns about unknown area labels |
| `script/decisions` | Render the decision beads into [decisions.md](decisions.md). Refuses while a decision lacks a valid area label |

## Tracking work

All work and every lasting decision is a bead in bd; `bd prime` prints the
workflow, and a SessionStart hook runs it for Claude. Each bead carries labels
for the areas its work is about, and agents load context by them (zg-nti):

- `script/context <id>` gives the decisions for the bead's areas.
- `.claude/rules/` gives practical guidance when matching files are touched.

Decisions are made by the human, recorded as decision beads, and rendered into
[decisions.md](decisions.md) (zg-pvk). Slices and open questions live only in
beads: `bd show zg-bam` lists the slices.
