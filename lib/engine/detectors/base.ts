import { OpportunityCandidate, DetectorResult } from '../models/types';

export interface Detector {
  id: string;
  analyze(candidate: OpportunityCandidate): DetectorResult;
}
