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

  const final = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : 0;

  return { final, breakdown };
}

export function rankCandidates(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return [...candidates].sort((a, b) => b.scores.final - a.scores.final);
}
