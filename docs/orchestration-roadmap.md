# Orchestration Roadmap

## Phase 1: Scaffolding (Current)

- [x] Audit existing codebase (51 engine files, 10 collectors, 12 detectors)
- [x] Design state machine architecture
- [x] Write architecture documentation
- [x] Create directory structure (`/src/orchestrator`, `/src/queue`, `/src/state`)
- [x] Implement scan state types and models
- [x] Implement deterministic state machine
- [x] Implement in-memory job queue with typed contracts
- [x] Implement scan store interface
- [x] Wire orchestrator to existing engine modules

## Phase 2: Integration

- [ ] Create `/api/orchestrator/scan` endpoint
- [ ] Migrate existing `/api/run` to use orchestrator internally
- [ ] Add job-level progress streaming
- [ ] Implement benchmark execution through orchestrator
- [ ] Add scan history persistence (file-based, Postgres-ready interface)

## Phase 3: Benchmark Automation

- [ ] Move benchmark cases to `/benchmarks/cases/`
- [ ] Add regression detection (compare against baseline scores)
- [ ] Auto-run benchmarks on scan completion
- [ ] Store benchmark results per scan
- [ ] Add benchmark dashboard view

## Phase 4: Production Infrastructure

- [ ] BullMQ + Redis for distributed job queue
- [ ] Postgres for persistent scan/job/report storage
- [ ] Webhook notifications on scan completion
- [ ] Scheduled scans (cron-based)
- [ ] Multi-tenant support

## Phase 5: Advanced Analysis

- [ ] Embedding-based signal clustering
- [ ] Cross-scan trend detection
- [ ] Historical opportunity tracking
- [ ] Automated re-scanning of watchlisted opportunities
- [ ] LLM-powered explanation generation (bounded worker tasks only)

## Non-Goals

- AI controlling scan flow
- Dynamic task invention
- Skipping validation gates
- Rewriting working collectors unnecessarily
