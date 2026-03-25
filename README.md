# fugue

**AI agents in concert.** A conductor-based PMO that orchestrates your AI agents into production-grade harmony.

> In music, a fugue is a composition where multiple voices enter one by one, each following strict rules,
> building into a complex yet perfectly structured whole. That's exactly how fugue manages your AI agents.

```bash
npm install -g fugue-cli
```

---

## What is fugue?

fugue sits **between your code editor and your project board**. It doesn't write code — it orchestrates AI agents to analyze, audit, and govern your project.

```
Your AI tools:
+-------------+  +----------+  +----------+  +----------+
| Claude Code |  |  Cursor  |  |  Codex   |  |  Ollama  |
+------+------+  +-----+----+  +-----+----+  +-----+----+
       |               |             |              |
       +-------+-------+------+------+------+-------+
               |
         +-----v-----+
         |   fugue   |  <-- conductor-based orchestration
         | (PMO/audit)|      model-agnostic, any LLM/SLM
         +-----------+
```

### Core Architecture

1. **Model Registry** — register any model you have access to
2. **Conductor** — pick your orchestrator model (the "maestro")
3. **AIOps** — automatic model assignment per agent role (voices)
4. **Agents** — auto-generated from project analysis, with logs and evaluation

---

## Quick Start

```bash
# 1. Initialize (auto-detects models, picks conductor)
cd my-project
fugue init

# 2. Reverse-engineer (or import plan)
fugue snapshot          # code -> agents -> REQs
# or
fugue plan import ./planning-doc.md
fugue plan decompose
fugue plan confirm
```

---

## Daily Usage

### Morning Check

```bash
$ fugue status --deliverables
  D.01 Planning Doc        ✓ imported
  D.02 Requirements        ✓ 38 confirmed
  D.03 Traceability Matrix ◉ 17/38 mapped
  D.05 Implementation      ◉ 12/38 done
  D.06 Tests               △ 12/38 pass
  D.07 Audit Report        ○ gate not run
```

### After Coding

```bash
$ fugue audit --gate
  PASS  REQ-001: User login
  WARN  REQ-012: Payment — no tests
  TODO  REQ-025: New code detected, no REQ mapped
  Gate: CONDITIONAL PASS (2 issues)
```

### Progressive Control (Task Mode)

```bash
$ fugue task new "Payment refund feature" --requester PM-Kim
$ fugue task import TASK-001 ./refund-spec.md
$ fugue task validate TASK-001    # conductor checks doc quality
$ fugue task decompose TASK-001   # extract REQ IDs
$ fugue task confirm TASK-001     # requester approves
$ fugue task assign TASK-001 --to dev-Park
$ fugue task done TASK-001        # auto-verify + report to requester
```

### Check Agents

```bash
$ fugue agent list
  ★ Conductor: maestro (claude-opus, subscription)

  🏗  Architects
    pipeline-architect    claude-opus    3 runs    100%

  🔍 Domain Analysts
    api-analyst           ollama:qwen2.5:7b    12 runs    92%

  🛡  Auditors
    security-auditor      gemini-pro    5 runs    100%
```

---

## Two Ways to Start

### Path 1: Reverse — You already have code

```bash
fugue snapshot    # conductor analyzes → agents extract REQs
```

### Path 2: Forward — You have a planning doc

```bash
fugue plan import ./spec.md
fugue plan decompose
fugue plan confirm
```

Both paths converge into the same deliverable tree (D.01-D.08).

---

## CLI Reference

```
fugue
├── init                        # Initialize + auto-detect models + pick conductor
├── setup                       # Re-scan models
├── model add/list/remove       # Model registry
├── model usage                 # Token usage + cost per model
├── config set/show             # Configuration (conductor, conductor-name)
├── snapshot [review|apply|discard]  # Reverse-engineer (staging workflow)
├── plan import/decompose/confirm    # Forward path
├── task new/import/validate/decompose/confirm/assign/done/escalate/list/show/report
├── audit [--quick|--gate]      # Audit (gap detection, gate judgment)
├── agent list/log/eval         # Agent governance
├── status [--deliverables]     # Project overview
├── report                      # HTML progress report
├── notify add/list/remove/test # Notification plugins (Slack)
├── diagnose                    # T-shirt Sizing (XS~XL) + methodology
├── gate [--phase N]            # Phase Gate scoring (100-point)
├── deliver [task-id]           # Formal delivery judgment + report
├── workflow run/list/show/define  # Repeatable multi-step workflows
└── admin overview/usage/register  # Cross-project monitoring
```

---

## Workflows

Repeatable patterns with human checkpoints:

```bash
# New feature (7 steps: auto → gate → gate → manual → manual → gate → auto)
fugue workflow run feature ./spec.md --requester PM-Kim

# Bug fix (lighter process)
fugue workflow run bugfix ./bug-report.md --requester QA

# Reverse-engineer existing code
fugue workflow run reverse

# Regular audit
fugue workflow run review

# Define custom workflow
fugue workflow define my-process
```

Step types: `auto` (runs and continues), `gate` (pauses for review), `manual` (waits for human).

```bash
$ fugue workflow show feature
  1. new+import     [auto]    Create task and import planning doc
  2. validate       [gate]    Validate planning doc quality
  3. decompose      [gate]    Decompose into REQ IDs
  4. confirm        [manual]  Requester confirms REQs
  5. assign         [manual]  Assign worker(s)
  6. done           [gate]    Auto-verify REQs
  7. deliver        [auto]    Generate delivery report
```

---

## Project Lifecycle

```bash
fugue diagnose              # Size: M (medium). Crosscheck required.
fugue gate --phase 1        # P1→P2: 82/100 PASS
fugue deliver               # DELIVERY: APPROVED → report generated
fugue admin overview        # All projects at a glance
```

---

## Design Principles

1. **Protocol layer, not execution.** fugue manages roles/manuals/logs. Models do the work.
2. **Model-agnostic.** Works with any LLM/SLM. Switch conductors anytime.
3. **SLM-first, not SLM-forced.** Default to local models. Use LLM when performance demands it.
4. **File-based.** No database. Everything in `.fugue/`, trackable with git.
5. **Conductor pattern.** One model orchestrates, others execute. Like a fugue.
6. **Observable.** Every agent action is logged. Evaluate performance anytime.
7. **Progressive control.** Start with one task, grow to full project governance.

---

## Built by

[Maskit](https://maskit.co.kr) — a 6-person B2B SaaS startup running 15+ AI agent roles in production.

## License

Apache 2.0
