---
description: Close this session's goal with zg, then write the handoff
argument-hint: [how it went]
---

The human is closing this zg session. $ARGUMENTS

1. If their words explicitly tell you to cancel or drop everything still open
   (e.g. "cancel everything, we lost the funding round"), skip the dialog:
   cancel every open thread (mcp__zg__node op cancel) and action
   (mcp__zg__action), children first, then the goal (mcp__zg__close_goal as
   cancelled), each with those words verbatim as reason and source chat.
   Issue each call yourself. Then step 3, listing in your reply every item
   you cancelled (ID and title) with the handoff. Other words about how it
   went ("it fell through", "done for today") do not skip the dialog: use
   them as the goal's reason, or to pre-fill its answer.
   Otherwise ask everything in one question dialog of up to 4 questions,
   listing children before their parents: open threads deepest first, then
   actions, then the goal. More items go in further dialogs, asked back to
   back. A thread's options are only resolved and cancelled; an action's
   are done, cancelled or to be filed; the goal's are achieved, failed or
   cancelled (unless they just said). Each option has a preview of what zg
   records for that pick (e.g. `failed`, nothing more); the preview is what
   lets them press n to add a note. A thread's resolved preview shows the
   outcome you will write: your summary of the thread's history.
2. Record in the same order, children first: threads with mcp__zg__thread op
   resolve (outcome: the preview's outcome text exactly as they saw it) or
   mcp__zg__node op cancel, actions with mcp__zg__action (export lists it in the handoff), and only then the goal
   with mcp__zg__close_goal as its description says. The reason is whatever
   words they gave about how it ended, verbatim, even short or explaining
   nothing ("drop it", "I'd rather not say why"): a note on a pick is the
   reason only, never folded into the outcome, with source dialog; words
   they typed in chat are the reason, with source chat. A thread close always needs a reason, so after a bare
   resolved or cancelled pick on a thread, ask in chat what settled or
   dropped it, record nothing for that thread until they answer, then record
   their words with source chat; likewise a bare pick of failed on the goal.
   Other bare picks (actions, achieved or cancelled goals) record source
   dialog and no reason. Their words are any reason, never an option's label
   or description.
3. Then write the handoff with mcp__zg__handoff right away, also when the
   goal failed or was cancelled, without asking first: the next session's one
   goal (after such an end it can be a conversation about what to do
   instead), the decisions it must respect (lasting or not), and the few
   references it needs. Write it as they'll paste it, their message to the
   next session: "I" is them, "you" is Claude. Show what it returns verbatim;
   when they want changes, write it again.
