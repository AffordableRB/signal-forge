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
}

export interface PurpleOpportunity {
  wedgeType: string;
  title: string;
  explanation: string;
  feasibility: number; // 0-10
  impact: number; // 0-10
}

export interface EconomicImpact {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: [number, number]; // [low, high]
  revenueLossPerMonth: [number, number]; // [low, high]
  totalMonthlyCost: [number, number]; // [low, high]
  economicPainScore: number; // 0-10
  explanation: string;
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
}

export interface PipelineContext {
  signals: RawSignal[];
  candidates: OpportunityCandidate[];
  scored: OpportunityCandidate[];
  filtered: OpportunityCandidate[];
  ranked: OpportunityCandidate[];
}
