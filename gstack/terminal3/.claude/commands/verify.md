Argument: $ARGUMENTS (Bug ID, e.g.: B-001)

1. Read ../shared/todo.md, find bug $ARGUMENTS
2. Check status = FIXED - if not -> report error and stop
3. Find related task and its test file
4. Re-run test for that task:
   npx jest [test-file] --verbose 2>&1

5. If test PASS (bug fixed):
   - Update BUG TRACKER: status FIXED -> VERIFIED
   - Write message: [timestamp] | T3_TESTER | T1_PLANNER | Bug $ARGUMENTS VERIFIED fixed. Test passing.
   - Update task status if needed: FIXED_PENDING_RETEST -> DONE
   - Print: "B-XXX VERIFIED - Fix confirmed, test passing"

6. If test still FAIL (bug not fixed):
   - Update bug: FIXED -> OPEN (reopen)
   - Write message: [timestamp] | T3_TESTER | T2_IMPLEMENTER | Bug $ARGUMENTS NOT fixed. Still failing. Please rework.
   - Print: "B-XXX NOT FIXED - Test still failing, returned to T2"