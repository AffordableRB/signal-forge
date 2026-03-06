# Orchestration Architecture

## Overview

SignalForge uses a deterministic state machine to control scan execution.
The orchestrator owns the lifecycle. Workers execute bounded tasks.
AI never controls flow progression.

## State Machine

```
           ┌──────────────┐
           │   PENDING     │
           └──────┬───────┘
                  │ start()
           ┌──────▼───────┐
           │  DISCOVERY    │ ── collect signals from all sources
           └──────┬───────┘
                  │ all collectors finished or timed out
           ┌──────▼───────┐
           │ DEEP_EVIDENCE │ ── refined queries for top candidates
           └──────┬───────┘
                  │ deep collection complete (or skipped)
           ┌──────▼───────┐
           │ MARKET_MAPPING│ ── competitor/pricing queries
           └──────┬───────┘
                  │ market signals merged
           ┌──────▼──────────┐
           │CROSS_VALIDATION │ ── verify via independent sources
           └──────┬──────────┘
                  │ validation complete (or skipped)
           ┌──────▼───────────┐
           │ FINAL_ANALYSIS   │ ── cluster, detect, score, rank
           └──────┬───────────┘
                  │ all analysis complete
           ┌──────▼───────┐
           │  REPORTING    │ ── generate opportunity report
           └──────┬───────┘
                  │ report generated
           ┌──────▼───────┐
           │  COMPLETED    │
           └──────────────┘

Any phase can transition to:
           ┌──────────────┐
           │    FAILED     │
           └──────────────┘
```

## Phase Transition Rules

Each phase has explicit completion criteria:

| Phase | Completion Criteria |
|-------|-------------------|
| DISCOVERY | All collector jobs finished (success, failed, or timeout) |
| DEEP_EVIDENCE | Refinement collection complete for top N candidates |
| MARKET_MAPPING | Competitor queries complete |
| CROSS_VALIDATION | Validation queries complete |
| FINAL_ANALYSIS | Clustering, detection, scoring, enrichment all done |
| REPORTING | Report record generated and validated |

## Scan Modes and Phase Selection

| Mode | Phases |
|------|--------|
| quick | DISCOVERY → FINAL_ANALYSIS → REPORTING |
| standard | DISCOVERY → MARKET_MAPPING → FINAL_ANALYSIS → REPORTING |
| deep | All phases |

## Job Types

### Collection Jobs
- `collect-reddit-signals`
- `collect-hn-signals`
- `collect-autocomplete-signals`
- `collect-trends-signals`
- `collect-review-signals`
- `collect-pricing-signals`
- `collect-job-signals`
- `collect-producthunt-signals`

### Analysis Jobs
- `cluster-opportunities`
- `analyze-market-structure`
- `compute-economic-impact`
- `detect-contradictions`
- `compute-confidence`
- `generate-wedges`
- `generate-startup-concepts`
- `generate-validation-plans`

### System Jobs
- `run-benchmarks`
- `generate-report`

## Job Contract

Every job must implement:

```typescript
interface JobDefinition<TInput, TOutput> {
  type: string;
  input: TInput;
  execute(input: TInput): Promise<TOutput>;
  timeout: number;
  retries: number;
}
```

## Error Handling

- Individual job failures do not fail the scan
- The orchestrator records errors per job
- Phase completion checks tolerate partial failures
- Only critical failures (0 signals collected, analysis crash) trigger FAILED state
- All errors are persisted in the scan record

## Data Flow

```
Seed Queries
  → Collector Jobs → RawSignal[]
    → Cluster Job → OpportunityCandidate[]
      → Detector Jobs → DetectorResult[]
        → Scoring Job → OpportunityScores
          → Enrichment Jobs → MarketStructure, EconomicImpact, etc.
            → Validation Jobs → ConfidenceBreakdown
              → Report Job → OpportunityReport
```

## Storage Layer

Currently: in-memory during scan execution, JSON file persistence.
Future: Postgres for scans, phases, jobs, results, reports.

The storage interface is abstract so backends can be swapped:

```typescript
interface ScanStore {
  createScan(scan: ScanRecord): Promise<void>;
  updateScan(id: string, updates: Partial<ScanRecord>): Promise<void>;
  getScan(id: string): Promise<ScanRecord | null>;
  addJobResult(scanId: string, result: JobResult): Promise<void>;
}
```
