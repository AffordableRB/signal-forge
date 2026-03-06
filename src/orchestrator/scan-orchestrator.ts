// Deterministic Scan Orchestrator
//
// This is the central controller for SignalForge scans.
// It owns the lifecycle. It controls phase transitions.
// It dispatches jobs. It validates outputs.
//
// AI never controls this. The state machine is rule-driven.

import { v4 as uuid } from 'uuid';
import { RawSignal, OpportunityCandidate } from '../../lib/engine/models/types';
import { CollectorStat } from '../../lib/engine/collectors';
import { SEED_QUERIES } from '../../lib/engine/config/seed-queries';
import { deduplicateEvidence } from '../../lib/engine/collectors/dedup';
import { ScanPhase, ScanMode, PHASE_SEQUENCE, isValidTransition } from './scan-phases';
import { ScanRecord, PhaseRecord, createScanRecord } from './scan-record';
import { ScanStore } from '../state/scan-store';
import { JobQueue } from '../queue/job-queue';
import { CollectJobOutput } from '../queue/job-types';
import { executeCollectJob, executeFullAnalysis } from './job-executors';

// ─── Collector registry ─────────────────────────────────────────────

const COLLECTOR_JOB_MAP: Record<string, string> = {
  'hackernews':     'collect-hn-signals',
  'search-intent':  'collect-autocomplete-signals',
  'google-trends':  'collect-trends-signals',
  'reddit':         'collect-reddit-signals',
  'reviews':        'collect-review-signals',
  'jobs':           'collect-job-signals',
  'product-hunt':   'collect-producthunt-signals',
  'pricing':        'collect-pricing-signals',
};

const ALL_COLLECTOR_IDS = Object.keys(COLLECTOR_JOB_MAP);

// ─── Mode-specific depth config ─────────────────────────────────────

interface DepthConfig {
  queryCount: number;
  redditResultLimit: number;
  subredditDepth: number;
  reviewSnippetLimit: number;
  pricingQueryCount: number;
  jobResultLimit: number;
}

const DEPTH_CONFIGS: Record<ScanMode, DepthConfig> = {
  quick: {
    queryCount: 3,
    redditResultLimit: 10,
    subredditDepth: 1,
    reviewSnippetLimit: 4,
    pricingQueryCount: 1,
    jobResultLimit: 3,
  },
  standard: {
    queryCount: 4,
    redditResultLimit: 25,
    subredditDepth: 2,
    reviewSnippetLimit: 8,
    pricingQueryCount: 2,
    jobResultLimit: 5,
  },
  deep: {
    queryCount: 8,
    redditResultLimit: 50,
    subredditDepth: 4,
    reviewSnippetLimit: 15,
    pricingQueryCount: 3,
    jobResultLimit: 10,
  },
};

// ─── Progress callback ──────────────────────────────────────────────

export interface ScanProgress {
  scanId: string;
  phase: ScanPhase;
  status: string;
  progressPercent: number;
  currentJob?: string;
  signalCount: number;
}

export type ProgressCallback = (progress: ScanProgress) => void;

// ─── Orchestrator ───────────────────────────────────────────────────

export class ScanOrchestrator {
  constructor(
    private store: ScanStore,
    private queue: JobQueue,
  ) {}

  // ─── Main entry point ───────────────────────────────────────────

  async runScan(
    mode: ScanMode,
    onProgress?: ProgressCallback,
  ): Promise<ScanRecord> {
    const scanId = uuid();
    const depth = DEPTH_CONFIGS[mode];
    const queries = SEED_QUERIES.slice(0, depth.queryCount);
    const scan = createScanRecord(scanId, mode, queries);

    await this.store.createScan(scan);

    const allSignals: RawSignal[] = [];
    const allStats: CollectorStat[] = [];
    const phases = PHASE_SEQUENCE[mode];

    try {
      // Transition from PENDING to first phase
      await this.transitionPhase(scan, phases[0]);

      for (const phase of phases) {
        await this.transitionPhase(scan, phase);

        this.emitProgress(scan, onProgress);

        const phaseStart = Date.now();
        const phaseRecord: PhaseRecord = {
          phase,
          status: 'running',
          startedAt: new Date().toISOString(),
          signalsAdded: 0,
          jobIds: [],
        };

        try {
          switch (phase) {
            case 'DISCOVERY':
              await this.runDiscovery(scan, queries, depth, allSignals, allStats, phaseRecord, onProgress);
              break;

            case 'DEEP_EVIDENCE':
              await this.runDeepEvidence(scan, queries, depth, allSignals, allStats, phaseRecord, onProgress);
              break;

            case 'MARKET_MAPPING':
              await this.runMarketMapping(scan, depth, allSignals, allStats, phaseRecord, onProgress);
              break;

            case 'CROSS_VALIDATION':
              await this.runCrossValidation(scan, depth, allSignals, allStats, phaseRecord, onProgress);
              break;

            case 'FINAL_ANALYSIS':
              await this.runFinalAnalysis(scan, allSignals, phaseRecord, onProgress);
              break;

            case 'REPORTING':
              await this.runReporting(scan, phaseRecord);
              break;
          }

          phaseRecord.status = 'completed';
        } catch (e) {
          phaseRecord.status = 'failed';
          phaseRecord.error = e instanceof Error ? e.message : 'Phase failed';
        }

        phaseRecord.completedAt = new Date().toISOString();
        phaseRecord.durationMs = Date.now() - phaseStart;

        // Replace or add phase record
        const existingIdx = scan.phases.findIndex(p => p.phase === phase);
        if (existingIdx >= 0) {
          scan.phases[existingIdx] = phaseRecord;
        } else {
          scan.phases.push(phaseRecord);
        }

        // Update progress
        const phaseIdx = phases.indexOf(phase);
        scan.progressPercent = Math.round(((phaseIdx + 1) / phases.length) * 100);
        scan.signalCount = allSignals.reduce((n, s) => n + s.evidence.length, 0);
        await this.store.updateScan(scanId, {
          phases: scan.phases,
          progressPercent: scan.progressPercent,
          signalCount: scan.signalCount,
          currentPhase: phase,
        });

        this.emitProgress(scan, onProgress);
      }

      // Mark completed
      scan.status = 'completed';
      scan.currentPhase = 'COMPLETED';
      scan.completedAt = new Date().toISOString();
      scan.progressPercent = 100;
      await this.store.updateScan(scanId, {
        status: 'completed',
        currentPhase: 'COMPLETED',
        completedAt: scan.completedAt,
        progressPercent: 100,
        candidateCount: scan.candidateCount,
        topScore: scan.topScore,
        topOpportunity: scan.topOpportunity,
      });

    } catch (e) {
      scan.status = 'failed';
      scan.currentPhase = 'FAILED';
      scan.errorSummary = e instanceof Error ? e.message : 'Scan failed';
      await this.store.updateScan(scanId, {
        status: 'failed',
        currentPhase: 'FAILED',
        errorSummary: scan.errorSummary,
      });
    }

    return scan;
  }

  // ─── Phase implementations ──────────────────────────────────────

  private async runDiscovery(
    scan: ScanRecord,
    queries: string[],
    depth: DepthConfig,
    allSignals: RawSignal[],
    allStats: CollectorStat[],
    phaseRecord: PhaseRecord,
    _onProgress?: ProgressCallback,
  ): Promise<void> {
    // Dispatch a collect job for each collector in parallel
    const jobIds: string[] = [];

    for (const collectorId of ALL_COLLECTOR_IDS) {
      const jobType = COLLECTOR_JOB_MAP[collectorId];
      const jobId = this.queue.enqueue(jobType, {
        collectorId,
        queries,
        options: {
          redditResultLimit: depth.redditResultLimit,
          subredditDepth: depth.subredditDepth,
          reviewSnippetLimit: depth.reviewSnippetLimit,
          pricingQueryCount: depth.pricingQueryCount,
          jobResultLimit: depth.jobResultLimit,
        },
      }, executeCollectJob);

      jobIds.push(jobId);
    }

    phaseRecord.jobIds = jobIds;

    // Execute all collection jobs in parallel
    const results = await this.queue.executeParallel(jobIds);

    // Aggregate results
    for (const result of results) {
      await this.store.addJobResult(scan.id, result);
      if (result.status === 'completed' && result.output) {
        const output = result.output as CollectJobOutput;
        allSignals.push(...output.signals);
        allStats.push(output.stat);
        phaseRecord.signalsAdded += output.signals.length;
      }
    }
  }

  private async runDeepEvidence(
    scan: ScanRecord,
    _queries: string[],
    depth: DepthConfig,
    allSignals: RawSignal[],
    allStats: CollectorStat[],
    phaseRecord: PhaseRecord,
    _onProgress?: ProgressCallback,
  ): Promise<void> {
    // Run a quick analysis to find top candidates
    const candidates = await executeFullAnalysis(allSignals);
    const topJobs = candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 3)
      .map(c => c.jobToBeDone);

    if (topJobs.length === 0) return;

    // Generate refined queries
    const deepQueries = topJobs.map(j => `${j} software problems`);

    // Dispatch collection for refined queries
    const jobIds: string[] = [];
    for (const collectorId of ALL_COLLECTOR_IDS) {
      const jobType = COLLECTOR_JOB_MAP[collectorId];
      const jobId = this.queue.enqueue(jobType, {
        collectorId,
        queries: deepQueries,
        options: {
          redditResultLimit: depth.redditResultLimit,
          subredditDepth: depth.subredditDepth,
          reviewSnippetLimit: depth.reviewSnippetLimit,
          pricingQueryCount: depth.pricingQueryCount,
          jobResultLimit: depth.jobResultLimit,
        },
      }, executeCollectJob);
      jobIds.push(jobId);
    }

    phaseRecord.jobIds = jobIds;
    const results = await this.queue.executeParallel(jobIds);

    for (const result of results) {
      await this.store.addJobResult(scan.id, result);
      if (result.status === 'completed' && result.output) {
        const output = result.output as CollectJobOutput;
        allSignals.push(...output.signals);
        allStats.push(output.stat);
        phaseRecord.signalsAdded += output.signals.length;
      }
    }
  }

  private async runMarketMapping(
    scan: ScanRecord,
    depth: DepthConfig,
    allSignals: RawSignal[],
    allStats: CollectorStat[],
    phaseRecord: PhaseRecord,
    _onProgress?: ProgressCallback,
  ): Promise<void> {
    // Intermediate analysis to find top candidates for market queries
    const candidates = await executeFullAnalysis(allSignals);
    const topCandidates = candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 3);

    if (topCandidates.length === 0) return;

    const marketQueries = topCandidates.map(c =>
      `${c.jobToBeDone} competitors alternatives pricing`
    );

    const jobIds: string[] = [];
    for (const collectorId of ALL_COLLECTOR_IDS) {
      const jobType = COLLECTOR_JOB_MAP[collectorId];
      const jobId = this.queue.enqueue(jobType, {
        collectorId,
        queries: marketQueries.slice(0, 2),
        options: {
          redditResultLimit: 10,
          subredditDepth: 1,
          reviewSnippetLimit: depth.reviewSnippetLimit,
          pricingQueryCount: 2,
          jobResultLimit: 3,
        },
      }, executeCollectJob);
      jobIds.push(jobId);
    }

    phaseRecord.jobIds = jobIds;
    const results = await this.queue.executeParallel(jobIds);

    for (const result of results) {
      await this.store.addJobResult(scan.id, result);
      if (result.status === 'completed' && result.output) {
        const output = result.output as CollectJobOutput;
        // Merge market signals into existing pool
        for (const signal of output.signals) {
          // Merge evidence into matching candidates by keyword overlap
          for (const candidate of topCandidates) {
            const jobLower = candidate.jobToBeDone.toLowerCase();
            const queryLower = signal.query.toLowerCase();
            const overlap = jobLower.split(/\s+/).filter(w => w.length > 3 && queryLower.includes(w));
            if (overlap.length >= 2) {
              signal.evidence = deduplicateEvidence([...signal.evidence]);
            }
          }
        }
        allSignals.push(...output.signals);
        allStats.push(output.stat);
        phaseRecord.signalsAdded += output.signals.length;
      }
    }
  }

  private async runCrossValidation(
    scan: ScanRecord,
    depth: DepthConfig,
    allSignals: RawSignal[],
    allStats: CollectorStat[],
    phaseRecord: PhaseRecord,
    _onProgress?: ProgressCallback,
  ): Promise<void> {
    const candidates = await executeFullAnalysis(allSignals);
    const topCandidates = candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 3);

    if (topCandidates.length === 0) return;

    const validationQueries = topCandidates.map(c =>
      `"${c.jobToBeDone}" reviews complaints`
    );

    // Only use fast collectors + reviews for cross-validation
    const validationCollectors = ['hackernews', 'search-intent', 'google-trends', 'reddit', 'reviews'];

    const jobIds: string[] = [];
    for (const collectorId of validationCollectors) {
      const jobType = COLLECTOR_JOB_MAP[collectorId];
      const jobId = this.queue.enqueue(jobType, {
        collectorId,
        queries: validationQueries.slice(0, 2),
        options: {
          redditResultLimit: 10,
          subredditDepth: 1,
          reviewSnippetLimit: 6,
          pricingQueryCount: 0,
          jobResultLimit: 0,
        },
      }, executeCollectJob);
      jobIds.push(jobId);
    }

    phaseRecord.jobIds = jobIds;
    const results = await this.queue.executeParallel(jobIds);

    for (const result of results) {
      await this.store.addJobResult(scan.id, result);
      if (result.status === 'completed' && result.output) {
        const output = result.output as CollectJobOutput;
        allSignals.push(...output.signals);
        allStats.push(output.stat);
        phaseRecord.signalsAdded += output.signals.length;
      }
    }
  }

  private async runFinalAnalysis(
    scan: ScanRecord,
    allSignals: RawSignal[],
    _phaseRecord: PhaseRecord,
    _onProgress?: ProgressCallback,
  ): Promise<void> {
    const ranked = await executeFullAnalysis(allSignals);

    const accepted = ranked.filter(c => !c.rejected);
    scan.candidateCount = ranked.length;
    scan.topScore = accepted[0]?.scores.final ?? 0;
    scan.topOpportunity = accepted[0]?.jobToBeDone ?? 'N/A';

    // Store candidates on the scan record (will be used for report)
    // The store.updateScan call in the main loop handles persistence
    (scan as ScanRecord & { candidates?: OpportunityCandidate[] }).candidates = ranked;
  }

  private async runReporting(
    _scan: ScanRecord,
    phaseRecord: PhaseRecord,
  ): Promise<void> {
    // Currently a no-op — the scan record IS the report.
    // Future: generate structured report documents, PDFs, etc.
    phaseRecord.signalsAdded = 0;
  }

  // ─── State machine transition ───────────────────────────────────

  private async transitionPhase(scan: ScanRecord, target: ScanPhase): Promise<void> {
    if (scan.currentPhase === target) return; // already in this phase

    if (!isValidTransition(scan.currentPhase, target)) {
      throw new Error(
        `Invalid phase transition: ${scan.currentPhase} → ${target}`
      );
    }

    scan.currentPhase = target;
    scan.status = 'running';
    await this.store.updateScan(scan.id, {
      currentPhase: target,
      status: 'running',
    });
  }

  // ─── Progress emission ──────────────────────────────────────────

  private emitProgress(scan: ScanRecord, onProgress?: ProgressCallback): void {
    onProgress?.({
      scanId: scan.id,
      phase: scan.currentPhase,
      status: scan.status,
      progressPercent: scan.progressPercent,
      signalCount: scan.signalCount,
    });
  }
}
