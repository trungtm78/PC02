Read ../shared/todo.md and show what T3 needs to handle:

T3_TESTER - POLL RESULT
===========================

MESSAGES FOR ME:
  [messages where To = T3_TESTER or ALL]

TASKS READY TO TEST (passed codex gate):
  (tasks with CODEX:PASS note but no T3:PASS yet)
  - [task ID]: [description]

BUGS TO VERIFY (status = FIXED):
  - [B-ID]: [description] - Fixed by T2

OVERALL:
  Total tasks: X | Tested: X | Passing: X | Failing: X
  Bugs open: X  | Fixed: X  | Verified: X

Suggest next action:
- If FIXED bug exists   -> "Verify fix: /verify B-XXX"
- If task ready         -> "Test next: /test [task-id]"
- If "All done" from T1 -> "Run full suite: /full-test"
- If nothing            -> "Waiting for T1 to forward. Poll again later."

Update T3_TESTER status in TERMINAL STATUS.