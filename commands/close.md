---
description: Close this session's goal with zg, then write the handoff
argument-hint: [how it went]
---

The human is closing this zg session. $ARGUMENTS

1. Ask whether the goal is achieved, failed or cancelled, unless they just
   said. Ask with a question dialog whose options are only those three, each
   with a preview of what zg records (e.g. `picked: Cancelled`); the preview
   is what lets them press n to add a note. Record it with
   mcp__zg__close_goal as its description says. A bare pick of failed has no
   reason yet: ask why in chat and record their answer as the reason. Never
   use an option's label or description as a reason.
2. For each open action, ask whether it is done, cancelled, or to be filed,
   with a question dialog whose options are only those three, each with a
   preview, the same way.
   Record it with mcp__zg__action (export lists it in the handoff), with their
   words as any reason, never an option's label.
3. Always propose the handoff, also when the goal failed or was cancelled: the
   next session's one goal (after such an end it can be a conversation about
   what to do instead), the decisions it must respect (lasting or not), and
   the few references it needs. Propose it as they'll paste it, their message
   to the next session: "I" is them, "you" is Claude. Once they agree, write
   it with mcp__zg__handoff and show what it returns verbatim.
