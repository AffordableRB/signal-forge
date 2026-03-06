// Integration test - runs a quick scan and validates output structure
import { ScanOrchestrator } from '../src/orchestrator';
import { InMemoryScanStore } from '../src/state/scan-store';
import { JobQueue } from '../src/queue/job-queue';

interface ValidationResult { check: string; passed: boolean; detail?: string; }

export async function runIntegrationTest(): Promise<{ passed: boolean; results: ValidationResult[]; durationMs: number }> {
  const results: ValidationResult[] = [];
  const start = Date.now();
  const store = new InMemoryScanStore();
  const queue = new JobQueue();
  const orchestrator = new ScanOrchestrator(store, queue);

  let scan;
  try {
    scan = await orchestrator.runScan('quick', () => {});
  } catch (err) {
    results.push({ check: 'scan completes without throwing', passed: false, detail: err instanceof Error ? err.message : 'Unknown' });
    return { passed: false, results, durationMs: Date.now() - start };
  }

  results.push({ check: 'scan status is completed', passed: scan.status === 'completed', detail: scan.status });
  results.push({ check: 'at least 2 candidates produced', passed: scan.candidateCount >= 2, detail: scan.candidateCount + ' candidates' });
  results.push({ check: 'top score is in 1-10 range', passed: scan.topScore >= 1 && scan.topScore <= 10, detail: 'topScore=' + scan.topScore.toFixed(2) });
  results.push({ check: 'non-zero signal count', passed: scan.signalCount > 0, detail: scan.signalCount + ' signals' });
  results.push({ check: 'top opportunity is identified', passed: scan.topOpportunity !== 'N/A' && scan.topOpportunity.length > 0, detail: scan.topOpportunity });

  const failedPhases = scan.phases.filter((p: { status: string }) => p.status === 'failed');
  results.push({
    check: 'no critical phase failures',
    passed: !scan.phases.some((p: { phase: string; status: string }) => p.phase === 'ANALYSIS' && p.status === 'failed'),
    detail: failedPhases.length > 0 ? failedPhases.length + ' failed' : 'all phases ok',
  });

  const scanAny = scan as unknown as Record<string, unknown>;
  if (Array.isArray(scanAny.candidates) && scanAny.candidates.length > 0) {
    const candidates = scanAny.candidates as Array<{ scores: { final: number }; marketStructure?: { type: string }; evidence: unknown[] }>;
    results.push({ check: 'all candidate scores in 0-10 range', passed: candidates.every(c => c.scores.final >= 0 && c.scores.final <= 10) });
    results.push({ check: 'all market classifications are valid', passed: candidates.every(c => !c.marketStructure || ['red', 'blue', 'purple'].includes(c.marketStructure.type)) });
    results.push({ check: 'at least one candidate has evidence', passed: candidates.some(c => c.evidence && c.evidence.length > 0) });
  }

  return { passed: results.every(r => r.passed), results, durationMs: Date.now() - start };
}
