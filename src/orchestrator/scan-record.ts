// Persistent scan record model.
// Tracks the full lifecycle of a scan.

import { ScanPhase, ScanMode } from './scan-phases';

export interface PhaseRecord {
  phase: ScanPhase;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  signalsAdded: number;
  jobIds: string[];
  error?: string;
}

export interface ScanRecord {
  id: string;
  mode: ScanMode;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentPhase: ScanPhase;
  phases: PhaseRecord[];
  progressPercent: number;
  queries: string[];
  signalCount: number;
  candidateCount: number;
  topScore: number;
  topOpportunity: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  errorSummary?: string;
}

export function createScanRecord(id: string, mode: ScanMode, queries: string[]): ScanRecord {
  const now = new Date().toISOString();
  return {
    id,
    mode,
    status: 'pending',
    currentPhase: 'PENDING',
    phases: [],
    progressPercent: 0,
    queries,
    signalCount: 0,
    candidateCount: 0,
    topScore: 0,
    topOpportunity: 'N/A',
    startedAt: now,
    updatedAt: now,
  };
}
