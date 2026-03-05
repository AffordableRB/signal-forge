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
}

export interface PipelineContext {
  signals: RawSignal[];
  candidates: OpportunityCandidate[];
  scored: OpportunityCandidate[];
  filtered: OpportunityCandidate[];
  ranked: OpportunityCandidate[];
}
