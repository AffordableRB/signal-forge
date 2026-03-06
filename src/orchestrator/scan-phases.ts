// Deterministic scan phase definitions.
// The orchestrator uses these to control state transitions.
// AI never controls phase progression.

export const SCAN_PHASES = [
  'PENDING',
  'DISCOVERY',
  'DEEP_EVIDENCE',
  'MARKET_MAPPING',
  'CROSS_VALIDATION',
  'FINAL_ANALYSIS',
  'REPORTING',
  'COMPLETED',
  'FAILED',
] as const;

export type ScanPhase = (typeof SCAN_PHASES)[number];

export type ScanMode = 'quick' | 'standard' | 'deep';

// Which phases run for each scan mode
export const PHASE_SEQUENCE: Record<ScanMode, ScanPhase[]> = {
  quick: ['DISCOVERY', 'FINAL_ANALYSIS', 'REPORTING'],
  standard: ['DISCOVERY', 'MARKET_MAPPING', 'FINAL_ANALYSIS', 'REPORTING'],
  deep: ['DISCOVERY', 'DEEP_EVIDENCE', 'MARKET_MAPPING', 'CROSS_VALIDATION', 'FINAL_ANALYSIS', 'REPORTING'],
};

// Valid transitions from each phase
export const VALID_TRANSITIONS: Record<ScanPhase, ScanPhase[]> = {
  PENDING:           ['DISCOVERY', 'FAILED'],
  DISCOVERY:         ['DEEP_EVIDENCE', 'MARKET_MAPPING', 'FINAL_ANALYSIS', 'FAILED'],
  DEEP_EVIDENCE:     ['MARKET_MAPPING', 'FINAL_ANALYSIS', 'FAILED'],
  MARKET_MAPPING:    ['CROSS_VALIDATION', 'FINAL_ANALYSIS', 'FAILED'],
  CROSS_VALIDATION:  ['FINAL_ANALYSIS', 'FAILED'],
  FINAL_ANALYSIS:    ['REPORTING', 'FAILED'],
  REPORTING:         ['COMPLETED', 'FAILED'],
  COMPLETED:         [],
  FAILED:            [],
};

export function isValidTransition(from: ScanPhase, to: ScanPhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getNextPhase(mode: ScanMode, current: ScanPhase): ScanPhase | null {
  const sequence = PHASE_SEQUENCE[mode];
  const idx = sequence.indexOf(current);
  if (idx === -1 || idx >= sequence.length - 1) return null;
  return sequence[idx + 1];
}
