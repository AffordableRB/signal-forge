# Engineering Lanes

## Parallel Development Model

SignalForge is developed by multiple Claude Code terminals working in parallel.
Each terminal is a specialized engineer with lane ownership.
Engineers must stay within their assigned lane.

## Lane 1: Orchestrator Engineer

**Branch:** `feat/orchestrator`

**Responsibilities:**
- Scan lifecycle controller (state machine)
- Pipeline phase transitions and gating
- Queue integration (dispatch, retry, timeout)
- Progress tracking
- Failure handling and error aggregation

**Allowed directories:**
- `/src/orchestrator/`
- `/src/queue/`
- `/src/state/`

**Must not modify:**
- UI components
- Collector implementations
- Detector logic (unless required for orchestration interface)

---

## Lane 2: Signal Quality Engineer

**Branch:** `feat/signal-quality`

**Responsibilities:**
- Signal normalization and deduplication
- Evidence weighting by source quality
- Relevance filtering (relevant/weakly-relevant/irrelevant)
- Noisy signal exclusion
- Source quality scoring

**Allowed directories:**
- `/src/signals/`
- `/src/evidence/`
- `/lib/engine/confidence/`
- `/lib/engine/collectors/dedup.ts`
- `/lib/engine/collectors/classify.ts`

**Must not modify:**
- Orchestrator
- UI
- Scan lifecycle

---

## Lane 3: Analysis Engineer

**Branch:** `feat/analysis-engine`

**Responsibilities:**
- Detector improvements
- Scoring algorithm refinement
- Contradiction detection rules
- Confidence scoring
- Market classification accuracy
- Economic model calibration

**Allowed directories:**
- `/src/analysis/`
- `/lib/engine/detectors/`
- `/lib/engine/scoring/`
- `/lib/engine/confidence/`
- `/lib/engine/market/`

**Must not modify:**
- Collectors
- Orchestrator
- UI

---

## Lane 4: Integrator / Benchmark Engineer

**Branch:** `feat/benchmarks`

**Responsibilities:**
- Benchmark suite maintenance
- Regression detection
- System calibration
- Planning documentation
- Safe branch merges

**Allowed directories:**
- `/benchmarks/`
- `/scripts/`
- `/docs/`

**Must not modify:**
- Collectors
- Detectors
- Orchestrator
(unless resolving integration conflicts)

---

## Merge Protocol

1. Engineer pushes to their feature branch
2. Build must pass: `npm run build`
3. Benchmarks must pass: `npm run benchmark`
4. Integrator reviews for regressions
5. Integrator merges to `main`

## Conflict Resolution

- If two lanes need to modify the same file, the integrator coordinates
- Shared types in `/lib/engine/models/types.ts` require integrator approval
- Interface changes must be backwards-compatible or coordinated across lanes
