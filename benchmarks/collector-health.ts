// Collector health check — validates collector output shapes
import { RawSignal, Evidence, SignalType } from '../lib/engine/models/types';
import { ALL_COLLECTOR_IDS, createCollectorById } from '../lib/engine/collectors/index';

const VALID_SIGNAL_TYPES: SignalType[] = ['demand', 'pain', 'money', 'competition'];
const VALID_SOURCE_TIERS: (1 | 2 | 3)[] = [1, 2, 3];

interface HealthCheckResult {
  collectorId: string;
  passed: boolean;
  checks: { check: string; passed: boolean; detail?: string }[];
}

function validateEvidence(e: Evidence, idx: number): { check: string; passed: boolean; detail?: string }[] {
  const r: { check: string; passed: boolean; detail?: string }[] = [];
  r.push({ check: `evidence[${idx}].source is non-empty string`, passed: typeof e.source === 'string' && e.source.length > 0 });
  r.push({ check: `evidence[${idx}].url is string`, passed: typeof e.url === 'string' });
  r.push({ check: `evidence[${idx}].excerpt is non-empty string`, passed: typeof e.excerpt === 'string' && e.excerpt.length > 0 });
  r.push({ check: `evidence[${idx}].signalType is valid`, passed: VALID_SIGNAL_TYPES.includes(e.signalType), detail: e.signalType });
  if (e.sourceTier != null) r.push({ check: `evidence[${idx}].sourceTier is 1|2|3`, passed: VALID_SOURCE_TIERS.includes(e.sourceTier) });
  if (e.confidence != null) r.push({ check: `evidence[${idx}].confidence is 0-1`, passed: typeof e.confidence === 'number' && e.confidence >= 0 && e.confidence <= 1 });
  if (e.timestamp != null) r.push({ check: `evidence[${idx}].timestamp is positive number`, passed: typeof e.timestamp === 'number' && e.timestamp > 0 });
  return r;
}

function validateRawSignal(signal: RawSignal, idx: number): { check: string; passed: boolean; detail?: string }[] {
  const r: { check: string; passed: boolean; detail?: string }[] = [];
  r.push({ check: `signal[${idx}].collectorId is non-empty string`, passed: typeof signal.collectorId === 'string' && signal.collectorId.length > 0 });
  r.push({ check: `signal[${idx}].timestamp is ISO string`, passed: typeof signal.timestamp === 'string' && !isNaN(Date.parse(signal.timestamp)) });
  r.push({ check: `signal[${idx}].query is non-empty string`, passed: typeof signal.query === 'string' && signal.query.length > 0 });
  r.push({ check: `signal[${idx}].evidence is array`, passed: Array.isArray(signal.evidence) });
  if (Array.isArray(signal.evidence)) {
    for (let i = 0; i < signal.evidence.length; i++) r.push(...validateEvidence(signal.evidence[i], i));
  }
  return r;
}

export function validateCollectorOutput(collectorId: string, signals: RawSignal[]): HealthCheckResult {
  const checks: { check: string; passed: boolean; detail?: string }[] = [];
  checks.push({ check: 'output is array', passed: Array.isArray(signals) });
  if (!Array.isArray(signals)) return { collectorId, passed: false, checks };
  for (let i = 0; i < signals.length; i++) checks.push(...validateRawSignal(signals[i], i));
  return { collectorId, passed: checks.every(c => c.passed), checks };
}

function makeMockSignal(collectorId: string): RawSignal {
  return {
    collectorId, timestamp: new Date().toISOString(), query: 'test query',
    evidence: [
      { source: `${collectorId}:test`, url: 'https://example.com/test', excerpt: 'Test evidence excerpt', signalType: 'demand', sourceTier: 2, confidence: 0.7, timestamp: Date.now() },
      { source: `${collectorId}:test`, url: 'https://example.com/test2', excerpt: 'Second test excerpt', signalType: 'pain', sourceTier: 2, confidence: 0.6, timestamp: Date.now() - 86400000 },
    ],
  };
}

export function runCollectorHealthChecks(): { passed: number; failed: number; total: number; results: HealthCheckResult[] } {
  const results: HealthCheckResult[] = [];
  for (const id of ALL_COLLECTOR_IDS) {
    const collector = createCollectorById(id);
    const checks: { check: string; passed: boolean; detail?: string }[] = [];
    checks.push({ check: `createCollectorById("${id}") returns a collector`, passed: collector !== null });
    if (collector) {
      checks.push({ check: `collector.id matches "${id}"`, passed: collector.id === id, detail: collector.id });
      checks.push({ check: 'collector.collect is a function', passed: typeof collector.collect === 'function' });
    }
    const mockSignal = makeMockSignal(id);
    const shapeResult = validateCollectorOutput(id, [mockSignal]);
    checks.push(...shapeResult.checks);
    results.push({ collectorId: id, passed: checks.every(c => c.passed), checks });
  }

  // Negative validation
  const badSignal: RawSignal = { collectorId: '', timestamp: 'not-a-date', query: '', evidence: [{ source: '', url: 'https://example.com', excerpt: '', signalType: 'invalid' as SignalType, sourceTier: 5 as 1 | 2 | 3, confidence: 2.0 }] };
  const badResult = validateCollectorOutput('bad-signal-test', [badSignal]);
  results.push({ collectorId: 'negative-validation', passed: !badResult.passed, checks: [{ check: 'malformed signal correctly fails validation', passed: !badResult.passed }] });

  return { passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, total: results.length, results };
}
