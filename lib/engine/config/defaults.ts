export const SCORING_WEIGHTS: Record<string, number> = {
  // Core detectors — these define whether the opportunity is real
  demand: 0.10,
  painIntensity: 0.10,
  abilityToPay: 0.12,
  competitionWeakness: 0.16,   // Highest weight — saturated markets kill opportunities
  // Viability detectors — can you actually build a business here?
  unitEconomics: 0.08,         // Does the math work? CAC vs LTV
  defensibility: 0.07,         // Can you defend against copycats?
  distributionAccess: 0.07,
  founderFit: 0.05,            // Can a solo/small founder win this?
  easeToBuild: 0.05,
  workflowAnchor: 0.05,
  // Supporting detectors
  marketTiming: 0.04,
  revenueDensity: 0.04,
  momentum: 0.03,            // Rising or falling interest — trending up = better timing
  switchingFriction: 0.03,
  aiAdvantage: 0.02,
  marketExpansion: 0.02,
};

export const SUPPORTING_DETECTORS: string[] = [];  // All detectors now weighted

export const REALITY_FILTER_RULES = {
  requireSignalTypes: ['demand', 'pain', 'money'] as const,
  requireBuyer: true,
  minRetention: 3,
  minEaseToBuild: 3,
};

export const REPORT_TOP_N = 10;
