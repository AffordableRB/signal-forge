# SignalForge — Manager Brief

## What SignalForge Is

SignalForge is a deterministic business opportunity discovery engine.
It scans public internet sources for market signals, clusters them into opportunity candidates, scores them against 12 objective detectors, and produces ranked reports with confidence metrics.

It is not an AI agent. It is a data pipeline with bounded AI worker tasks.

## Current State

The system has 51 engine files across 12 modules:

- **10 collectors** (Reddit, HN, Google Trends, Autocomplete, Product Hunt, G2, Capterra, Trustpilot, Indeed, Pricing pages)
- **12 detectors** (demand, pain, ability-to-pay, competition weakness, ease-to-build, distribution, workflow anchor, market timing, revenue density, switching friction, AI advantage, market expansion)
- **Confidence layer** (evidence weights, relevance filtering, contradiction detection, scoring output)
- **Market analysis** (market structure v2, market size estimation)
- **Economic modeling** (v1 + v2 scenario-based)
- **Synthesis** (startup concepts, validation plans, wedge generation)
- **5 benchmark cases** passing

The frontend is a Next.js 14 app with scan modes (quick/standard/deep/thorough), a dashboard, run detail pages, and an analyst view with Recharts visualizations.

## What Is Being Built

A deterministic orchestration layer that transforms SignalForge from a request-response web app into an autonomous research engine.

### Architecture

```
Scheduler
  → Scan Orchestrator (state machine)
    → Job Queue (in-memory now, BullMQ later)
      → Worker Modules (collectors, detectors, analyzers)
    → Benchmark Validation
  → Report Generator
```

### Key Principles

1. **The orchestrator is deterministic.** It follows a fixed state machine with explicit phase transitions and completion criteria. No AI controls the workflow.

2. **AI operates only inside bounded worker tasks.** Wedge generation, concept synthesis, and market classification explanations use heuristic pattern matching. If LLM integration is added later, it runs inside a worker with typed inputs/outputs.

3. **Every job has typed contracts.** Inputs, outputs, retries, timeouts, and error recording are enforced at the queue level.

4. **Benchmarks are the objective referee.** No code ships without benchmark validation. Regressions are automatically detected.

## Development Model

Four engineering lanes work in parallel on isolated branches:

| Lane | Branch | Scope |
|------|--------|-------|
| Orchestrator Engineer | `feat/orchestrator` | Scan lifecycle, state machine, queue, phase gating |
| Signal Quality Engineer | `feat/signal-quality` | Evidence weighting, relevance, normalization |
| Analysis Engineer | `feat/analysis-engine` | Detectors, scoring, confidence, economic models |
| Integrator / Benchmark Engineer | `feat/benchmarks` | Benchmark suite, regression checks, safe merges |

The integrator merges only after: build passes, benchmarks pass, no regressions detected.

## Timeline Expectations

Phase 1 (scaffolding + state machine): Complete
Phase 2 (queue integration + existing pipeline migration): Next
Phase 3 (benchmark automation + regression gates): Following
Phase 4 (BullMQ/Redis/Postgres for production scaling): Future
