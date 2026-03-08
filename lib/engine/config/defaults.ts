export const SCORING_WEIGHTS: Record<string, number> = {
  // Core detectors — these define whether the opportunity is real
  demand: 0.12,
  painIntensity: 0.12,
  abilityToPay: 0.15,
  competitionWeakness: 0.20,   // Highest weight — saturated markets kill opportunities
  easeToBuild: 0.06,
  distributionAccess: 0.08,
  workflowAnchor: 0.07,
  // Supporting detectors — now contribute to score
  marketTiming: 0.05,
  revenueDensity: 0.05,
  switchingFriction: 0.04,
  aiAdvantage: 0.03,
  marketExpansion: 0.03,
};

export const SUPPORTING_DETECTORS: string[] = [];  // All detectors now weighted

export const REALITY_FILTER_RULES = {
  requireSignalTypes: ['demand', 'pain', 'money'] as const,
  requireBuyer: true,
  minRetention: 3,
  minEaseToBuild: 3,
};

export const REPORT_TOP_N = 10;
