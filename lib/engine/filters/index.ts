import { OpportunityCandidate, SignalType, RiskFlag } from '../models/types';
import { REALITY_FILTER_RULES } from '../config/defaults';

export function applyFilters(candidates: OpportunityCandidate[]): OpportunityCandidate[] {
  return candidates.map(c => filterCandidate(c));
}

// Determine if the candidate has thin evidence (sparse data from few collectors)
function isThinEvidence(candidate: OpportunityCandidate): boolean {
  return candidate.evidence.length < 5;
}

function filterCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  const reasons: string[] = [];
  const newRisks: RiskFlag[] = [];
  const thin = isThinEvidence(candidate);

  // Rule 1: Signal type coverage
  const signalTypes = new Set(candidate.evidence.map(e => e.signalType));
  const presentTypes = REALITY_FILTER_RULES.requireSignalTypes.filter(
    t => signalTypes.has(t as SignalType)
  );
  if (presentTypes.length < 2) {
    const missingTypes = REALITY_FILTER_RULES.requireSignalTypes.filter(
      t => !signalTypes.has(t as SignalType)
    );
    if (thin) {
      // Thin evidence: downgrade to risk instead of hard rejection
      newRisks.push({ id: 'thin-signal-types', severity: 'medium', description: `Thin evidence — missing signal types: ${missingTypes.join(', ')}` });
    } else {
      reasons.push(`Missing signal types: ${missingTypes.join(', ')} (need at least 2 of 3)`);
    }
  }

  // Rule 2: Must have a clear buyer
  if (REALITY_FILTER_RULES.requireBuyer && !candidate.targetBuyer) {
    if (thin) {
      newRisks.push({ id: 'thin-no-buyer', severity: 'medium', description: 'No clear target buyer identified (limited data)' });
    } else {
      reasons.push('No clear target buyer identified');
    }
  }

  // Rule 3: Retention score must be >= 3 (unless explicitly one-time)
  const retentionScore = candidate.detectorResults.find(r => r.detectorId === 'workflowAnchor')?.score ?? 0;
  if (retentionScore < REALITY_FILTER_RULES.minRetention) {
    const isOneTime = candidate.jobToBeDone.toLowerCase().includes('one-time') ||
      candidate.evidence.some(e => e.excerpt.toLowerCase().includes('one-time'));
    if (!isOneTime) {
      if (thin) {
        newRisks.push({ id: 'thin-low-retention', severity: 'low', description: `Low retention signal (workflowAnchor: ${retentionScore}/10, limited data)` });
      } else {
        reasons.push(`Low retention potential (workflowAnchor: ${retentionScore}/10, minimum: ${REALITY_FILTER_RULES.minRetention})`);
      }
    }
  }

  // Rule 4: EaseToBuild must be >= 3 unless there's a clear wedge
  const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 0;
  if (easeScore < REALITY_FILTER_RULES.minEaseToBuild) {
    const demandScore = candidate.detectorResults.find(r => r.detectorId === 'demand')?.score ?? 0;
    const painScore = candidate.detectorResults.find(r => r.detectorId === 'painIntensity')?.score ?? 0;
    const hasWedge = demandScore >= 7 && painScore >= 7;
    if (!hasWedge) {
      // R4 always hard-rejects regardless of evidence depth
      reasons.push(`Too hard to build (easeToBuild: ${easeScore}/10) without clear competitive wedge`);
    }
  }

  return {
    ...candidate,
    rejected: reasons.length > 0,
    rejectionReasons: reasons,
    riskFlags: [...(candidate.riskFlags ?? []), ...newRisks],
  };
}
