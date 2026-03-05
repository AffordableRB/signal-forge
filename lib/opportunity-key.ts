import { OpportunityCandidate } from './types';

// Deterministic key from candidate fields, stable across runs
export function opportunityKey(c: OpportunityCandidate): string {
  const slug = [c.jobToBeDone, c.vertical, c.targetBuyer]
    .map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('::');
  return slug;
}
