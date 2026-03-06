import { OpportunityCandidate, Momentum } from '../models/types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function analyzeMomentum(candidate: OpportunityCandidate): Momentum {
  const now = Date.now();
  const thirtyDaysAgo = now - THIRTY_DAYS_MS;
  const sixtyDaysAgo = now - (2 * THIRTY_DAYS_MS);

  let recent30d = 0;
  let previous30d = 0;
  let noTimestamp = 0;

  for (const e of candidate.evidence) {
    const ts = e.timestamp;
    if (!ts) {
      noTimestamp++;
      continue;
    }
    if (ts >= thirtyDaysAgo) {
      recent30d++;
    } else if (ts >= sixtyDaysAgo) {
      previous30d++;
    }
  }

  // If most evidence lacks timestamps, distribute proportionally
  if (noTimestamp > candidate.evidence.length * 0.5) {
    const total = candidate.evidence.length;
    recent30d = Math.round(total * 0.6);
    previous30d = Math.round(total * 0.3);
  }

  // Growth rate calculation
  let growthRate = 0;
  let trend: Momentum['trend'] = 'insufficient-data';

  if (previous30d > 0) {
    growthRate = Math.round(((recent30d - previous30d) / previous30d) * 100);

    if (growthRate > 50) trend = 'accelerating';
    else if (growthRate > -10) trend = 'stable';
    else trend = 'decelerating';
  } else if (recent30d > 0) {
    growthRate = 100;
    trend = 'accelerating';
  }

  // Momentum score: combination of volume and growth
  let momentumScore = 3; // base
  if (recent30d >= 10) momentumScore += 3;
  else if (recent30d >= 5) momentumScore += 2;
  else if (recent30d >= 2) momentumScore += 1;

  if (growthRate > 100) momentumScore += 3;
  else if (growthRate > 50) momentumScore += 2;
  else if (growthRate > 0) momentumScore += 1;
  else if (growthRate < -30) momentumScore -= 2;

  momentumScore = Math.max(1, Math.min(10, momentumScore));

  return {
    recent30d,
    previous30d,
    growthRate,
    momentumScore: Math.round(momentumScore * 10) / 10,
    trend,
  };
}
