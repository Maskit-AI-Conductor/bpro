# bpro

**Beyond Prototype.** Conductor-based AI PMO that turns side projects into production-grade software.

> bpro is a **protocol layer** — it manages agent roles, manuals, and logs. Actual execution runs through the models you choose: Claude, GPT, Gemini, Ollama, or any OpenAI-compatible endpoint.

```bash
npm install -g bpro-cli   # coming soon
# or
npx bpro-cli
```

---

## What is bpro?

bpro sits **between your code editor and your project board**. It doesn't write code — it orchestrates AI agents to analyze, audit, and govern your project.

```
Your AI tools:
+-------------+  +----------+  +----------+  +----------+
| Claude Code |  |  Cursor  |  |  Codex   |  |  Ollama  |
+------+------+  +-----+----+  +-----+----+  +-----+----+
       |               |             |              |
       +-------+-------+------+------+------+-------+
               |
         +-----v-----+
         |   bpro    |  <-- conductor-based orchestration
         | (PMO/audit)|      model-agnostic, any LLM/SLM
         +-----------+
```

### Core Architecture

1. **Model Registry** — register any model you have access to
2. **Conductor** — pick your orchestrator model (the "maestro")
3. **AIOps** — automatic model assignment per agent role
4. **Agents** — auto-generated from project analysis, with logs and evaluation

---

## Quick Start

```bash
# 1. Initialize
cd my-project
bpro init

# 2. Register models
bpro model add ollama:qwen2.5:7b --endpoint http://localhost:11434
bpro model add claude-opus --api-key sk-xxx
bpro model add gemini-pro --api-key xxx

# 3. Pick conductor
bpro config set conductor claude-opus

# 4. Reverse-engineer (or import plan)
bpro snapshot          # code -> agents -> REQs
# or
bpro plan import ./planning-doc.md
bpro plan decompose
bpro plan confirm
```

---

## Daily Usage

### Morning Check: "Where are we?"

```bash
$ bpro status
  ■■■■■■■░░░░░░░  12/38 REQs done (32%)

  DONE: 12 | DEV: 5 | CONFIRMED: 18 | DRAFT: 3

  Code mapped: 17/38 | Tests mapped: 12/38

$ bpro status --deliverables
  D.01 Planning Doc        ✓ imported
  D.02 Requirements        ✓ 38 confirmed
  D.03 Traceability Matrix ◉ 17/38 mapped
  D.05 Implementation      ◉ 12/38 done
  D.06 Tests               △ 12/38 pass
  D.07 Audit Report        ○ gate not run
```

### After Coding: "Did I break anything?"

```bash
$ bpro audit --gate
  PASS  REQ-001: User login
  WARN  REQ-012: Payment — no tests
  TODO  REQ-025: New code detected, no REQ mapped
  ─────────────────────────────────
  Gate: CONDITIONAL PASS (2 issues)
```

### Check Agent Performance

```bash
$ bpro agent list
  conductor              architect     claude-opus          3 runs
  Auth Analyst           domain-analyst ollama:qwen2.5:7b   12 runs
  Payment Auditor        auditor       gemini-pro           5 runs

$ bpro agent eval
  conductor    runs: 3  success: 100%  failures: 0
  Auth Analyst runs: 12 success: 92%   failures: 1
```

### Weekly Report

```bash
$ bpro report
  -> .bpro/reports/2026-03-24-progress.html generated
```

---

## Two Ways to Start

### Path 1: Reverse — You already have code

```bash
$ bpro init
$ bpro model add ollama:qwen2.5:7b
$ bpro config set conductor ollama:qwen2.5:7b
$ bpro snapshot
# Conductor analyzes project structure
# AIOps assigns models to agent roles
# Domain analysts extract requirements per domain
# Auditor cross-validates
# -> REQs + matrix + agent definitions saved to .bpro/
```

### Path 2: Forward — You have a planning doc

```bash
$ bpro init
$ bpro plan import ./planning-doc.md
$ bpro plan decompose    # conductor extracts REQ IDs
$ bpro plan confirm      # lock REQs, start dev phase
```

---

## CLI Reference

```
bpro
├── init                          # Initialize .bpro/ in current directory
├── model
│   ├── add <name> [--endpoint] [--api-key]  # Register model
│   ├── list                      # List registered models
│   └── remove <name>             # Remove model
├── config
│   ├── set conductor <model>     # Pick conductor model
│   └── show                      # Show current configuration
├── snapshot                      # Reverse-engineer (conductor -> agents -> REQs)
├── plan
│   ├── import <file>             # Import planning document
│   ├── decompose                 # Extract REQ IDs (conductor)
│   └── confirm                   # Confirm REQs, start dev phase
├── audit [--quick] [--gate]      # Run audit (gap detection, gate)
├── agent
│   ├── list                      # List agents with stats
│   ├── log <name>                # View agent work log
│   └── eval                      # Evaluate agent performance
├── status [--deliverables]       # Project overview
└── report                        # Generate HTML report
```

---

## Model Adapters

bpro supports any model through adapters:

| Provider | Endpoint | Auth |
|----------|----------|------|
| **Ollama** | `http://localhost:11434` | None (local) |
| **Anthropic** (Claude) | `api.anthropic.com` | `ANTHROPIC_API_KEY` or `--api-key` |
| **OpenAI** (GPT) | `api.openai.com` | `OPENAI_API_KEY` or `--api-key` |
| **Gemini** | `generativelanguage.googleapis.com` | `GOOGLE_API_KEY` or `--api-key` |

API keys resolve in order: `--api-key` flag > environment variable > stored in models.yaml.

---

## .bpro/ Directory Structure

```
.bpro/
  config.yaml       # Project settings + conductor
  models.yaml       # Registered models (gitignored — contains keys)
  specs/            # REQ definitions (REQ-001.yaml, ...)
  matrix/           # Traceability matrix (REQ <-> code <-> test)
  tests/            # Test documents
  agents/           # Agent definitions (auto-generated by snapshot)
  logs/             # Agent work logs (JSONL)
  reports/          # Audit + progress reports
  plans/            # Imported planning documents
  changes/          # Change history
  .gitignore        # Protects credentials
```

---

## Snapshot Workflow (Core)

```
bpro snapshot
  │
  ├─ 1. Conductor analyzes project
  │     - File structure + source code -> domains + architecture
  │     - Generates agent roles (architect, domain-analyst, auditor)
  │
  ├─ 2. AIOps assigns models (rule-based)
  │     - Architect -> strongest model
  │     - Domain analyst -> SLM (cost optimization)
  │     - Auditor -> different model (cross-validation)
  │
  ├─ 3. Domain analysts extract requirements
  │     - Each domain analyzed by assigned model
  │     - REQs extracted per domain
  │
  └─ 4. Results saved to .bpro/
        - specs/REQ-001.yaml ~ REQ-NNN.yaml
        - matrix/matrix.yaml
        - agents/*.yaml
        - logs/*.jsonl
```

---

## Design Principles

1. **Protocol layer, not execution.** bpro manages roles/manuals/logs. Models do the work.
2. **Model-agnostic.** Works with any LLM/SLM. Switch conductors anytime.
3. **SLM-first.** AIOps assigns lightweight tasks to local models. LLM for reasoning.
4. **File-based.** No database. Everything in `.bpro/`, trackable with git.
5. **Conductor pattern.** One model orchestrates, others execute. Like an orchestra.
6. **Observable.** Every agent action is logged. Evaluate performance anytime.

---

## Development

```bash
# Build from source
git clone https://github.com/Maskit-AI-Conductor/bpro.git
cd bpro
npm install
npm run build

# Run locally
node dist/index.js --help

# Development mode (watch)
npm run dev
```

### Tech Stack

- **Node.js 18+** (LTS)
- **TypeScript** (strict mode)
- **Commander.js** — CLI framework
- **chalk + ora** — terminal UI
- **js-yaml** — YAML read/write
- **@inquirer/prompts** — interactive prompts

---

## Built by

[Maskit](https://maskit.co.kr) — a 6-person B2B SaaS startup running 15+ AI agent roles in production. bpro is extracted from our internal PMO system.

---

## License

Apache 2.0
