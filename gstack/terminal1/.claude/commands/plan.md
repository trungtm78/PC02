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