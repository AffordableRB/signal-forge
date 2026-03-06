import { OpportunityCandidate, EconomicImpact } from '../models/types';

// Hourly rates by vertical (conservative estimates)
const HOURLY_RATES: Record<string, number> = {
  'home-services': 45,
  'healthcare': 65,
  'legal': 120,
  'real-estate': 50,
  'ecommerce': 35,
  'saas': 75,
  'finance': 80,
  'education': 40,
  'recruitment': 55,
  'general': 45,
};

// Revenue-per-lead by vertical
const REVENUE_PER_LEAD: Record<string, [number, number]> = {
  'home-services': [150, 2000],
  'healthcare': [200, 5000],
  'legal': [500, 10000],
  'real-estate': [1000, 25000],
  'ecommerce': [20, 200],
  'saas': [50, 500],
  'finance': [300, 5000],
  'education': [30, 300],
  'recruitment': [500, 5000],
  'general': [100, 1000],
};

export function estimateEconomicImpact(candidate: OpportunityCandidate): EconomicImpact {
  const vertical = candidate.vertical;
  const hourlyRate = HOURLY_RATES[vertical] ?? 45;
  const revPerLead = REVENUE_PER_LEAD[vertical] ?? [100, 1000];

  // Estimate hours wasted from pain signals
  const painSignals = candidate.evidence.filter(e => e.signalType === 'pain');
  const painScore = candidate.detectorResults.find(r => r.detectorId === 'painIntensity')?.score ?? 3;

  // Base hours: pain score maps to hours/month
  const hoursPerMonth = Math.max(2, Math.round(painScore * 2.5));

  // Labor cost
  const laborLow = Math.round(hoursPerMonth * hourlyRate * 0.7);
  const laborHigh = Math.round(hoursPerMonth * hourlyRate * 1.3);

  // Revenue loss estimate: based on demand signals and vertical
  const demandScore = candidate.detectorResults.find(r => r.detectorId === 'demand')?.score ?? 3;
  const missedLeadsPerMonth = Math.max(1, Math.round(demandScore * 1.5));
  const revLossLow = Math.round(missedLeadsPerMonth * revPerLead[0] * 0.3);
  const revLossHigh = Math.round(missedLeadsPerMonth * revPerLead[1] * 0.15);

  const totalLow = laborLow + revLossLow;
  const totalHigh = laborHigh + revLossHigh;

  // Economic pain score: combination of cost magnitude and pain intensity
  const costMagnitude = Math.min(10, Math.log10(Math.max(1, (totalLow + totalHigh) / 2)) * 2);
  const economicPainScore = Math.round(((painScore * 0.5) + (costMagnitude * 0.5)) * 10) / 10;

  // Build explanation from evidence
  const painExcerpts = painSignals.slice(0, 2).map(e => e.excerpt.slice(0, 80));
  const explanation = painExcerpts.length > 0
    ? `${candidate.targetBuyer}s lose ~${hoursPerMonth}h/mo on manual ${candidate.jobToBeDone}. Evidence: "${painExcerpts[0]}..."`
    : `Estimated ${hoursPerMonth}h/mo wasted on ${candidate.jobToBeDone} at $${hourlyRate}/hr in ${vertical}.`;

  return {
    timeCostHoursPerMonth: hoursPerMonth,
    laborCostPerMonth: [laborLow, laborHigh],
    revenueLossPerMonth: [revLossLow, revLossHigh],
    totalMonthlyCost: [totalLow, totalHigh],
    economicPainScore: Math.min(10, economicPainScore),
    explanation,
  };
}
