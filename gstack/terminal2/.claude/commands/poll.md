Read ../shared/todo.md and show what is relevant to T2_IMPLEMENTER:

1. Check plan_approved - if false, print: "Waiting for Human to approve plan. Poll again later."

2. If plan_approved = true, show:

MY TASKS (T2_IMPLEMENTER):
  TODO:        [list of task IDs]
  IN_PROGRESS: [list]
  DONE:        [list]

BUGS FOR ME TO FIX:
  [B-ID] [severity]: [description]
  (or "No new bugs")

MESSAGES TO ME:
  [messages where To = T2_IMPLEMENTER or ALL]

3. Suggest next action:
- If CRITICAL bug exists  -> "Fix B-XXX now: /fix B-XXX"
- If TODO task exists     -> "Implement next: /implement [task-id]"
- If all DONE, no bugs    -> "All done. Notify T1."

Update T2_IMPLEMENTER status in TERMINAL STATUS.