// Multi-stage pipeline runner for serverless environments (Vercel).
// Supports quick/standard/deep scan modes with progressive refinement.

import { OpportunityCandidate, EconomicImpact, RawSignal } from './models/types';
import { collectAllSignals, CollectorStat } from './collectors';
import { clusterSignals } from './cluster';
import { analyzeAll } from './detectors';
import { scoreAll, rankCandidates } from './scoring';
import { applyFilters } from './filters';
import { applyKillSwitch } from './reality/kill-switch';
import { SEED_QUERIES } from './config/seed-queries';
import { ScanMode, ScanPhase, SCAN_MODES, PHASES } from './config/scan-modes';
import { estimateEconomicImpact } from './detectors/economic-impact';
import { estimateEconomicImpactV2 } from './detectors/economic-impact-v2';
import { analyzeMomentum } from './detectors/momentum';
import { classifyMarketStructureV2 } from './market/market-structure-v2';
import { estimateMarketSize } from './market/market-size';
import { generateWedges } from './wedge/wedge-generator';
import { synthesizeStartupConcepts, generateValidationPlan } from './synthesis/synthesizer';
import { computeConfidence } from './confidence/confidence-scorer';
import { generateScoringOutput } from './confidence/scoring-output';
import { deduplicateEvidence } from './collectors/dedup';

export interface PhaseProgress {
  phase: ScanPhase;
  label: string;
  status: 'running' | 'completed' | 'skipped';
  durationMs: number;
  signalsAdded: number;
}

export interface PipelineResult {
  candidates: OpportunityCandidate[];
  topScore: number;
  topOpportunity: string;
  candidateCount: number;
  collectorStats: CollectorStat[];
  queriesUsed: string[];
  scanMode: ScanMode;
  phases: PhaseProgress[];
}

export type PhaseCallback = (progress: PhaseProgress) => void;

// ─── Main entry point ────────────────────────────────────────────────

export async function runPipeline(
  mode: ScanMode = 'standard',
  onPhase?: PhaseCallback,
): Promise<PipelineResult> {
  const config = SCAN_MODES[mode];
  const queries = SEED_QUERIES.slice(0, config.queryCount);
  const phases: PhaseProgress[] = [];
  let allSignals: RawSignal[] = [];
  let allStats: CollectorStat[] = [];

  // Helper to emit phase progress — replaces 'running' entry when completed/skipped
  function emitPhase(phase: ScanPhase, status: 'running' | 'completed' | 'skipped', durationMs: number, signalsAdded: number) {
    const label = PHASES.find(p => p.id === phase)?.label ?? phase;
    const p: PhaseProgress = { phase, label, status, durationMs, signalsAdded };
    const existing = phases.findIndex(x => x.phase === phase);
    if (existing >= 0) {
      phases[existing] = p;
    } else {
      phases.push(p);
    }
    onPhase?.(p);
  }

  // ─── Phase 1: Discovery ──────────────────────────────────────────
  if (config.phases.includes('discovery')) {
    const start = Date.now();
    emitPhase('discovery', 'running', 0, 0);

    const { signals, collectorStats } = await collectAllSignals(queries, {
      fastTimeoutMs: config.fastTimeoutMs,
      proxyTimeoutMs: config.proxyTimeoutMs,
      redditResultLimit: config.redditResultLimit,
      subredditDepth: config.subredditDepth,
      reviewSnippetLimit: config.reviewSnippetLimit,
      pricingQueryCount: config.pricingQueryCount,
      jobResultLimit: config.jobResultLimit,
    });

    allSignals = signals;
    allStats = collectorStats;
    emitPhase('discovery', 'completed', Date.now() - start, signals.length);
  }

  // ─── Phase 2: Deep Evidence (deep mode only) ────────────────────
  if (config.phases.includes('deep-evidence')) {
    const start = Date.now();
    emitPhase('deep-evidence', 'running', 0, 0);

    // Cluster what we have, identify top candidates, then collect more for them
    const preliminary = clusterSignals(allSignals);
    const prelimAnalyzed = analyzeAll(preliminary);
    const prelimScored = scoreAll(prelimAnalyzed);
    const topJobs = prelimScored
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 3)
      .map(c => c.jobToBeDone);

    // Generate refined queries from top candidates
    const deepQueries = topJobs.map(j => `${j} software problems`);

    try {
      const { signals: deepSignals, collectorStats: deepStats } = await collectAllSignals(deepQueries, {
        fastTimeoutMs: config.fastTimeoutMs,
        proxyTimeoutMs: config.proxyTimeoutMs,
        redditResultLimit: config.redditResultLimit,
        subredditDepth: config.subredditDepth,
        reviewSnippetLimit: config.reviewSnippetLimit,
        pricingQueryCount: config.pricingQueryCount,
        jobResultLimit: config.jobResultLimit,
      });

      allSignals.push(...deepSignals);
      allStats.push(...deepStats);
      emitPhase('deep-evidence', 'completed', Date.now() - start, deepSignals.length);
    } catch {
      emitPhase('deep-evidence', 'completed', Date.now() - start, 0);
    }
  } else if (mode === 'deep') {
    emitPhase('deep-evidence', 'skipped', 0, 0);
  }

  // ─── Cluster & Analyze ──────────────────────────────────────────
  const candidates = clusterSignals(allSignals);
  const analyzed = analyzeAll(candidates);

  // ─── Phase 3: Market Mapping ────────────────────────────────────
  if (config.phases.includes('market-mapping')) {
    const start = Date.now();
    emitPhase('market-mapping', 'running', 0, 0);

    // Collect competitor-focused signals for top candidates
    const scored = scoreAll(analyzed);
    const topCandidates = scored
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 3);

    const competitorQueries = topCandidates.map(c =>
      `${c.jobToBeDone} competitors alternatives pricing`
    );

    let marketSignals = 0;
    try {
      const { signals: mktSignals } = await collectAllSignals(competitorQueries.slice(0, 2), {
        fastTimeoutMs: config.fastTimeoutMs,
        proxyTimeoutMs: config.proxyTimeoutMs,
        redditResultLimit: 10,
        subredditDepth: 1,
        reviewSnippetLimit: config.reviewSnippetLimit,
        pricingQueryCount: 2,
        jobResultLimit: 3,
      });

      // Merge new evidence into existing candidates
      for (const signal of mktSignals) {
        for (const candidate of analyzed) {
          const jobLower = candidate.jobToBeDone.toLowerCase();
          const queryLower = signal.query.toLowerCase();
          const overlap = jobLower.split(/\s+/).filter(w => w.length > 3 && queryLower.includes(w));
          if (overlap.length >= 2) {
            candidate.evidence.push(...signal.evidence);
            candidate.evidence = deduplicateEvidence(candidate.evidence);
          }
        }
        marketSignals += signal.evidence.length;
      }
      emitPhase('market-mapping', 'completed', Date.now() - start, marketSignals);
    } catch {
      emitPhase('market-mapping', 'completed', Date.now() - start, 0);
    }
  }

  // ─── Phase 4: Cross-Validation (deep mode only) ─────────────────
  if (config.phases.includes('cross-validation')) {
    const start = Date.now();
    emitPhase('cross-validation', 'running', 0, 0);

    // For each top candidate, verify claims via a different source
    const scored = scoreAll(analyzed);
    const topCandidates = scored
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 3);

    let validationSignals = 0;
    const validationQueries = topCandidates.map(c =>
      `"${c.jobToBeDone}" reviews complaints`
    );

    try {
      const { signals: valSignals } = await collectAllSignals(validationQueries.slice(0, 2), {
        fastTimeoutMs: config.fastTimeoutMs,
        proxyTimeoutMs: config.proxyTimeoutMs,
        redditResultLimit: 10,
        subredditDepth: 1,
        reviewSnippetLimit: 6,
        pricingQueryCount: 0,
        jobResultLimit: 0,
      });

      for (const signal of valSignals) {
        for (const candidate of analyzed) {
          const jobLower = candidate.jobToBeDone.toLowerCase();
          const queryLower = signal.query.toLowerCase();
          const overlap = jobLower.split(/\s+/).filter(w => w.length > 3 && queryLower.includes(w));
          if (overlap.length >= 2) {
            candidate.evidence.push(...signal.evidence);
            candidate.evidence = deduplicateEvidence(candidate.evidence);
          }
        }
        validationSignals += signal.evidence.length;
      }
      emitPhase('cross-validation', 'completed', Date.now() - start, validationSignals);
    } catch {
      emitPhase('cross-validation', 'completed', Date.now() - start, 0);
    }
  } else if (mode === 'deep') {
    emitPhase('cross-validation', 'skipped', 0, 0);
  }

  // ─── Phase 5: Final Analysis ────────────────────────────────────
  const analysisStart = Date.now();
  emitPhase('analysis', 'running', 0, 0);

  // Re-analyze after evidence enrichment
  const reanalyzed = analyzeAll(analyzed);

  // Enrich
  const enriched = reanalyzed.map(c => enrichCandidate(c));

  // Score
  const scored = scoreAll(enriched);

  // Confidence
  const withConfidence = scored.map(c => {
    const confidence = computeConfidence(c);
    const scoringOutput = generateScoringOutput(c);
    return { ...c, confidence, scoringOutput };
  });

  // Filter + kill switch
  const filtered = applyKillSwitch(applyFilters(withConfidence));

  // Rank
  const ranked = rankCandidates(filtered);
  const accepted = ranked.filter(c => !c.rejected);

  emitPhase('analysis', 'completed', Date.now() - analysisStart, 0);

  return {
    candidates: ranked,
    topScore: accepted[0]?.scores.final ?? 0,
    topOpportunity: accepted[0]?.jobToBeDone ?? 'N/A',
    candidateCount: ranked.length,
    collectorStats: allStats,
    queriesUsed: queries,
    scanMode: mode,
    phases,
  };
}

// ─── Enrichment (unchanged) ──────────────────────────────────────────

function enrichCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  const ecoV1 = estimateEconomicImpact(candidate);
  const ecoV2 = estimateEconomicImpactV2(candidate);

  const economicImpact: EconomicImpact = {
    ...ecoV1,
    conservative: ecoV2.conservative,
    base: ecoV2.base,
    aggressive: ecoV2.aggressive,
    impliedROIMultiple: ecoV2.impliedROIMultiple,
    paybackPeriodMonths: ecoV2.paybackPeriodMonths,
    confidence: ecoV2.confidence,
  };

  const momentum = analyzeMomentum(candidate);
  const marketStructure = classifyMarketStructureV2(candidate);
  const marketSize = estimateMarketSize(candidate);
  const withMarket = { ...candidate, economicImpact, momentum, marketStructure, marketSize };
  const purpleOpportunities = generateWedges(withMarket);
  const withWedges = { ...withMarket, purpleOpportunities };
  const startupConcepts = synthesizeStartupConcepts(withWedges);
  const validationPlan = generateValidationPlan(withWedges);

  return { ...withWedges, startupConcepts, validationPlan };
}
