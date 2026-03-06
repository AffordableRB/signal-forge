import { OpportunityCandidate } from '../models/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioEstimate {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: number;
  revenueLossPerMonth: number;
  totalMonthlyCost: number;
}

export interface EconomicImpactV2 {
  // Three scenarios
  conservative: ScenarioEstimate;
  base: ScenarioEstimate;
  aggressive: ScenarioEstimate;

  // ROI & payback
  impliedROIMultiple: number;
  paybackPeriodMonths: number;

  // Original fields for backward compat
  economicPainScore: number; // 0-10
  explanation: string;
  confidence: number; // 0-100
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hourly rates by vertical (conservative estimates). */
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

/** Revenue-per-lead by vertical [low, high]. */
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

/** Assumed SaaS price by vertical ($/month). */
const SAAS_PRICE_BY_VERTICAL: Record<string, number> = {
  'home-services': 79,
  'legal': 149,
  'healthcare': 199,
  'saas': 99,
  'finance': 179,
  'real-estate': 129,
};

const DEFAULT_SAAS_PRICE = 99;

/** Scenario multipliers applied to the base estimate. */
const SCENARIO_MULTIPLIERS = {
  conservative: 0.5,
  base: 1.0,
  aggressive: 2.0,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSaasPrice(vertical: string): number {
  return SAAS_PRICE_BY_VERTICAL[vertical] ?? DEFAULT_SAAS_PRICE;
}

/**
 * Compute the base-case figures using the same logic as the original
 * `estimateEconomicImpact` (midpoint of the low/high ranges).
 */
function computeBaseEstimate(candidate: OpportunityCandidate): {
  hoursPerMonth: number;
  laborCost: number;
  revenueLoss: number;
} {
  const vertical = candidate.vertical;
  const hourlyRate = HOURLY_RATES[vertical] ?? 45;
  const revPerLead = REVENUE_PER_LEAD[vertical] ?? [100, 1000];

  const painScore =
    candidate.detectorResults.find((r) => r.detectorId === 'painIntensity')
      ?.score ?? 3;
  const demandScore =
    candidate.detectorResults.find((r) => r.detectorId === 'demand')?.score ??
    3;

  // Hours wasted per month
  const hoursPerMonth = Math.max(2, Math.round(painScore * 2.5));

  // Labor cost: midpoint of [0.7x, 1.3x] = 1.0x
  const laborCost = Math.round(hoursPerMonth * hourlyRate);

  // Missed leads per month
  const missedLeadsPerMonth = Math.max(1, Math.round(demandScore * 1.5));

  // Revenue loss: midpoint of low-end and high-end estimates
  const revLossLow = missedLeadsPerMonth * revPerLead[0] * 0.3;
  const revLossHigh = missedLeadsPerMonth * revPerLead[1] * 0.15;
  const revenueLoss = Math.round((revLossLow + revLossHigh) / 2);

  return { hoursPerMonth, laborCost, revenueLoss };
}

function applyMultiplier(
  base: { hoursPerMonth: number; laborCost: number; revenueLoss: number },
  multiplier: number,
): ScenarioEstimate {
  const timeCostHoursPerMonth = Math.max(
    1,
    Math.round(base.hoursPerMonth * multiplier),
  );
  const laborCostPerMonth = Math.round(base.laborCost * multiplier);
  const revenueLossPerMonth = Math.round(base.revenueLoss * multiplier);
  const totalMonthlyCost = laborCostPerMonth + revenueLossPerMonth;

  return {
    timeCostHoursPerMonth,
    laborCostPerMonth,
    revenueLossPerMonth,
    totalMonthlyCost,
  };
}

/**
 * Derive a confidence score (0-100) based on the richness of the evidence.
 *
 * Factors:
 *  - Number of money/pain signals in evidence
 *  - Whether pricing information was found in evidence
 *  - Whether the vertical is a known (specific) vertical vs "general"
 */
function computeConfidence(candidate: OpportunityCandidate): number {
  let confidence = 30; // baseline

  // Money & pain signals
  const moneySignals = candidate.evidence.filter(
    (e) => e.signalType === 'money',
  );
  const painSignals = candidate.evidence.filter(
    (e) => e.signalType === 'pain',
  );
  const signalCount = moneySignals.length + painSignals.length;

  // Up to +30 for signal volume (diminishing returns)
  confidence += Math.min(30, signalCount * 6);

  // +15 if pricing evidence exists (look for $ or "price" in money signal excerpts)
  const hasPricingEvidence = moneySignals.some(
    (e) =>
      /\$\d/.test(e.excerpt) ||
      /price|pricing|cost|fee/i.test(e.excerpt),
  );
  if (hasPricingEvidence) {
    confidence += 15;
  }

  // +10 for pain signals that mention specific dollar amounts
  const painWithDollars = painSignals.some((e) => /\$\d/.test(e.excerpt));
  if (painWithDollars) {
    confidence += 10;
  }

  // +15 if vertical is a known specific vertical (not "general")
  const knownVerticals = Object.keys(HOURLY_RATES).filter(
    (v) => v !== 'general',
  );
  if (knownVerticals.includes(candidate.vertical)) {
    confidence += 15;
  }

  return Math.min(100, confidence);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function estimateEconomicImpactV2(
  candidate: OpportunityCandidate,
): EconomicImpactV2 {
  const base = computeBaseEstimate(candidate);
  const price = getSaasPrice(candidate.vertical);

  // Build the three scenarios
  const conservative = applyMultiplier(base, SCENARIO_MULTIPLIERS.conservative);
  const baseScenario = applyMultiplier(base, SCENARIO_MULTIPLIERS.base);
  const aggressive = applyMultiplier(base, SCENARIO_MULTIPLIERS.aggressive);

  // Implied ROI multiple: how many times the SaaS price the problem costs
  const impliedROIMultiple =
    Math.round((baseScenario.totalMonthlyCost / price) * 100) / 100;

  // Payback period
  const onboardingCost = price * 3;
  const monthlySavings = baseScenario.totalMonthlyCost - price;
  const paybackPeriodMonths =
    monthlySavings > 0
      ? Math.round((onboardingCost / monthlySavings) * 10) / 10
      : Infinity;

  // Economic pain score (same formula as v1)
  const painScore =
    candidate.detectorResults.find((r) => r.detectorId === 'painIntensity')
      ?.score ?? 3;
  const costMagnitude = Math.min(
    10,
    Math.log10(Math.max(1, baseScenario.totalMonthlyCost)) * 2,
  );
  const economicPainScore =
    Math.min(
      10,
      Math.round((painScore * 0.5 + costMagnitude * 0.5) * 10) / 10,
    );

  // Explanation
  const hourlyRate = HOURLY_RATES[candidate.vertical] ?? 45;
  const painSignals = candidate.evidence.filter(
    (e) => e.signalType === 'pain',
  );
  const painExcerpts = painSignals
    .slice(0, 2)
    .map((e) => e.excerpt.slice(0, 80));
  const explanation =
    painExcerpts.length > 0
      ? `${candidate.targetBuyer}s lose ~${base.hoursPerMonth}h/mo on manual ${candidate.jobToBeDone}. Evidence: "${painExcerpts[0]}..."`
      : `Estimated ${base.hoursPerMonth}h/mo wasted on ${candidate.jobToBeDone} at $${hourlyRate}/hr in ${candidate.vertical}.`;

  // Confidence
  const confidence = computeConfidence(candidate);

  return {
    conservative,
    base: baseScenario,
    aggressive,
    impliedROIMultiple,
    paybackPeriodMonths,
    economicPainScore,
    explanation,
    confidence,
  };
}
