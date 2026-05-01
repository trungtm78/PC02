Argument: $ARGUMENTS (task ID, e.g.: UT-001)

1. Read ../shared/todo.md, find task $ARGUMENTS
2. Find corresponding test file (based on task description)
3. Run test:
   npx jest [test-file] --verbose 2>&1
   or: npm test -- --testPathPattern=[file]
   or: python -m pytest [file] -v

4. If PASS:
   - Write MESSAGES: [timestamp] | T3_TESTER | T1_PLANNER | $ARGUMENTS: PASS (X/X tests)
   - Add note to task row: T3:PASS
   - Print: "$ARGUMENTS PASSED (X test cases)"

5. If FAIL:
   - For each failure, call /report-bug immediately:
     Task: $ARGUMENTS
     Description: specific error message
     Severity: based on error type (assertion fail = HIGH, crash = CRITICAL)
   - Write message: [timestamp] | T3_TESTER | T2_IMPLEMENTER | $ARGUMENTS: FAIL. X bugs filed (B-XXX).
   - Print: "$ARGUMENTS FAILED - X failures filed as bugs"

6. Always print full test output so T2 can debug.