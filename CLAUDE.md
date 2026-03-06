# SignalForge — Project Instructions

## What This Is

SignalForge is a deterministic business opportunity discovery engine.
It scans public internet sources for market signals, clusters them into opportunities, scores them against 12 detectors, and produces ranked reports with confidence metrics.

## Architecture

```
Production (Vercel):
  Next.js App → /api/run (quick/standard/deep) → pipeline.ts → engine modules
  Next.js App → /api/scan/* (thorough) → client-orchestrated multi-step

Development (Local):
  npm run orch:scan           → orchestrator → job queue → engine modules
  npm run orch:benchmark      → benchmark runner → validation
```

The orchestrator is for development only. Production scans run through the Next.js API routes.

## Validation Gate

Before committing ANY change:
1. `npm run build` must pass
2. `npm run orch:benchmark` must pass (all 12 calibration cases)
3. `npm run orch:benchmark:e2e` must pass (all 15 cases including E2E detector tests)
4. `npm run orch:benchmark:check` must pass (no regressions vs baseline)
5. `npm run orch:scan:quick` should produce reasonable results

If benchmarks fail, your change introduced a regression. Fix it before committing.
After fixing, run `npm run orch:benchmark:baseline` to update the baseline.

## Key Directories

| Directory | Purpose | Stability |
|-----------|---------|-----------|
| `lib/engine/collectors/` | Data collectors (10 sources) | STABLE — do not modify unless fixing bugs |
| `lib/engine/detectors/` | 12 scoring detectors | Modify with benchmark validation |
| `lib/engine/confidence/` | Evidence weights, relevance, contradictions | Modify with benchmark validation |
| `lib/engine/market/` | Market structure, market size | Modify with benchmark validation |
| `lib/engine/scoring/` | Weighted scoring | Modify with benchmark validation |
| `lib/engine/config/` | Seed queries, scan modes, defaults | Safe to modify |
| `src/orchestrator/` | Dev orchestrator, state machine | Orchestrator engineer only |
| `src/queue/` | Job queue abstraction | Orchestrator engineer only |
| `src/state/` | Scan store abstraction | Orchestrator engineer only |
| `benchmarks/` | Calibration cases, runner | Benchmark engineer only |
| `app/` | Next.js pages and API routes | UI changes only |
| `components/` | React components | UI changes only |

## Conventions

- TypeScript strict mode
- ESLint enforced (unused vars prefixed with `_`)
- `Array.from()` for Set iteration (no `--downlevelIteration`)
- No emojis in code or output
- ScraperAPI proxy for bot-protected sites (set `SCRAPER_API_KEY`)
- p-limit for concurrency control (directLimit=5, proxyLimit=3)

## Engineering Lanes

This project supports parallel development across 4 lanes.
See `docs/engineering-lanes.md` for full details.
Each lane has its own branch and directory boundaries.
