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