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
}

export interface PurpleOpportunity {
  wedgeType: string;
  title: string;
  explanation: string;
  feasibility: number;
  impact: number;
}

export interface EconomicImpact {
  timeCostHoursPerMonth: number;
  laborCostPerMonth: [number, number];
  revenueLossPerMonth: [number, number];
  totalMonthlyCost: [number, number];
  economicPainScore: number;
  explanation: string;
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
}

export interface RunRecord {
  id: string;
  date: string;
  status: 'running' | 'completed' | 'failed';
  topScore?: number;
  topOpportunity?: string;
  candidateCount?: number;
  candidates?: OpportunityCandidate[];
  error?: string;
}
