---
description: Close this session's goal with zg, then write the handoff
argument-hint: [how it went]
---

The human is closing this zg session. $ARGUMENTS

1. Ask everything in one question dialog of up to 4 questions: the goal's
   outcome (achieved, failed or cancelled, unless they just said) and each
   open action's (done, cancelled, or to be filed). More open items go in
   further dialogs, asked back to back. Each question's options are only
   those three, each with a preview of what zg records (e.g.
   `picked: Cancelled`); the preview is what lets them press n to add a note.
2. Record them all: each action with mcp__zg__action (export lists it in the
   handoff), and the goal with mcp__zg__close_goal as its description says.
   A bare pick of failed has no reason yet: before recording the goal, ask
   why in chat and record their answer as the reason. Their words are any
   reason, never an option's label or description.
3. Always propose the handoff, also when the goal failed or was cancelled: the
   next session's one goal (after such an end it can be a conversation about
   what to do instead), the decisions it must respect (lasting or not), and
   the few references it needs. Propose it as they'll paste it, their message
   to the next session: "I" is them, "you" is Claude. Once they agree, write
   it with mcp__zg__handoff and show what it returns verbatim.
