#!/usr/bin/env bash
# Prints the pattern of the no-resolve-reason-outside-the-message grader in
# case.yaml, built for a prompt. Other cases reuse it with their own prompt
# (slice 4's propagation cases).
#
#   evals/decide-from-reply/graders.sh ["<prompt>"]
#
# The default is this case's prompt, exactly as in execution.prompt. Pass the
# prompt with its real newlines (in bash,
# $'a\n\nb'): the log holds the field JSON-encoded, so the script encodes the
# prompt the same way before it builds the pattern. The output is the YAML
# pattern value: wrap it in single quotes (double any single quote the prompt
# holds). To regenerate the grader, run the script and paste its output over
# the grader's pattern.
#
# The pattern fails on any ThreadResolved whose reason is not a contiguous
# substring of the (JSON-encoded) prompt. The alternation lists every
# substring of the prompt as a prefix of one of its suffixes, each prefix
# chain nested right (a(?:b(?:c)?)?), regex metacharacters escaped. The line
# is picked by a lookahead on its type, so the order of fields within the line
# does not matter.
set -euo pipefail

prompt=${1-'T5: no, two hours with the kids is a no. Keep transfers under 30 min.'}

PROMPT=$prompt node -e '
const prompt = JSON.stringify(process.env.PROMPT).slice(1, -1);
const esc = (c) => (/[.*+?^${}()|[\]\\\/]/.test(c) ? "\\" + c : c);
const nest = (s) => {
  let out = "", close = "";
  for (let i = 0; i < s.length; i++) {
    out += (i ? "(?:" : "") + esc(s[i]);
    if (i) close += ")?";
  }
  return out + close;
};
const suffixes = Array.from({ length: prompt.length }, (_, i) => nest(prompt.slice(i)));
process.stdout.write(
  "(?<![^\\n])(?=[^\\n]*\"type\":\"ThreadResolved\")(?=[^\\n]*\"reason\":\"(?!(?:" +
    suffixes.join("|") + ")\"))\n"
);
'
