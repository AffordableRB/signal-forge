# Lane 2: Signal Quality Engineer

## Your Role

You are the signal quality engineer for SignalForge.
You own evidence weighting, relevance filtering, signal normalization, and noise exclusion.
Your job is to make sure the signals feeding into detectors are clean, relevant, and properly weighted.

## Your Branch

Work on branch: `feat/signal-quality`

```bash
git checkout -b feat/signal-quality
```

## Your Directories

You may ONLY modify files in:
- `lib/engine/confidence/evidence-weights.ts`
- `lib/engine/confidence/relevance-filter.ts`
- `lib/engine/collectors/dedup.ts`
- `lib/engine/collectors/classify.ts`
- `src/signals/` (create new files here for new functionality)

You may READ but not modify:
- `lib/engine/collectors/*.ts` (understand signal sources)
- `lib/engine/detectors/` (understand what consumes signals)
- `benchmarks/` (understand validation criteria)

You must NOT modify:
- `src/orchestrator/` (orchestrator)
- `app/` or `components/` (UI)
- Collector `collect()` methods
- Detector `analyze()` methods

## Current State

The signal quality system has:
- **Evidence weights** (`evidence-weights.ts`): SOURCE_WEIGHTS map (pricing=1.0, reviews=0.9, jobs=0.8, reddit=0.6, search-intent=0.25). `computeEvidenceQualityScore()` returns 0-100.
- **Relevance filter** (`relevance-filter.ts`): `assessRelevance()` scores evidence against job/buyer/vertical keywords. `filterByRelevance()` buckets into relevant/weakly-relevant/irrelevant.
- **Deduplication** (`dedup.ts`): Removes duplicate evidence by URL and excerpt similarity.
- **Classification** (`classify.ts`): `classifySignal()` maps text to signal types (demand/pain/money/competition). `computeConfidence()` returns confidence scores.

## Your Task Queue

Priority order:

1. **Improve relevance scoring** — The relevance filter currently gives low scores (24-60%). Investigate why. The tokenizer may be too aggressive with stopword removal. Test with real scan output from `npm run orch:scan:quick`.

2. **Add source credibility scoring** — Not all reddit posts are equal. A post with 50 upvotes and 20 comments is more credible than one with 0. Add a `computeSourceCredibility(evidence)` function that considers engagement metrics where available.

3. **Improve deduplication** — Current dedup is URL-based. Add fuzzy text matching so near-duplicate excerpts from different URLs are caught.

4. **Add temporal weighting** — Evidence from 30 days ago should weigh more than evidence from 11 months ago. Add a `computeTemporalWeight(timestamp)` that returns 0.0-1.0.

5. **Add signal diversity scoring** — A candidate with evidence from 5 different sources is stronger than one with 5 pieces from the same source. Create `computeSignalDiversity(evidence[])` returning 0-100.

## Validation

Before committing:
```bash
npm run build
npm run orch:benchmark
npm run orch:scan:quick
```

All three must pass. Your changes affect confidence scores and evidence quality metrics. If benchmark confidence values change significantly, verify the change is an improvement.

## What NOT To Do

- Do not modify how collectors fetch data
- Do not change detector scoring formulas
- Do not modify the orchestrator
- Do not change the UI
- Do not lower evidence quality thresholds just to pass benchmarks
