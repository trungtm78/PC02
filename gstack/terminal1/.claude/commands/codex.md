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