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

export interface Competitor {
  name: string;
  url?: string;
  weaknesses: string[];
  pricingRange?: string;
  reviewScore?: number;
}

export interface DetectorResult {
  detectorId: string;
  score: number;
  explanation: string;
  confidence?: number;
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

export type OceanType = 'red' | 'blue' | 'purple';

export interface MarketStructure {
  type: OceanType;
  reason: string;
  competitorCount: number;
  maturityLevel: 'nascent' | 'emerging' | 'growing' | 'mature' | 'declining';
  innovationGap: number;
  pricingSimilarity: number;
  confidence?: number;
  adjacentCompetitorDensity?: number;
  featureOverlapScore?: number;
}

export interface PurpleOpportunity {
  wedgeType: string;
  title: string;
  explanation: string;
  feasibility: number;
  impact: number;
}

export interface ScenarioEstimate {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: number;
  revenueLossPerMonth: number;
  totalMonthlyCost: number;
}

export interface EconomicImpact {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: [number, number];
  revenueLossPerMonth: [number, number];
  totalMonthlyCost: [number, number];
  economicPainScore: number;
  explanation: string;
  conservative?: ScenarioEstimate;
  base?: ScenarioEstimate;
  aggressive?: ScenarioEstimate;
  impliedROIMultiple?: number;
  paybackPeriodMonths?: number;
  confidence?: number;
}

export interface MarketSize {
  potentialBuyers: number;
  adoptionRate: number;
  potentialCustomers: number;
  avgMonthlyPrice: number;
  revenueCeiling: number;
  explanation: string;
}

export interface Momentum {
  recent30d: number;
  previous30d: number;
  growthRate: number;
  momentumScore: number;
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
  overall: number;
  evidenceQuality: number;
  signalRelevance: number;
  contradictionScore: number;
  dataFreshness: number;
  detectorConfidence: Record<string, number>;
  contradictions: { contradictions: Contradiction[]; contradictionScore: number };
  excludedEvidence: number;
}

export interface ScoringOutput {
  topReasons: string[];
  bottomReasons: string[];
  evidenceQualitySummary: string;
  excludedNoiseSummary: string;
}

// ─── Deep Validation Types ──────────────────────────────────────────

export type ValidationVerdict = 'GO' | 'CONDITIONAL' | 'NO-GO';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  evidence: string;
  confidence: number;
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
  confidencePercent: number;
  checks: ValidationCheck[];
  unitEconomics: UnitEconomics;
  competitorDeepDive: CompetitorDeepDive[];
  first10Customers: First10Customers;
  exactGap: string;
  unfairAdvantage: string;
  biggestRisk: string;
  validationTests: ValidationTest[];
  killReasons: string[];
}

export interface OpportunityCandidate {
  id: string;
  vertical: string;
  jobToBeDone: string;
  targetBuyer: string;
  triggerMoment: string;
  evidence: Evidence[];
  competitors: Competitor[];
  detectorResults: DetectorResult[];
  scores: OpportunityScores;
  rejected: boolean;
  rejectionReasons: string[];
  riskFlags: RiskFlag[];
  marketStructure?: MarketStructure;
  purpleOpportunities?: PurpleOpportunity[];
  economicImpact?: EconomicImpact;
  marketSize?: MarketSize;
  momentum?: Momentum;
  startupConcepts?: StartupConcept[];
  validationPlan?: ValidationPlan;
  confidence?: ConfidenceBreakdown;
  scoringOutput?: ScoringOutput;
  deepValidation?: DeepValidation;
}

export interface CollectorStat {
  id: string;
  signalCount: number;
  status: 'success' | 'failed' | 'timeout';
  durationMs: number;
  error?: string;
}

export type ScanMode = 'quick' | 'standard' | 'deep' | 'thorough';
export type ScanPhase = 'discovery' | 'deep-evidence' | 'market-mapping' | 'cross-validation' | 'analysis';

export interface PhaseStatus {
  id: ScanPhase;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'skipped';
  durationMs?: number;
  signalsAdded?: number;
}

export interface RunRecord {
  id: string;
  date: string;
  status: 'running' | 'completed' | 'failed';
  scanMode?: ScanMode;
  topic?: string;
  phases?: PhaseStatus[];
  topScore?: number;
  topOpportunity?: string;
  candidateCount?: number;
  candidates?: OpportunityCandidate[];
  collectorStats?: CollectorStat[];
  queriesUsed?: string[];
  error?: string;
}
