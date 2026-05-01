Argument: $ARGUMENTS (task ID or "all")

If $ARGUMENTS is a specific task ID:
1. Update that task -> DONE in TASKS
2. Write message to T1 to codex review that task

If $ARGUMENTS is "all":
1. Check all T2_IMPLEMENTER tasks - any not yet DONE?
2. If any not DONE -> list them and ask "Are you sure you want to mark all done?"
3. If all are DONE:
   - Write message: [timestamp] | T2_IMPLEMENTER | T1_PLANNER | All tasks implemented. Run /codex code all then forward T3.
   - Write message: [timestamp] | T2_IMPLEMENTER | T1_PLANNER | Implementation complete. Waiting for codex + T3 results.
   - Update TERMINAL STATUS: T2_IMPLEMENTER: WAITING_CODEX_AND_TEST | All tasks done

Print summary of how many tasks were completed.