// Typed job definitions for the queue system.
// Each job has explicit input/output types, timeout, and retry config.
//
// Current implementation: in-memory execution.
// Future: BullMQ workers with Redis backing.

import { RawSignal, OpportunityCandidate } from '../../lib/engine/models/types';
import { CollectorStat, CollectionOptions } from '../../lib/engine/collectors';

// ─── Job status ─────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

export interface JobResult<T = unknown> {
  jobId: string;
  jobType: string;
  status: JobStatus;
  output?: T;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  attempts: number;
}

// ─── Collection job types ───────────────────────────────────────────

export interface CollectJobInput {
  collectorId: string;
  queries: string[];
  options: CollectionOptions;
}

export interface CollectJobOutput {
  signals: RawSignal[];
  stat: CollectorStat;
}

// ─── Analysis job types ─────────────────────────────────────────────

export interface ClusterJobInput {
  signals: RawSignal[];
}

export interface ClusterJobOutput {
  candidates: OpportunityCandidate[];
}

export interface AnalyzeJobInput {
  candidates: OpportunityCandidate[];
}

export interface AnalyzeJobOutput {
  candidates: OpportunityCandidate[];
}

export interface ScoreJobInput {
  candidates: OpportunityCandidate[];
}

export interface ScoreJobOutput {
  candidates: OpportunityCandidate[];
}

export interface EnrichJobInput {
  candidate: OpportunityCandidate;
}

export interface EnrichJobOutput {
  candidate: OpportunityCandidate;
}

// ─── Benchmark job types ────────────────────────────────────────────

export interface BenchmarkJobInput {
  caseIds?: string[]; // run specific cases, or all if empty
}

export interface BenchmarkJobOutput {
  passed: number;
  failed: number;
  total: number;
  results: Array<{
    name: string;
    passed: boolean;
    details: string;
  }>;
}

// ─── Report job types ───────────────────────────────────────────────

export interface ReportJobInput {
  scanId: string;
  candidates: OpportunityCandidate[];
}

export interface ReportJobOutput {
  reportId: string;
  generatedAt: string;
  candidateCount: number;
}

// ─── Job type registry ──────────────────────────────────────────────

export const JOB_CONFIGS: Record<string, { timeout: number; retries: number }> = {
  // Collection jobs — generous timeouts, proxy can be slow
  'collect-reddit-signals':       { timeout: 45000, retries: 1 },
  'collect-hn-signals':           { timeout: 15000, retries: 2 },
  'collect-autocomplete-signals': { timeout: 10000, retries: 2 },
  'collect-trends-signals':       { timeout: 10000, retries: 2 },
  'collect-review-signals':       { timeout: 45000, retries: 1 },
  'collect-pricing-signals':      { timeout: 30000, retries: 1 },
  'collect-job-signals':          { timeout: 30000, retries: 1 },
  'collect-producthunt-signals':  { timeout: 30000, retries: 1 },

  // Analysis jobs — CPU-bound, fast
  'cluster-opportunities':        { timeout: 10000, retries: 0 },
  'analyze-detectors':            { timeout: 10000, retries: 0 },
  'score-candidates':             { timeout: 5000,  retries: 0 },
  'enrich-candidate':             { timeout: 10000, retries: 0 },
  'analyze-market-structure':     { timeout: 5000,  retries: 0 },
  'compute-economic-impact':      { timeout: 5000,  retries: 0 },
  'detect-contradictions':        { timeout: 5000,  retries: 0 },
  'compute-confidence':           { timeout: 5000,  retries: 0 },
  'generate-wedges':              { timeout: 5000,  retries: 0 },
  'generate-startup-concepts':    { timeout: 5000,  retries: 0 },
  'generate-validation-plans':    { timeout: 5000,  retries: 0 },
  'apply-filters':                { timeout: 5000,  retries: 0 },

  // System jobs
  'run-benchmarks':               { timeout: 60000, retries: 0 },
  'generate-report':              { timeout: 10000, retries: 1 },
};
