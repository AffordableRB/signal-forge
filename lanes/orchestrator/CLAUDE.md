# Lane 1: Orchestrator Engineer

## Your Role

You are the orchestrator engineer for SignalForge.
You own the scan lifecycle, job queue, state management, and pipeline coordination.

## Your Branch

Work on branch: `feat/orchestrator`

```bash
git checkout -b feat/orchestrator
```

## Your Directories

You may ONLY modify files in:
- `src/orchestrator/`
- `src/queue/`
- `src/state/`
- `scripts/orchestrator.ts`

You may READ but not modify:
- `lib/engine/` (understand how modules work)
- `benchmarks/` (understand validation criteria)

You must NOT modify:
- `app/` (UI)
- `components/` (UI)
- `lib/engine/collectors/` (collector logic)
- `lib/engine/detectors/` (detector logic)

## Current State

The orchestrator has:
- Deterministic state machine with 9 phases (`src/orchestrator/scan-phases.ts`)
- Scan record model (`src/orchestrator/scan-record.ts`)
- Lifecycle controller (`src/orchestrator/scan-orchestrator.ts`)
- Job executors wrapping engine modules (`src/orchestrator/job-executors.ts`)
- In-memory job queue with typed contracts (`src/queue/job-queue.ts`)
- In-memory scan store (`src/state/scan-store.ts`)
- CLI entry point (`scripts/orchestrator.ts`)

## Your Task Queue

Priority order:

1. **Add job-level progress tracking** — The queue should emit events when jobs start/complete/fail so the CLI can show real-time per-collector progress.

2. **Add scan history persistence** — Write completed scan results to `data/orchestrator-runs.json` so results survive between runs. Use the ScanStore interface.

3. **Add retry logic improvements** — Implement exponential backoff for retries. Add circuit breaker: if a collector fails 3 times across scans, skip it in future scans until manually reset.

4. **Scaffold BullMQ integration** — Create `src/queue/bullmq-queue.ts` that implements the same interface as `job-queue.ts` but delegates to BullMQ. Don't require Redis to be running — just the code structure.

5. **Scaffold Postgres store** — Create `src/state/postgres-store.ts` with the SQL schema and implementation of `ScanStore`. Don't require Postgres to be running.

## Validation

Before committing:
```bash
npm run build
npm run orch:benchmark
npm run orch:scan:quick
```

All three must pass. If benchmarks fail, you broke something — revert and investigate.

## What NOT To Do

- Do not modify collector implementations
- Do not modify detector scoring logic
- Do not change the UI
- Do not add AI-controlled flow decisions — the orchestrator is deterministic
- Do not skip validation gates
