export type SignalType = 'demand' | 'pain' | 'money' | 'competition';

export interface Evidence {
  source: string;
  url: string;
  excerpt: string;
  signalType: SignalType;
  timestamp?: number;
  sourceTier?: 1 | 2 | 3;
  confidence?: number;
}

export interface RawSignal {
  collectorId: string;
  timestamp: string;
  query: string;
  evidence: Evidence[];
  metadata?: Record<string, unknown>;
}

export interface Competitor {
  name: string;
  url?: string;
  weaknesses: string[];
  pricingRange?: string;
  reviewScore?: number;
}

export interface DetectorResult {
  detectorId: string;
  score: number; // 0-10
  explanation: string;
  confidence?: number; // 0-100
}

export interface RiskFlag {
  id: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface OpportunityScores {
  final: number;
  breakdown: Record<string, number>;
}

// --- New types for extended analysis ---

export type OceanType = 'red' | 'blue' | 'purple';

export interface MarketStructure {
  type: OceanType;
  reason: string;
  competitorCount: number;
  maturityLevel: 'nascent' | 'emerging' | 'growing' | 'mature' | 'declining';
  innovationGap: number; // 0-10
  pricingSimilarity: number; // 0-10 (10 = all same pricing)
  confidence?: number; // 0-100
  adjacentCompetitorDensity?: number; // 0-10
  featureOverlapScore?: number; // 0-10
}

export interface PurpleOpportunity {
  wedgeType: string;
  title: string;
  explanation: string;
  feasibility: number; // 0-10
  impact: number; // 0-10
}

export interface ScenarioEstimate {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: number;
  revenueLossPerMonth: number;
  totalMonthlyCost: number;
}

export interface EconomicImpact {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: [number, number]; // [low, high]
  revenueLossPerMonth: [number, number]; // [low, high]
  totalMonthlyCost: [number, number]; // [low, high]
  economicPainScore: number; // 0-10
  explanation: string;
  // V2 scenario modeling
  conservative?: ScenarioEstimate;
  base?: ScenarioEstimate;
  aggressive?: ScenarioEstimate;
  impliedROIMultiple?: number;
  paybackPeriodMonths?: number;
  confidence?: number; // 0-100
}

export interface MarketSize {
  potentialBuyers: number;
  adoptionRate: number;
  potentialCustomers: number;
  avgMonthlyPrice: number;
  revenueCeiling: number; // annual
  explanation: string;
}

export interface Momentum {
  recent30d: number;
  previous30d: number;
  growthRate: number; // percentage
  momentumScore: number; // 0-10
  trend: 'accelerating' | 'stable' | 'decelerating' | 'insufficient-data';
}

export interface StartupConcept {
  name: string;
  oneLiner: string;
  wedge: string;
  technology: string;
  goToMarket: string;
}

export interface ValidationPlan {
  interviewQuestions: string[];
  outreachMessages: string[];
  sevenDayPlan: string[];
}

export interface Contradiction {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  fields: [string, string];
}

export interface ConfidenceBreakdown {
  overall: number; // 0-100
  evidenceQuality: number; // 0-100
  signalRelevance: number; // 0-100
  contradictionScore: number; // 0-100 (higher = more contradictions = worse)
  dataFreshness: number; // 0-100
  detectorConfidence: Record<string, number>; // per-detector 0-100
  contradictions: { contradictions: Contradiction[]; contradictionScore: number };
  excludedEvidence: number;
}

export interface ScoringOutput {
  topReasons: string[];
  bottomReasons: string[];
  evidenceQualitySummary: string;
  excludedNoiseSummary: string;
}

export interface OpportunityCandidate {
  id: string;
  vertical: string;
  jobToBeDone: string;
  targetBuyer: string;
  triggerMoment: string;
  evidence: Evidence[];
  competitors: Competitor[];
  rawSignals: RawSignal[];
  detectorResults: DetectorResult[];
  scores: OpportunityScores;
  rejected: boolean;
  rejectionReasons: string[];
  riskFlags: RiskFlag[];
  // Extended analysis (populated by new pipeline stages)
  marketStructure?: MarketStructure;
  purpleOpportunities?: PurpleOpportunity[];
  economicImpact?: EconomicImpact;
  marketSize?: MarketSize;
  momentum?: Momentum;
  startupConcepts?: StartupConcept[];
  validationPlan?: ValidationPlan;
  // Confidence & objectivity layer
  confidence?: ConfidenceBreakdown;
  scoringOutput?: ScoringOutput;
  // Deep validation (only on top opportunities)
  deepValidation?: DeepValidation;
}

// ─── Deep Validation Types ──────────────────────────────────────────

export type ValidationVerdict = 'GO' | 'CONDITIONAL' | 'NO-GO';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  evidence: string;
  confidence: number; // 0-100
}

export interface UnitEconomics {
  estimatedCAC: string;
  estimatedLTV: string;
  estimatedMargin: string;
  monthlyRevenueAt100Customers: string;
  breakEvenCustomers: number;
  reasoning: string;
}

export interface CompetitorDeepDive {
  name: string;
  estimatedRevenue: string;
  mainWeakness: string;
  whyYouWin: string;
  switchingCost: string;
}

export interface First10Customers {
  segment: string;
  howToReach: string;
  estimatedConversionRate: string;
  exampleOutreach: string;
}

export interface ValidationTest {
  testType: string;
  description: string;
  successCriteria: string;
  timeRequired: string;
  costRequired: string;
}

export interface DeepValidation {
  verdict: ValidationVerdict;
  verdictReasoning: string;
  confidencePercent: number; // 0-100 how confident in the verdict
  checks: ValidationCheck[];
  unitEconomics: UnitEconomics;
  competitorDeepDive: CompetitorDeepDive[];
  first10Customers: First10Customers;
  exactGap: string; // the specific gap in existing solutions
  unfairAdvantage: string; // what would make YOU specifically able to win
  biggestRisk: string;
  validationTests: ValidationTest[];
  killReasons: string[]; // reasons this could fail even with good signals
}

export interface PipelineContext {
  signals: RawSignal[];
  candidates: OpportunityCandidate[];
  scored: OpportunityCandidate[];
  filtered: OpportunityCandidate[];
  ranked: OpportunityCandidate[];
}
