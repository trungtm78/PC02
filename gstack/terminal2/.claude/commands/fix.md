Argument: $ARGUMENTS (bug ID, e.g.: B-001)

1. Read ../shared/todo.md, find bug with ID = $ARGUMENTS in BUG TRACKER
2. If not found or status = VERIFIED -> report and stop
3. Read bug description, severity, and related TaskID

4. Analyze and fix:
   - Find code file related to that task
   - Read test output/error message in bug description
   - Implement fix
   - Re-run test to verify fix is correct

5. Update BUG TRACKER in todo.md:
   - status: OPEN -> FIXED
   - Fixed_by: T2_IMPLEMENTER
   - Updated: [timestamp]

6. Write message:
   [timestamp] | T2_IMPLEMENTER | T3_TESTER | Bug $ARGUMENTS fixed. Please retest [TaskID].

7. Update related task: FAILED -> FIXED_PENDING_RETEST

8. Print summary:
   Fixed: $ARGUMENTS
   Bug: [description]
   Fix: [what was changed]
   Status: FIXED -> Notified T3 to retest