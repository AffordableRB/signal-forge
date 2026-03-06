import { OpportunityCandidate } from '../models/types';
import { computeEvidenceQualityScore } from './evidence-weights';
import { filterByRelevance } from './relevance-filter';
import { detectContradictions, ContradictionResult } from './contradiction-detector';

export interface ConfidenceBreakdown {
  overall: number; // 0-100
  evidenceQuality: number; // 0-100
  signalRelevance: number; // 0-100
  contradictionScore: number; // 0-100 (higher = worse)
  dataFreshness: number; // 0-100
  detectorConfidence: Record<string, number>; // per-detector confidence 0-100
  contradictions: ContradictionResult;
  excludedEvidence: number; // count of irrelevant evidence
}

export function computeConfidence(candidate: OpportunityCandidate): ConfidenceBreakdown {
  // Evidence quality
  const evidenceQuality = computeEvidenceQualityScore(candidate.evidence);

  // Signal relevance
  const relevance = filterByRelevance(
    candidate.evidence,
    candidate.jobToBeDone,
    candidate.targetBuyer,
    candidate.vertical
  );
  const signalRelevance = relevance.signalRelevanceScore;
  const excludedEvidence = relevance.irrelevant.length;

  // Contradictions
  const contradictions = detectContradictions(candidate);
  const contradictionScore = contradictions.contradictionScore;

  // Data freshness: what % of evidence has timestamps in last 90 days?
  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  const withTimestamp = candidate.evidence.filter(e => e.timestamp);
  let dataFreshness: number;
  if (withTimestamp.length === 0) {
    dataFreshness = 30; // no timestamp data = low confidence in freshness
  } else {
    const fresh = withTimestamp.filter(e => (now - (e.timestamp ?? 0)) < ninetyDays);
    dataFreshness = Math.round((fresh.length / withTimestamp.length) * 100);
  }

  // Per-detector confidence based on evidence support
  const detectorConfidence: Record<string, number> = {};
  for (const dr of candidate.detectorResults) {
    // Base confidence from score extremity (extreme scores = need more evidence)
    const scoreExtremity = Math.abs(dr.score - 5) / 5; // 0-1
    const evidenceSupport = Math.min(1, candidate.evidence.length / 10);

    let conf = 50; // base
    conf += evidenceSupport * 25; // up to +25 for evidence volume
    conf -= scoreExtremity * 15; // penalty for extreme scores (need more support)
    conf += (evidenceQuality / 100) * 15; // up to +15 for quality
    conf -= (contradictionScore / 100) * 10; // penalty for contradictions

    detectorConfidence[dr.detectorId] = Math.round(Math.max(10, Math.min(95, conf)));
  }

  // Overall confidence
  const overall = Math.round(
    evidenceQuality * 0.3 +
    signalRelevance * 0.25 +
    (100 - contradictionScore) * 0.2 +
    dataFreshness * 0.15 +
    Math.min(100, candidate.evidence.length * 5) * 0.1 // volume factor
  );

  return {
    overall: Math.max(5, Math.min(95, overall)),
    evidenceQuality,
    signalRelevance,
    contradictionScore,
    dataFreshness,
    detectorConfidence,
    contradictions,
    excludedEvidence,
  };
}
