// Orchestrator public API.
// This is the only entry point external code should use.

export { ScanOrchestrator } from './scan-orchestrator';
export type { ScanProgress, ProgressCallback } from './scan-orchestrator';
export type { ScanPhase, ScanMode } from './scan-phases';
export { PHASE_SEQUENCE, SCAN_PHASES } from './scan-phases';
export type { ScanRecord, PhaseRecord } from './scan-record';
export { createScanRecord } from './scan-record';
export { enrichCandidate, executeFullAnalysis } from './job-executors';
