$ErrorActionPreference = "Stop"

function Write-UTF8 {
    param([string]$Path, [string]$Content)
    $dir = Split-Path $Path
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $Path), $Content, $utf8)
}

Write-Host "[1/5] Creating folders..." -ForegroundColor Cyan
$dirs = @(
    'gstack\shared',
    'gstack\terminal1\.claude\commands',
    'gstack\terminal2\.claude\commands',
    'gstack\terminal3\.claude\commands'
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
Write-Host "      OK" -ForegroundColor Green

Write-Host "[2/5] Creating shared\todo.md..." -ForegroundColor Cyan
Write-UTF8 'gstack\shared\todo.md' @'
# GSTACK SHARED CONTEXT
> File nay la trung tam giao tiep giua tat ca terminals.
> Moi terminal poll file nay. Khong ai duoc xoa noi dung cu - chi append hoac update dung field.

---

## PROJECT
```
name:    (chua co)
goal:    (chua co)
status:  PENDING_PLAN
```

---

## PLAN APPROVAL
```
plan_written:    false
codex_approved:  false
codex_score:     -
codex_loops:     0
plan_approved:   false
approved_by:     -
approved_at:     -
```

---

## TASKS

| ID    | Description           | Type | Priority | Owner          | Status      | Codex  | Updated    |
|-------|-----------------------|------|----------|----------------|-------------|--------|------------|
| -     | (chua co tasks)       | -    | -        | -              | -           | -      | -          |

<!--
Status: TODO | IN_PROGRESS | DONE | NEEDS_REVISION | FAILED | BLOCKED
Codex:  -    | PENDING     | PASS | FAIL
-->

---

## BUG TRACKER

| BugID | TaskID | Source     | Description       | Severity | Status | Fixed_by  | Updated    |
|-------|--------|------------|-------------------|----------|--------|-----------|------------|
| -     | -      | -          | (chua co bugs)    | -        | -      | -         | -          |

<!--
Source:   T3_TESTER | CODEX
Severity: CRITICAL | HIGH | MEDIUM | LOW
Status:   OPEN | FIXED | VERIFIED
-->

---

## MESSAGES

| Time           | From           | To             | Message                    |
|----------------|----------------|----------------|----------------------------|
| -              | -              | -              | (chua co messages)         |

---

## TERMINAL STATUS
```
T1_PLANNER:     IDLE | (chua bat dau)
T2_IMPLEMENTER: IDLE | (cho plan)
T3_TESTER:      IDLE | (cho codex gate)
CODEX:          IDLE | (chua chay)
```

---

## CODEX LOG
| Time | Mode | Target | Score | Verdict | Loops | Issues_fixed |
|------|------|--------|-------|---------|-------|--------------|
| -    | -    | -      | -     | -       | -     | -            |

---

## COMPLETION SUMMARY
```
total_tasks:   0
done:          0
failed:        0
bugs_found:    0
bugs_fixed:    0
codex_reviews: 0
coverage:      -
final_status:  PENDING
```
'@

Write-Host "[3/5] Creating Terminal 1 files (Planner)..." -ForegroundColor Cyan
Write-UTF8 'gstack\terminal1\CLAUDE.md' @'
# Terminal 1 - Planner & Monitor

## Role
You are T1_PLANNER. You create the test plan, monitor progress, and report to Human.

## Shared context
All communication via file: ../shared/todo.md
- Read this file to know current state
- Write to this file to send commands to T2/T3

## Your slash skills
/plan         - create a new test plan
/codex plan   - AI review and auto-improve the plan
/codex code   - AI review code T2 just implemented
/codex code UT-001  - review a specific task
/status       - view current progress
/approve      - approve plan after Human confirms (only after codex passes)
/report       - generate final summary report

## Workflow

### When Human gives a new requirement
1. Analyze requirements
2. Run /plan -> create UT + IT task list
3. Write plan to shared/todo.md (TASKS section)
4. Run /codex plan -> AI review, auto-fix loop until approved
5. After codex APPROVED: tell Human "Plan ready. Run /approve when you agree."
6. DO NOT allow Human to /approve if codex has not passed

### When T2 reports a task done
1. Auto-run /codex code <task-id> when T2 message received
2. If codex APPROVED -> write message for T3 to test
3. If codex NEEDS_REVISION -> codex asks T2 to fix, do not forward to T3

### After Human approves
1. Update plan_approved: true in todo.md
2. Write message: T1 -> T2: Plan approved. Start implementing all TODO tasks.
3. Update T1_PLANNER status: MONITORING
4. Start polling using /status periodically

### When polling (using /status)
- Read todo.md
- If new DONE task -> log it
- If OPEN bugs -> check severity, alert if CRITICAL
- If all tasks DONE + bugs VERIFIED -> run /report

### When everything is complete
1. Run /report
2. Update COMPLETION SUMMARY in todo.md
3. Notify Human: "All done. See /report for details."

## Rules
- DO NOT implement code yourself
- DO NOT run tests yourself
- Only write to: TASKS, PLAN APPROVAL, MESSAGES, TERMINAL STATUS, COMPLETION SUMMARY sections
- Always use timestamp YYYY-MM-DD HH:MM when writing messages
'@

Write-UTF8 'gstack\terminal1\.claude\commands\plan.md' @'
Read file ../shared/todo.md to understand the current project.

Then create a detailed testing plan:
1. Analyze source code to test (if Human provided a path)
2. List all Unit Tests needed (prefix: UT-)
3. List all Integration Tests needed (prefix: IT-)
4. Estimate priority: HIGH/MEDIUM/LOW

Write results to ../shared/todo.md in the TASKS table format:
| UT-001 | Test [function name] - [case] | UT | HIGH | T2_IMPLEMENTER | TODO | [timestamp] |
| IT-001 | Test [integration point]      | IT | HIGH | T2_IMPLEMENTER | TODO | [timestamp] |

Then update:
  plan_written: true
  T1_PLANNER: WAITING_APPROVAL | Plan written with X tasks

Finally print a plan summary and instruct Human to run /approve to start.
'@

Write-UTF8 'gstack\terminal1\.claude\commands\codex.md' @'
# /codex - AI Quality Gate
#
# Usage:
#   /codex plan         -> review plan before Human approves
#   /codex code         -> review code T2 just implemented
#   /codex code UT-001  -> review a specific task
#
# /codex NEVER skips issues. It loops until the standard is met.

Argument: $ARGUMENTS   (plan | code | code <TASK-ID>)

---

## STEP 1 - Gather context

Read ../shared/todo.md for full current state.

If $ARGUMENTS starts with "plan":
- Read TASKS section in todo.md (this is the plan T1 just wrote)
- Read PROJECT goal
- Mode = PLAN_REVIEW

If $ARGUMENTS starts with "code":
- If specific task ID given: read that task test file
- If no task ID: read all test files for DONE tasks
- Read corresponding source code (to verify test intent is correct)
- Mode = CODE_REVIEW

---

## STEP 2 - Terminal self-review

For PLAN_REVIEW, check:
- Each task has clear ID (UT-XXX, IT-XXX)?
- Task description clear enough for T2 to implement without asking?
- Tests cover happy path, error cases, edge cases?
- IT tests cover actual integration points?
- Priority distribution reasonable?
- Task count reasonable for project scope?
- No duplicate or conflicting tasks?

For CODE_REVIEW, check:
- Test file exists and correct location?
- describe/it naming clear, describes behavior?
- beforeEach/afterEach cleanup present?
- No test interdependencies?
- Assertions specific (not just toBeTruthy/toBeDefined)?
- No hardcoded values, console.log?
- Mocks reset after each test?
- Edge cases handled?
- Estimated coverage >= 80%?

---

## STEP 3 - Call Claude API for independent review

Create temp script _codex_review.py and run it:

```python
import urllib.request, json, os

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
content_to_review = """[PASTE CONTENT TO REVIEW HERE]"""
mode = "[PLAN_REVIEW or CODE_REVIEW]"

if mode == "PLAN_REVIEW":
    system = """You are a senior QA architect reviewing a test plan.
Be strict. Respond in JSON only:
{
  "verdict": "APPROVED" or "NEEDS_REVISION",
  "score": 0-100,
  "critical_issues": ["issue1"],
  "suggestions": ["suggestion1"],
  "missing_coverage": ["missing1"],
  "revised_tasks": [{"id": "UT-XXX", "description": "improved", "reason": "why"}]
}"""
    user = f"Review this test plan:\n\n{content_to_review}"
else:
    system = """You are a senior engineer reviewing test code quality.
Be strict. Respond in JSON only:
{
  "verdict": "APPROVED" or "NEEDS_REVISION",
  "score": 0-100,
  "critical_issues": ["issue1"],
  "code_smells": ["smell1"],
  "missing_test_cases": ["case1"],
  "suggestions": [{"file": "xxx.test.ts", "fix": "what to change"}]
}"""
    user = f"Review this test code:\n\n{content_to_review}"

data = json.dumps({
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": user}],
    "system": system
}).encode()

req = urllib.request.Request(
    "https://api.anthropic.com/v1/messages",
    data=data,
    headers={
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
)
with urllib.request.urlopen(req) as r:
    result = json.loads(r.read())
    text = result["content"][0]["text"].strip().strip("`").lstrip("json").strip()
    review = json.loads(text)
    print(json.dumps(review, indent=2, ensure_ascii=False))
```

Run: python3 _codex_review.py
Parse JSON output -> save to api_verdict.

---

## STEP 4 - Combine results (Terminal + API)

Combine both evaluation sources:

  CODEX REVIEW - [PLAN/CODE] - [timestamp]
  Terminal check: X issues
  Claude API score: X/100
  Combined verdict: APPROVED / NEEDS_REVISION

  CRITICAL ISSUES: [combined deduplicated list]
  SUGGESTIONS:     [suggestions list]
  MISSING:         [what is not yet tested]

Verdict logic:
- APPROVED: 0 critical issues + API score >= 80 + terminal checklist >= 90%
- NEEDS_REVISION: any critical issue OR score < 80

---

## STEP 5 - If NEEDS_REVISION: auto feedback loop

For PLAN_REVIEW:
1. For each revised_tasks from API: update task description in TASKS
2. For each missing_coverage: add new tasks to TASKS (status TODO)
3. Write message: [timestamp] | CODEX | T1_PLANNER | Plan revised: X tasks updated. Re-running codex...
4. Delete temp script _codex_review.py
5. Auto re-run /codex plan (loop, max 3 times)

If still NEEDS_REVISION after 3 loops:
- Write message to Human: "CODEX: Plan needs Human direct review. Issues: [list]"
- Stop loop and wait

For CODE_REVIEW:
1. File issues to BUG TRACKER (severity: MEDIUM or HIGH, Source: CODEX)
2. Write message: [timestamp] | CODEX | T2_IMPLEMENTER | Code review failed (score: X/100). X issues filed. Fix and resubmit.
3. Update task status: DONE -> NEEDS_REVISION
4. Delete temp script _codex_review.py
5. Wait for T2 to fix (poll todo.md, when task -> DONE again, auto re-run /codex code <task-id>)

If still fail after 3 loops:
- Escalate to Human with full context
- Stop

---

## STEP 6 - If APPROVED

For PLAN_REVIEW:
- Write MESSAGES: [timestamp] | CODEX | T1_PLANNER | Plan APPROVED (score: X/100). Ready for Human final approval.
- Update PLAN APPROVAL: codex_approved: true, codex_score: X
- Print: "CODEX: Plan meets standards. Human can run /approve."

For CODE_REVIEW:
- Write MESSAGES: [timestamp] | CODEX | T3_TESTER | Code APPROVED (score: X/100). Ready to test: [task-id]
- Update task: add note "CODEX:PASS"
- Print: "CODEX: Code meets standards. T3 can start testing."

---

## Cleanup
Delete _codex_review.py when done.

Write log to ../shared/todo.md (CODEX LOG section):
[timestamp] | [mode] | [task/plan] | score: X | verdict: Y | loops: Z | issues_fixed: W
'@

Write-UTF8 'gstack\terminal1\.claude\commands\approve.md' @'
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
'@

Write-UTF8 'gstack\terminal1\.claude\commands\status.md' @'
Read ../shared/todo.md and print a summary dashboard:

===================================================
  GStack Status - T1_PLANNER
  [timestamp]
===================================================

PROJECT: [project name]
Status:  [status]

TASKS:
  DONE:        X / Total
  IN_PROGRESS: X
  TODO:        X
  FAILED:      X

BUGS:
  OPEN:     X (CRITICAL: X, HIGH: X)
  FIXED:    X
  VERIFIED: X

RECENT MESSAGES (last 3):
  [show last 3 messages]

TERMINAL STATUS:
  T1: [status]
  T2: [status]
  T3: [status]

NEXT ACTION:
  [analyze and suggest appropriate next step]
===================================================

If CRITICAL bug found open: print warning and write message to T2.
If all tasks DONE and no OPEN bugs: suggest running /report.
'@

Write-UTF8 'gstack\terminal1\.claude\commands\report.md' @'
Read all of ../shared/todo.md and create a full final report:

==================================================
  GSTACK FINAL REPORT
  [Project Name]
  [Date]
==================================================

OVERVIEW:
- Project: [name]
- Result:  SUCCESS / FAILED

TASK SUMMARY:
- Total:   X (UT: X, IT: X)
- Passed:  X
- Failed:  X

BUG SUMMARY:
- Found:     X
- Fixed:     X
- Remaining: X

TEST COVERAGE:
- Coverage: X%
- UT pass:  X%
- IT pass:  X%

TASK DETAILS:
[List all tasks with final status]

BUG DETAILS:
[List all bugs found and fixed]

VERDICT: APPROVED / NEEDS_FIXES / FAILED
[Reason]
==================================================

Update COMPLETION SUMMARY in todo.md with final numbers.
Write final message: T1_PLANNER -> ALL: Project completed. Final status: [status].
Update PROJECT status to COMPLETED or NEEDS_FIXES.
'@

Write-Host "      OK" -ForegroundColor Green

Write-Host "[4/5] Creating Terminal 2 files (Implementer)..." -ForegroundColor Cyan
Write-UTF8 'gstack\terminal2\CLAUDE.md' @'
# Terminal 2 - Implementer

## Role
You are T2_IMPLEMENTER. You implement Unit Tests and Integration Tests per the plan,
and fix bugs when T3 reports them or /codex requests changes.

## Shared context
All communication via file: ../shared/todo.md
- Poll this file to receive new tasks and bug reports
- Update this file after every action

## Your slash skills
/poll             - check for new tasks from shared context
/implement UT-001 - implement a specific task
/fix B-001        - fix a specific bug
/done all         - report all tasks complete

## Workflow

### Startup
1. Run /poll to check if plan is approved
2. If plan_approved: true -> start implementing TODO tasks one by one
3. If not -> wait and poll again after 30 seconds

### Implement a task
1. Read task description from TASKS
2. Implement corresponding test code
3. Run test to verify syntax OK
4. Log to MESSAGES
5. Update task status -> DONE
6. Write message to T1_PLANNER: "T2->T1: [task-id] done. Please run /codex code [task-id]."
7. WAIT - T1 runs /codex, only forward to T3 if APPROVED

### When receiving CODEX revision request (via T1)
1. /poll -> find message with "CODEX | T2_IMPLEMENTER" in MESSAGES
2. Read issues in BUG TRACKER (Source = CODEX)
3. Fix each issue per codex suggestions
4. Update bug status -> FIXED
5. Update task: NEEDS_REVISION -> DONE
6. Write message: "T2->T1: [task-id] revised. Please re-run /codex."

### When receiving bug report from T3 (real test failures)
1. /poll to see new bugs in BUG TRACKER
2. Read bug description
3. /fix B-XXX -> analyze and fix code
4. Update bug status -> FIXED
5. Write message to T3: "B-XXX fixed, please retest"

## UT format
```
describe("[ModuleName]", () => {
  beforeEach(() => { /* setup */ });
  afterEach(() => { /* cleanup */ });
  it("should [expected behavior] when [condition]", async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Rules
- Always run test after writing to check syntax
- Mark task IN_PROGRESS when starting, DONE when finished
- DO NOT mark DONE if test has not run successfully
- DO NOT message T3 directly - must go through T1 + /codex
- Priority: CRITICAL bugs > CODEX revisions > HIGH tasks > MEDIUM > LOW
- When all tasks done: write T2->T1: "All done. Please run /codex code all."
'@

Write-UTF8 'gstack\terminal2\.claude\commands\poll.md' @'
Read ../shared/todo.md and show what is relevant to T2_IMPLEMENTER:

1. Check plan_approved - if false, print: "Waiting for Human to approve plan. Poll again later."

2. If plan_approved = true, show:

MY TASKS (T2_IMPLEMENTER):
  TODO:        [list of task IDs]
  IN_PROGRESS: [list]
  DONE:        [list]

BUGS FOR ME TO FIX:
  [B-ID] [severity]: [description]
  (or "No new bugs")

MESSAGES TO ME:
  [messages where To = T2_IMPLEMENTER or ALL]

3. Suggest next action:
- If CRITICAL bug exists  -> "Fix B-XXX now: /fix B-XXX"
- If TODO task exists     -> "Implement next: /implement [task-id]"
- If all DONE, no bugs    -> "All done. Notify T1."

Update T2_IMPLEMENTER status in TERMINAL STATUS.
'@

Write-UTF8 'gstack\terminal2\.claude\commands\implement.md' @'
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
'@

Write-UTF8 'gstack\terminal2\.claude\commands\fix.md' @'
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
'@

Write-UTF8 'gstack\terminal2\.claude\commands\done.md' @'
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
'@

Write-Host "      OK" -ForegroundColor Green

Write-Host "[5/5] Creating Terminal 3 files (Tester)..." -ForegroundColor Cyan
Write-UTF8 'gstack\terminal3\CLAUDE.md' @'
# Terminal 3 - Tester & Code Reviewer

## Role
You are T3_TESTER. You run tests, review code, report bugs,
and confirm when everything passes.

## Shared context
All communication via file: ../shared/todo.md
- Poll this file to know when T1 forwards a task (after codex passes)
- Write bug reports and test results here

## Your slash skills
/poll                          - check which tasks are ready to test (passed codex gate)
/test UT-001                   - test a specific task
/review UT-001                 - review code of a specific task
/report-bug UT-002 "desc" HIGH - report a bug
/verify B-001                  - confirm a bug has been fixed
/full-test                     - run full test suite and summarize

## Workflow

### Trigger to start testing
Poll ../shared/todo.md, when you see:
- Message from T1: "CODEX PASS. T3 -> test [task-id]" -> test that task immediately
- Message from T1: "All done" (after T1 codex passed all) -> run /full-test
- Bug status = FIXED -> run /verify to retest

### Test a task
1. /test [task-id] -> run corresponding test file
2. If PASS -> add note to task (T3:PASS) + message T1
3. If FAIL -> /report-bug for each failure -> message T2

### Code review (parallel with testing)
- /review [task-id] -> check code quality
- Checklist: naming, coverage, cleanup, no hardcoded values, edge cases

## Rules
- Only receive tasks when T1 forwards them (after codex APPROVED)
- Test immediately when T1 notifies - do not wait for all tasks
- Always retest after T2 fixes a bug
- Do not approve if coverage < 80%
- Write enough info for T2 to reproduce the bug
- When all pass: write T3->T1: "All tests PASS. Coverage: X%."
'@

Write-UTF8 'gstack\terminal3\.claude\commands\poll.md' @'
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
'@

Write-UTF8 'gstack\terminal3\.claude\commands\test.md' @'
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
'@

Write-UTF8 'gstack\terminal3\.claude\commands\report-bug.md' @'
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
'@

Write-UTF8 'gstack\terminal3\.claude\commands\verify.md' @'
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
'@

Write-UTF8 'gstack\terminal3\.claude\commands\full-test.md' @'
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
'@

Write-UTF8 'gstack\terminal3\.claude\commands\review.md' @'
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
'@

Write-UTF8 'gstack\README.md' @'
# GStack Multi-Agent - Quick Start

## Structure
gstack\
  shared\todo.md                       <- shared communication hub
  terminal1\CLAUDE.md                  <- T1 Planner system prompt
  terminal1\.claude\commands\          <- /plan /codex /approve /status /report
  terminal2\CLAUDE.md                  <- T2 Implementer system prompt
  terminal2\.claude\commands\          <- /poll /implement /fix /done
  terminal3\CLAUDE.md                  <- T3 Tester system prompt
  terminal3\.claude\commands\          <- /poll /test /report-bug /verify /full-test /review

## How to start

Open 3 separate terminal windows:

  Terminal 1 (Planner):
    cd gstack\terminal1
    claude --dangerously-skip-permissions

  Terminal 2 (Implementer):
    cd gstack\terminal2
    claude --dangerously-skip-permissions

  Terminal 3 (Tester):
    cd gstack\terminal3
    claude --dangerously-skip-permissions

## Workflow
1. Tell Terminal 1 your requirement
2. T1 runs /plan -> /codex plan (auto) -> notifies Human to /approve
3. Human tells T1: /approve
4. T2 polls -> /implement each task -> notifies T1
5. T1 auto runs /codex code after each task T2 finishes
6. T3 polls -> /test after codex PASS -> loop: T3 reports bug -> T2 fixes -> T3 verifies
7. T1 runs /report when all done

## All communications go through: gstack\shared\todo.md
Terminals DO NOT talk directly - only through this file.
'@

Write-Host "      OK" -ForegroundColor Green
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  GStack init COMPLETE" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Get-ChildItem -Recurse -Path 'gstack' | Where-Object { !$_.PSIsContainer } | ForEach-Object {
    Write-Host ("  " + $_.FullName.Replace((Get-Location).Path + '\', ''))
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open 3 terminal windows"
Write-Host "  2. cd gstack\terminal1  ->  claude --dangerously-skip-permissions"
Write-Host "  3. cd gstack\terminal2  ->  claude --dangerously-skip-permissions"
Write-Host "  4. cd gstack\terminal3  ->  claude --dangerously-skip-permissions"
Write-Host "  5. Tell Terminal 1 what you need"
Write-Host ""
