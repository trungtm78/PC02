Read ../shared/todo.md.

Update PLAN APPROVAL section:
  plan_approved: true
  approved_by:   Human
  approved_at:   [current timestamp]

Write message to MESSAGES:
  [timestamp] | T1_PLANNER | T2_IMPLEMENTER | Plan approved. Start all TODO tasks now.

Update TERMINAL STATUS:
  T1_PLANNER:     MONITORING | Plan approved, watching progress
  T2_IMPLEMENTER: READY      | Waiting to start

Print: "Plan approved. Terminal 2 can start implementing. Use /status to track progress."