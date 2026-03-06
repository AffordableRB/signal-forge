# Lane 4: Integrator / Benchmark Engineer

## Your Role

You are the integrator and benchmark engineer for SignalForge.
You own the benchmark suite, regression detection, documentation, and safe merges.
You are the gatekeeper — no code reaches main without your validation.

## Your Branch

Work on branch: `feat/benchmarks`

```bash
git checkout -b feat/benchmarks
```

## Your Directories

You may ONLY modify files in:
- `benchmarks/` (benchmark cases and runner)
- `scripts/benchmark.ts` (legacy benchmark script)
- `scripts/orchestrator.ts` (CLI improvements)
- `docs/` (all documentation)

You may READ everything — you need full system understanding.

You must NOT modify:
- `lib/engine/collectors/` (collector logic)
- `lib/engine/detectors/` (detector logic)
- `src/orchestrator/` (orchestrator)
- `app/` or `components/` (UI)

Exception: you may modify ANY file to resolve merge conflicts between lanes.

## Current State

The benchmark system has:
- **5 calibration cases** in `benchmarks/cases.ts`:
  1. Missed call recovery (HOME-SERVICES, HIGH) — expects score ≥6.5, purple, conf ≥40
  2. Legal intake (LEGAL, HIGH) — expects score ≥6, purple, conf ≥35
  3. AI resume generator (GENERAL, LOW) — expects score ≤4, red, contradictions ≤30
  4. Review response automation (HOME-SERVICES, MED-HIGH) — expects score ≥5, purple, conf ≥30
  5. HVAC dispatch (HOME-SERVICES, MED-HIGH) — expects score ≥5.5, purple, conf ≥30

- **Runner** in `benchmarks/benchmark-runner.ts`: `runBenchmark()` and `runBenchmarkSuite()`
- **CLI** via `npm run orch:benchmark`

## Your Task Queue

Priority order:

1. **Add more benchmark cases** — 5 is not enough. Add cases that exercise edge conditions:
   - A clearly blue ocean opportunity (nascent market, 0-1 competitors)
   - A commodity SaaS (CRM, project management — should score low)
   - A high-demand but low-pay market (should score medium)
   - A niche with strong demand but terrible distribution (should score medium)
   - A marketplace opportunity (two-sided, should flag complexity risks)
   Target: 10-12 total cases.

2. **Add regression detection** — Create `benchmarks/baseline.json` that stores the last known-good benchmark results. Write a comparison function that detects when scores drift more than 10% from baseline. Add `npm run orch:benchmark:check` that fails on regressions.

3. **Add collector coverage tests** — Create benchmark cases that validate collector output shapes. A "collector health check" that verifies each collector returns properly structured RawSignal[] with valid evidence.

4. **Add integration test** — Create a test that runs `npm run orch:scan:quick` and validates the output has: at least 2 candidates, reasonable scores (1-10 range), valid market classifications, non-zero evidence counts.

5. **Document benchmark results** — After each benchmark run, append results to `docs/benchmark-history.md` so score trends are visible over time.

## Merge Protocol

When another lane asks you to merge their branch:

```bash
# 1. Fetch their branch
git fetch origin feat/<lane-name>

# 2. Create integration branch
git checkout -b integrate/<lane-name> main

# 3. Merge their changes
git merge origin/feat/<lane-name>

# 4. Validate
npm run build
npm run orch:benchmark
npm run orch:scan:quick

# 5. If all pass, merge to main
git checkout main
git merge integrate/<lane-name>
git push

# 6. If benchmarks fail, reject the merge and report which cases broke
```

## Validation

Before committing:
```bash
npm run build
npm run orch:benchmark
```

Both must pass. When adding new benchmark cases, ensure they pass with the current codebase before committing — you are establishing the baseline, not testing future changes.

## What NOT To Do

- Do not modify detector scoring to make benchmarks pass — that's the analysis engineer's job
- Do not modify collectors
- Do not modify the orchestrator
- Do not lower benchmark expectations to paper over regressions
- Do not merge a branch that fails benchmarks, even if "it's close"
