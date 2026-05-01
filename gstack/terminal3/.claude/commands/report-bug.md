Argument: $ARGUMENTS (format: TASK-ID "description" severity)
Example: /report-bug UT-003 "Token expiry returns 200 not 401" HIGH

Parse arguments:
- arg1 = Task ID (UT-XXX or IT-XXX)
- arg2 = Description (in quotes)
- arg3 = Severity (CRITICAL/HIGH/MEDIUM/LOW)

Steps:
1. Read ../shared/todo.md, count existing bugs to create new Bug ID (B-001, B-002...)
2. Add new row to BUG TRACKER:
   | B-XXX | [TaskID] | T3_TESTER | [Description] | [Severity] | OPEN | - | [timestamp] |

3. Write message:
   [timestamp] | T3_TESTER | T2_IMPLEMENTER | Bug B-XXX filed for [TaskID]: [description] ([severity])

4. Print:
   Bug filed: B-XXX
   Task:      [TaskID]
   Severity:  [severity]
   Issue:     [description]
   -> T2 notified to fix

If severity = CRITICAL:
- Also write message to T1: [timestamp] | T3_TESTER | T1_PLANNER | CRITICAL bug B-XXX found in [TaskID]