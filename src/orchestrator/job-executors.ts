// Job executor functions that bridge the queue system to existing engine modules.
// Each executor wraps an existing engine function with the typed contract the queue expects.
//
// These are the bounded worker tasks. They do NOT control flow.

import { RawSignal, OpportunityCandidate, EconomicImpact } from '../../lib/engine/models/types';
import { createCollectorById, CollectorStat } from '../../lib/engine/collectors';
import { deduplicateEvidence } from '../../lib/engine/collectors/dedup';
import { clusterSignals } from '../../lib/engine/cluster';
import { analyzeAll } from '../../lib/engine/detectors';
import { llmAnalyzeAll } from '../../lib/engine/detectors/llm-analyzer';
import { isLLMAvailable } from '../../lib/engine/detectors/llm-client';
import { scoreAll, rankCandidates } from '../../lib/engine/scoring';
import { applyFilters } from '../../lib/engine/filters';
import { applyKillSwitch } from '../../lib/engine/reality/kill-switch';
import { estimateEconomicImpact } from '../../lib/engine/detectors/economic-impact';
import { estimateEconomicImpactV2 } from '../../lib/engine/detectors/economic-impact-v2';
import { analyzeMomentum } from '../../lib/engine/detectors/momentum';
import { classifyMarketStructureV2 } from '../../lib/engine/market/market-structure-v2';
import { estimateMarketSize } from '../../lib/engine/market/market-size';
import { generateWedges } from '../../lib/engine/wedge/wedge-generator';
import { synthesizeStartupConcepts, generateValidationPlan } from '../../lib/engine/synthesis/synthesizer';
import { computeConfidence } from '../../lib/engine/confidence/confidence-scorer';
import { generateScoringOutput } from '../../lib/engine/confidence/scoring-output';
import { deepValidateTop } from '../../lib/engine/validation/deep-validator';
import {
  CollectJobInput, CollectJobOutput,
  ClusterJobInput, ClusterJobOutput,
  AnalyzeJobInput, AnalyzeJobOutput,
} from '../queue/job-types';

// ─── Collection executors ───────────────────────────────────────────

export async function executeCollectJob(input: CollectJobInput): Promise<CollectJobOutput> {
  const collector = createCollectorById(input.collectorId, input.options);
  if (!collector) {
    throw new Error(`Unknown collector: ${input.collectorId}`);
  }

  const signals = await collector.collect(input.queries);

  // Deduplicate within each signal
  for (const signal of signals) {
    signal.evidence = deduplicateEvidence(signal.evidence);
  }

  const stat: CollectorStat = {
    id: input.collectorId,
    signalCount: signals.length,
    status: 'success',
    durationMs: 0, // tracked by the queue
  };

  return { signals, stat };
}

// ─── Clustering executor ────────────────────────────────────────────

export async function executeClusterJob(input: ClusterJobInput): Promise<ClusterJobOutput> {
  const candidates = clusterSignals(input.signals);
  return { candidates };
}

// ─── Detection executor ─────────────────────────────────────────────

export async function executeAnalyzeJob(input: AnalyzeJobInput): Promise<AnalyzeJobOutput> {
  const analyzed = isLLMAvailable()
    ? await llmAnalyzeAll(input.candidates)
    : analyzeAll(input.candidates);
  return { candidates: analyzed };
}

// ─── Scoring executor ───────────────────────────────────────────────

export async function executeScoreJob(input: { candidates: OpportunityCandidate[] }): Promise<{ candidates: OpportunityCandidate[] }> {
  const scored = scoreAll(input.candidates);
  return { candidates: scored };
}

// ─── Enrichment executor (single candidate) ─────────────────────────

export function enrichCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
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
  const validationPlanResult = generateValidationPlan(withWedges);

  return { ...withWedges, startupConcepts, validationPlan: validationPlanResult };
}

// ─── Full analysis pipeline executor ────────────────────────────────
// Runs the complete analysis chain on accumulated signals.
// Used by the FINAL_ANALYSIS phase.

export async function executeFullAnalysis(signals: RawSignal[]): Promise<OpportunityCandidate[]> {
  // Deduplicate
  for (const signal of signals) {
    signal.evidence = deduplicateEvidence(signal.evidence);
  }

  // Cluster
  const candidates = clusterSignals(signals);

  // Detect (LLM if available, keyword fallback)
  const analyzed = isLLMAvailable()
    ? await llmAnalyzeAll(candidates)
    : analyzeAll(candidates);
  const reanalyzed = analyzed; // LLM already does full analysis; keyword mode re-runs for consistency

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

  // Deep validation on top 2
  return deepValidateTop(ranked, 2);
}
