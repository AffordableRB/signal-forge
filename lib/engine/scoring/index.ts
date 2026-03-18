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
  } else if (compScore <= 3) {
    // Very competitive — hard for a new entrant
    // Cap at 5.5
    base = Math.min(base, 5.5);
  }
  // compScore >= 4: no hard cap — vertical niches with some competitors
  // can still be good opportunities if competitors are weak

  // ─── Pain gate ────────────────────────────────────────────────────
  // Without real pain, demand is just curiosity, not a business
  const painScore = breakdown['painIntensity'] ?? 5;
  if (painScore <= 2) {
    base = Math.min(base, 5.0);
  }

  // ─── Unit economics gate ────────────────────────────────────────
  // If the business model math doesn't work, cap the score
  const econScore = breakdown['unitEconomics'] ?? 5;
  if (econScore <= 2) {
    // Fundamentally broken unit economics (LTV < CAC)
    base = Math.min(base, 4.5);
  } else if (econScore <= 3) {
    // Marginal unit economics — risky
    base = Math.min(base, 5.5);
  }

  // ─── Defensibility penalty ──────────────────────────────────────
  // Easy-to-copy businesses with no moat get penalized
  const defenseScore = breakdown['defensibility'] ?? 5;
  if (defenseScore <= 2 && compScore >= 5) {
    // No moat AND competition exists — vulnerable
    base = Math.min(base, 5.0);
  }

  const final = Math.round(base * 100) / 100;
  return { final, breakdown };
}

export function rankCandidates(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return [...candidates].sort((a, b) => b.scores.final - a.scores.final);
}
