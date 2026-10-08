# SDLC model and token audit — 2026-10-07

## Scope and method

This audit covers the Case Governance SDLC sessions recorded under the local Codex session store for 2026-10-06 through 2026-10-07, plus the separate cross-model CLI review evidence stored in this worktree. The reusable script is `tools/case-governance/audit-sdlc-model-usage.cjs`.

The totals below exclude the root chat because its hosted session metadata is not present in the local session store. The current root controller identifies itself only as GPT-5 after a platform model switch, so no more specific SKU is inferred.

## Models actually used

| Model | Use | Sessions | Result |
|---|---:|---:|---|
| `gpt-6.1-sol` | Implementation, focused review, UI, evidence, legal and integration agents | 13 | Main delivery model |
| `gpt-6-astra` | Contract review and initial core foundation | 2 | High-value review/design work, but it was also used for implementation |
| `gpt-5.5` | Three ephemeral CLI review attempts | 3 | 255,100 tokens; one run was blocked from reading source, two text-only reviews produced findings with runtime limitations |
| `gpt-6.1-sol` CLI | One ephemeral review attempt | 1 | Exit 1 because the alias was unsupported in that ChatGPT CLI path; no review value |
| GPT-5, exact SKU unavailable | Current root controller after platform switch | 1 current session | Not included in local token totals |

## Local agent usage

| Agent | Model | Effort | Total tokens | Cached input |
|---|---|---:|---:|---:|
| `case_market_workflows` | gpt-6.1-sol | medium | 792,310 | 695,552 |
| `case_evidence_governance` | gpt-6.1-sol | medium | 914,834 | 826,240 |
| `case_security_rules` | gpt-6.1-sol | medium | 1,271,710 | 1,169,024 |
| `case_contract_review` | gpt-6-astra | medium | 610,902 | 552,192 |
| `case_core_foundation` | gpt-6-astra | medium | 4,035,980 | 3,899,136 |
| `case_canonical_information` | gpt-6.1-sol | medium | 44,379,944 | 43,667,328 |
| `case_evidence_implementation` | gpt-6.1-sol | medium | 119,560,732 | 117,577,344 |
| `case_core_foundation_resume` | gpt-6.1-sol | medium | 61,213,216 | 60,003,584 |
| `case_legal_workflows` | gpt-6.1-sol | medium | 58,267,709 | 57,298,304 |
| `case_t2_independent_review` | gpt-6.1-sol | high | 3,505,070 | 3,279,104 |
| `case_deadline_effect` | gpt-6.1-sol | high | 2,498,451 | 2,400,640 |
| `case_governance_ui` | gpt-6.1-sol | high | 84,926,944 | 83,285,760 |
| `case_child_access` | gpt-6.1-sol | high | 68,741,895 | 67,255,168 |
| `case_core_integration_finish` | gpt-6.1-sol | high | 35,490,210 | 34,748,928 |
| `case_t3_independent_review` | gpt-6.1-sol | high | 2,813,997 | 2,654,336 |

Agent subtotal: 489,023,904 tokens. Input was 487,006,906, of which 479,312,640 was cached input (98.42%). Output was 2,016,998, including 1,040,315 reasoning tokens. The five longest agents consumed about 80% of the subtotal.

These are usage counters, not a direct currency calculation. Cached input can be billed differently, but it still shows that oversized conversation context was repeatedly carried across turns.

## Root causes

1. Long-lived agents were reactivated for several rounds and sometimes repurposed across domains. Each new turn carried an increasingly large history.
2. Most workers inherited the full conversation rather than receiving a compact task packet with file paths and acceptance criteria.
3. Medium or high reasoning was used for deterministic work such as inventory, running commands, formatting evidence, and routine test closure.
4. Large diffs and logs were pasted into cross-model review contexts. The failed `gpt-5.5` source-read attempt alone used 47,126 tokens; two text-only reviews used another 207,974.
5. Full regression was started before all source groups were frozen. The frontend run produced 4,451 pass and 7 fail, which forced focused repair and another final run later.
6. Evidence was sometimes repeated in chat even though the raw artifacts already existed on disk.

## Adopted routing policy

| SDLC work | Default model | Reasoning | Escalation rule |
|---|---|---|---|
| Inventory, file discovery, command execution, log summary, fixture preparation | `gpt-6-luna` | low | Escalate only if interpretation affects requirements or security |
| Normal implementation and root-cause debugging | `gpt-6.1-sol` | low | Medium after the first evidence-backed hypothesis fails |
| Requirements and architecture synthesis | `gpt-6.1-sol` | low | One `gpt-6-astra` high review at the approval gate |
| Security, privacy, legal-rule and milestone review | `gpt-6-astra` | high | xhigh only for an unresolved confirmed critical ambiguity |
| UAT/monkey execution and evidence collection | `gpt-6-luna` | low | `gpt-6.1-sol` for defect diagnosis; Astra only for release-critical adjudication |
| Build, migration, release and deployment commands | Deterministic tools, orchestrated by `gpt-6.1-sol` | low | Human GO remains mandatory for production |

## Execution controls now adopted

- Maximum two concurrent agent threads by default.
- Every agent receives a bounded file list, acceptance criteria, and artifact paths. Full-history forks are avoided when a compact packet is sufficient.
- An agent ends after one bounded task and checkpoint. A different domain gets a new compact context.
- Targeted tests run per change; affected tests run after the task freeze; the full relevant suite runs once after the milestone source freeze.
- Raw logs, test JSON and coverage stay on disk. Model input contains only command, exit code, counts, hashes, findings, and paths.
- A failed cross-model/environment attempt is recorded once as `NO-RUN`; the same large package is not replayed.
- Independent review remains separate from implementation. Token savings cannot reduce scope, coverage thresholds, UAT, security checks, recovery rehearsal, or the human production GO gate.

## Configuration changes

- Global profiles: `luna-worker` low, `sol-dev` low, `astra-review` high, and `astra-critical` xhigh.
- Default global controller remains `gpt-6.1-sol` low.
- Current project config now uses Sol low, Luna low subagents, and a two-thread limit.
- `Setup_Codex_SDLC.bat` now creates projects with Sol low, Luna low subagents, two-thread default, and the same routing policy in `AGENTS.md` and the autonomous execution protocol.
- On rerun, the installer replaces only its marked `AGENTS.md` block and upgrades only an exact match of the old generated project config; surrounding instructions and custom model configs are preserved.
- RTK global hook registration was run. Codex commands still explicitly use the `rtk` prefix; the installer also reported a separate optional Claude settings step, which was not applied.

## Current Case Governance release state

The optimization does not change release truth: implementation is incomplete, the latest frozen full frontend evidence still has 7 failures, consolidated backend and frontend gates remain pending, and 856 critical UAT cases have not been executed. No Case Governance commit, push, merge, or production deployment is certified by this audit.
