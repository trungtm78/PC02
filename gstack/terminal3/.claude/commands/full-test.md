Run full test suite and create a complete report.

1. Run all tests:
   npx jest --coverage --verbose 2>&1
   or: npm test 2>&1
   or: python -m pytest --cov=. -v 2>&1

2. Parse results:
   - Total tests: X
   - Pass: X
   - Fail: X
   - Coverage: X%

3. For each FAIL:
   - Auto /report-bug for that failure
   - Severity: CRITICAL if crash, HIGH if wrong result, MEDIUM if edge case

4. Write to MESSAGES:
   [timestamp] | T3_TESTER | T1_PLANNER | Full test: X/X pass, coverage X%, X bugs filed
   [timestamp] | T3_TESTER | T2_IMPLEMENTER | [If bugs]: X bugs need fixing. See BUG TRACKER.

5. Update COMPLETION SUMMARY:
   total_tasks: X
   done: X
   bugs_found: X
   coverage: X%

6. Print full report:
   =======================================
     T3_TESTER - FULL TEST REPORT
     [timestamp]
   =======================================
     UT Tests:   X/X pass
     IT Tests:   X/X pass
     Coverage:   X%
     Bugs filed: X
     VERDICT: ALL PASS / NEEDS FIXES
   =======================================

7. If all PASS and coverage >= 80%:
   - Write: T3_TESTER -> T1_PLANNER: ALL TESTS PASS. Coverage: X%. Ready to ship.
   - Update T3_TESTER status: DONE | All tests pass

8. If failures:
   - Update T3_TESTER status: WAITING_FIXES | X bugs filed