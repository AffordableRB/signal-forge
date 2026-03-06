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
- **12 calibration cases** in `benchmarks/cases.ts` (BENCHMARK_CASES):
  1. Missed call recovery (HOME-SERVICES, HIGH) — score ≥6.5, purple, conf ≥40
  2. Legal intake (LEGAL, HIGH) — score ≥6, purple, conf ≥35
  3. AI resume generator (GENERAL, LOW) — score ≤4, red
  4. Review response automation (HOME-SERVICES, MED-HIGH) — score ≥5, purple, conf ≥30
  5. HVAC dispatch (HOME-SERVICES, MED-HIGH) — score ≥5.5, purple, conf ≥30
  6. AI safety audit manufacturing (BLUE OCEAN) — score ≥6.5, blue, conf ≥30
  7. Commodity CRM (LOW) — score ≤4, red
  8. Social media scheduler creators (MEDIUM-LOW) — score ≤5, purple
  9. Rural vet AI diagnostics (MEDIUM) — score 4.5-6.5, blue
  10. Freelance lab tech marketplace (MEDIUM) — score 4.5-6, purple
  11. Print shop management (LOW) — score ≤4.5, purple (declining market)
  12. AI permit expediting (HIGH) — score ≥6.5, blue

- **3 E2E detector test cases** (E2E_BENCHMARK_CASES):
  1. Strong opportunity — runs detectors from raw evidence, expects score ≥5
  2. Weak opportunity — thin evidence, expects score ≤4.5
  3. Contradiction case — high demand but no money, expects contradiction flag

- **Runner** in `benchmarks/benchmark-runner.ts`: `runBenchmark()`, `runBenchmarkSuite()`, `compareToBaseline()`, `createBaseline()`
- **Regression baseline** in `benchmarks/baseline.json` — stores all scores, classifications, and detector outputs
- **CLI commands**:
  - `npm run orch:benchmark` — run 12 calibration cases
  - `npm run orch:benchmark:e2e` — run all 15 cases including E2E
  - `npm run orch:benchmark:check` — check for regressions vs baseline
  - `npm run orch:benchmark:baseline` — save new baseline

## Your Task Queue

Priority order:

1. **DONE — 12 calibration cases + 3 E2E cases** covering blue ocean, commodity, high-demand/low-pay, bad distribution, marketplace, declining market, and niche B2B.

2. **DONE — Regression detection** with `benchmarks/baseline.json`, `compareToBaseline()`, and `npm run orch:benchmark:check`.

3. **Add collector coverage tests** — Create benchmark cases that validate collector output shapes. A "collector health check" that verifies each collector returns properly structured RawSignal[] with valid evidence.

4. **Add integration test** — Create a test that runs `npm run orch:scan:quick` and validates the output has: at least 2 candidates, reasonable scores (1-10 range), valid market classifications, non-zero evidence counts.

5. **Document benchmark results** — After each benchmark run, append results to `docs/benchmark-history.md` so score trends are visible over time.

6. **Improve ocean classification coverage** — Several cases reveal that the market classifier is too liberal with purple/blue. Cases like print-shop (declining, should be red) and social-media-scheduler (crowded, should be red) currently classify as purple. Work with Lane 3 to tighten classification rules, then update expectations.

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
npm run orch:benchmark:e2e
npm run orch:benchmark:check
```

All must pass. When adding new benchmark cases, ensure they pass with the current codebase before committing — you are establishing the baseline, not testing future changes. After adding cases, run `npm run orch:benchmark:baseline` to update the baseline.

## What NOT To Do

- Do not modify detector scoring to make benchmarks pass — that's the analysis engineer's job
- Do not modify collectors
- Do not modify the orchestrator
- Do not lower benchmark expectations to paper over regressions
- Do not merge a branch that fails benchmarks, even if "it's close"
