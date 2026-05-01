Argument: $ARGUMENTS (task ID, e.g.: UT-001 or IT-002)

1. Read ../shared/todo.md, find task with ID = $ARGUMENTS
2. If not found -> report error and stop
3. Update task status -> IN_PROGRESS in todo.md
4. Write message: [timestamp] | T2_IMPLEMENTER | T1_PLANNER | Starting $ARGUMENTS

5. Implement test code:
   - Read related source code (if path in task description)
   - Write test file per project framework
   - Cover: happy path, error cases, edge cases
   - Run test to verify no syntax errors

6. After implementing:
   - Update task status -> DONE in todo.md
   - Write to MESSAGES: [timestamp] | T2_IMPLEMENTER | T1_PLANNER | $ARGUMENTS done. Please run /codex code $ARGUMENTS
   - Update timestamp in TASKS row

7. Print summary:
   Implemented: $ARGUMENTS
   File: [filename]
   Test cases: X
   Status: DONE -> Notified T1 (waiting /codex review)