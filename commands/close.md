---
description: Close this session's goal with zg, then write the handoff
argument-hint: [how it went]
---

The human is closing this zg session. $ARGUMENTS

1. Ask whether the goal is achieved, failed (and why) or cancelled, unless
   they just said. Ask in chat, not with a question dialog, so they answer in
   their own words. Record it with mcp__zg__close_goal and their words
   verbatim; give no reason they didn't give.
2. For each open action, ask whether it is done, cancelled, or to be filed;
   record it with mcp__zg__action (export lists it in the handoff), with
   their words as any reason.
3. Always propose the handoff, also when the goal failed or was cancelled: the
   next session's one goal (after such an end it can be a conversation about
   what to do instead), the decisions it must respect (lasting or not), and
   the few references it needs. Propose it as they'll paste it, their message
   to the next session: "I" is them, "you" is Claude. Once they agree, write
   it with mcp__zg__handoff and show what it returns verbatim.
