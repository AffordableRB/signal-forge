import { OpportunityCandidate, SignalType } from '../models/types';
import { REALITY_FILTER_RULES } from '../config/defaults';

export function applyFilters(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return candidates.map(c => filterCandidate(c));
}

function filterCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  const reasons: string[] = [];

  // Rule 1: Must have demand + pain + money signals
  const signalTypes = new Set(candidate.evidence.map(e => e.signalType));
  const missingTypes = REALITY_FILTER_RULES.requireSignalTypes.filter(
    t => !signalTypes.has(t as SignalType)
  );
  if (missingTypes.length > 0) {
    reasons.push(`Missing signal types: ${missingTypes.join(', ')}`);
  }

  // Rule 2: Must have a clear buyer
  if (REALITY_FILTER_RULES.requireBuyer && !candidate.targetBuyer) {
    reasons.push('No clear target buyer identified');
  }

  // Rule 3: Retention score must be >= 3 (unless explicitly one-time)
  const retentionScore = candidate.detectorResults.find(r => r.detectorId === 'workflowAnchor')?.score ?? 0;
  if (retentionScore < REALITY_FILTER_RULES.minRetention) {
    const isOneTime = candidate.jobToBeDone.toLowerCase().includes('one-time') ||
      candidate.evidence.some(e => e.excerpt.toLowerCase().includes('one-time'));
    if (!isOneTime) {
      reasons.push(`Low retention potential (workflowAnchor: ${retentionScore}/10, minimum: ${REALITY_FILTER_RULES.minRetention})`);
    }
  }

  // Rule 4: EaseToBuild must be >= 3 unless there's a clear wedge
  const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 0;
  if (easeScore < REALITY_FILTER_RULES.minEaseToBuild) {
    const demandScore = candidate.detectorResults.find(r => r.detectorId === 'demand')?.score ?? 0;
    const painScore = candidate.detectorResults.find(r => r.detectorId === 'painIntensity')?.score ?? 0;
    const hasWedge = demandScore >= 7 && painScore >= 7;
    if (!hasWedge) {
      reasons.push(`Too hard to build (easeToBuild: ${easeScore}/10) without clear competitive wedge`);
    }
  }

  return {
    ...candidate,
    rejected: reasons.length > 0,
    rejectionReasons: reasons,
  };
}
