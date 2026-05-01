Argument: $ARGUMENTS (task ID, e.g.: UT-001)

Review code quality of the test file for task $ARGUMENTS.

Review checklist:
  [ ] Test file exists with correct naming convention
  [ ] describe() block clear, sentence case
  [ ] it() descriptions describe behavior (not implementation)
  [ ] beforeEach/afterEach cleanup present
  [ ] No test interdependencies (tests are independent)
  [ ] Happy path tested
  [ ] Error cases tested
  [ ] Edge cases tested
  [ ] No hardcoded strings/values (use constants)
  [ ] No console.log/console.error in tests
  [ ] Mocks reset after each test
  [ ] Specific assertions (not just toBeTruthy())
  [ ] Coverage sufficient for this module

For each issue found:
- Severity MEDIUM: code smell, does not affect result
- Severity LOW: style issue

Write review to MESSAGES:
[timestamp] | T3_TESTER | T2_IMPLEMENTER | Review $ARGUMENTS: [PASS/X issues] - [summary]

Print result:
  CODE REVIEW: $ARGUMENTS
  Pass:   X items
  Issues: X items
  [list of issues if any]
  Verdict: APPROVED / NEEDS_MINOR_FIXES / NEEDS_MAJOR_FIXES