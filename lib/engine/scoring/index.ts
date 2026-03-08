import { OpportunityCandidate, OpportunityScores } from '../models/types';
import { SCORING_WEIGHTS } from '../config/defaults';

export function scoreCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  const scores = calculateScores(candidate);
  return { ...candidate, scores };
}

export function scoreAll(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return candidates.map(c => scoreCandidate(c));
}

function calculateScores(candidate: OpportunityCandidate): OpportunityScores {
  const breakdown: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of candidate.detectorResults) {
    breakdown[result.detectorId] = result.score;

    const weight = SCORING_WEIGHTS[result.detectorId];
    if (weight !== undefined) {
      weightedSum += result.score * weight;
      totalWeight += weight;
    }
  }

  let base = totalWeight > 0
    ? weightedSum / totalWeight
    : 0;

  // ─── Competition gate ─────────────────────────────────────────────
  // A saturated market should CAP the score, not just reduce it slightly.
  // If competitionWeakness is low, it means strong competitors exist —
  // even high demand can't save a crowded market for a new entrant.
  const compScore = breakdown['competitionWeakness'] ?? 5;
  if (compScore <= 2) {
    // Hyper-saturated (CRM, email marketing, todo apps)
    // Cap at 4.0 regardless of other signals
    base = Math.min(base, 4.0);
  } else if (compScore <= 4) {
    // Competitive but not impossible
    // Cap at 6.0
    base = Math.min(base, 6.0);
  }
  // compScore >= 5: no cap — genuine gaps exist

  // ─── Pain gate ────────────────────────────────────────────────────
  // Without real pain, demand is just curiosity, not a business
  const painScore = breakdown['painIntensity'] ?? 5;
  if (painScore <= 2) {
    base = Math.min(base, 5.0);
  }

  const final = Math.round(base * 100) / 100;
  return { final, breakdown };
}

export function rankCandidates(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return [...candidates].sort((a, b) => b.scores.final - a.scores.final);
}
