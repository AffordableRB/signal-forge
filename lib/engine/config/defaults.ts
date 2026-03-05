export const SCORING_WEIGHTS: Record<string, number> = {
  demand: 0.20,
  painIntensity: 0.15,
  abilityToPay: 0.20,
  competitionWeakness: 0.15,
  easeToBuild: 0.10,
  distributionAccess: 0.10,
  workflowAnchor: 0.10,
};

export const SUPPORTING_DETECTORS = [
  'marketExpansion',
  'marketTiming',
  'revenueDensity',
  'switchingFriction',
  'aiAdvantage',
];

export const REALITY_FILTER_RULES = {
  requireSignalTypes: ['demand', 'pain', 'money'] as const,
  requireBuyer: true,
  minRetention: 3,
  minEaseToBuild: 3,
};

export const REPORT_TOP_N = 10;
