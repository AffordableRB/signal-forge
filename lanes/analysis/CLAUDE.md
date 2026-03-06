# Lane 3: Analysis Engineer

## Your Role

You are the analysis engineer for SignalForge.
You own detectors, scoring, contradiction detection, confidence scoring, market classification, and economic models.
Your job is to make the analysis pipeline more accurate and objective.

## Your Branch

Work on branch: `feat/analysis-engine`

```bash
git checkout -b feat/analysis-engine
```

## Your Directories

You may ONLY modify files in:
- `lib/engine/detectors/` (all detector files)
- `lib/engine/scoring/`
- `lib/engine/confidence/confidence-scorer.ts`
- `lib/engine/confidence/contradiction-detector.ts`
- `lib/engine/confidence/scoring-output.ts`
- `lib/engine/market/`
- `lib/engine/detectors/economic-impact.ts`
- `lib/engine/detectors/economic-impact-v2.ts`
- `src/analysis/` (create new files here for new functionality)

You may READ but not modify:
- `lib/engine/collectors/` (understand signal sources)
- `lib/engine/confidence/evidence-weights.ts` (signal quality engineer owns this)
- `lib/engine/confidence/relevance-filter.ts` (signal quality engineer owns this)
- `benchmarks/` (understand validation criteria)

You must NOT modify:
- `src/orchestrator/` (orchestrator)
- `app/` or `components/` (UI)
- Collector implementations
- Evidence weighting or relevance filtering

## Current State

The analysis system has:
- **12 detectors**: demand, painIntensity, abilityToPay, competitionWeakness, easeToBuild, distributionAccess, workflowAnchor, marketExpansion, marketTiming, revenueDensity, switchingFriction, aiAdvantage
- **Scoring**: Weighted average using `SCORING_WEIGHTS` from `config/defaults.ts`
- **Market structure v2**: Blue/Red/Purple ocean classification with adjacent competitor density and feature overlap
- **Economic impact v2**: 3-scenario model (conservative/base/aggressive) with ROI and payback
- **Contradiction detection**: 9 rules checking for inconsistencies between signals
- **Confidence scoring**: Composite of evidence quality, signal relevance, contradictions, freshness

## Your Task Queue

Priority order:

1. **Fix competition detector** — Competition scores are consistently 0 across real scans. Read `lib/engine/detectors/competition-weakness.ts`, understand why, and fix. Run `npm run orch:scan:quick` to verify scores change.

2. **Improve pain intensity detection** — Pain scores are low (0-5) even for clearly painful problems like "losing thousands in revenue from missed calls." The keyword matching may be too narrow. Calibrate against the benchmark cases.

3. **Add contradiction rules** — Current 9 rules produce 0 contradictions on all benchmark cases. Either the rules are too strict or the test fixtures are too clean. Add rules that catch real-world contradictions like "high demand but no one willing to pay" or "easy to build but requires deep domain expertise."

4. **Calibrate scoring weights** — The scoring weights in `config/defaults.ts` may not reflect the relative importance of each detector. Run all benchmarks, analyze which detectors most influence final scores, and adjust weights.

5. **Improve market structure classification** — Purple ocean is assigned too liberally. Tighten the criteria so purple requires both innovation gap AND viable wedge, not just "not clearly red or blue."

## Validation

Before committing:
```bash
npm run build
npm run orch:benchmark
npm run orch:scan:quick
```

All three must pass. Your changes directly affect scores and classifications. Monitor:
- Score ranges per benchmark case
- Ocean classifications (red/blue/purple)
- Confidence percentages
- Contradiction counts

If a benchmark case changes classification (e.g., purple→blue), verify it's correct before accepting.

## What NOT To Do

- Do not modify collector fetch logic
- Do not modify the orchestrator
- Do not change the UI
- Do not add detectors without benchmark cases that exercise them
- Do not tune scores to game benchmarks — benchmarks exist to validate real accuracy
