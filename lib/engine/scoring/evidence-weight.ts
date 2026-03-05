import { Evidence } from '../models/types';

const TIER_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 0.7,
  3: 0.4,
};

export function evidenceWeight(e: Evidence): number {
  const tier = e.sourceTier ?? 2;
  const conf = e.confidence ?? 0.5;
  return conf * (TIER_MULTIPLIERS[tier] ?? 0.5);
}

export function weightedEvidenceCount(evidence: Evidence[]): number {
  return evidence.reduce((sum, e) => sum + evidenceWeight(e), 0);
}

export function deduplicatedEvidence(evidence: Evidence[]): Evidence[] {
  const seen = new Map<string, Evidence>();
  for (const e of evidence) {
    const key = `${e.source}::${e.signalType}`;
    const existing = seen.get(key);
    if (!existing || evidenceWeight(e) > evidenceWeight(existing)) {
      seen.set(key, e);
    }
  }
  return Array.from(seen.values());
}
