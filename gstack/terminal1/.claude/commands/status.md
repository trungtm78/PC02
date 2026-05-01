Read ../shared/todo.md and print a summary dashboard:

===================================================
  GStack Status - T1_PLANNER
  [timestamp]
===================================================

PROJECT: [project name]
Status:  [status]

TASKS:
  DONE:        X / Total
  IN_PROGRESS: X
  TODO:        X
  FAILED:      X

BUGS:
  OPEN:     X (CRITICAL: X, HIGH: X)
  FIXED:    X
  VERIFIED: X

RECENT MESSAGES (last 3):
  [show last 3 messages]

TERMINAL STATUS:
  T1: [status]
  T2: [status]
  T3: [status]

NEXT ACTION:
  [analyze and suggest appropriate next step]
===================================================

If CRITICAL bug found open: print warning and write message to T2.
If all tasks DONE and no OPEN bugs: suggest running /report.