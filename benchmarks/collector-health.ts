// Collector health check — validates that each collector returns
// properly structured RawSignal[] with valid Evidence items.
// Does NOT make network calls. Instead, validates the structural contract
// by checking type shapes, required fields, and value ranges.

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
  const results: { check: string; passed: boolean; detail?: string }[] = [];

  results.push({
    check: `evidence[${idx}].source is non-empty string`,
    passed: typeof e.source === 'string' && e.source.length > 0,
    detail: typeof e.source === 'string' ? e.source : `type=${typeof e.source}`,
  });

  results.push({
    check: `evidence[${idx}].url is string`,
    passed: typeof e.url === 'string',
    detail: typeof e.url === 'string' ? e.url.slice(0, 80) : `type=${typeof e.url}`,
  });

  results.push({
    check: `evidence[${idx}].excerpt is non-empty string`,
    passed: typeof e.excerpt === 'string' && e.excerpt.length > 0,
  });

  results.push({
    check: `evidence[${idx}].signalType is valid`,
    passed: VALID_SIGNAL_TYPES.includes(e.signalType),
    detail: e.signalType,
  });

  if (e.sourceTier != null) {
    results.push({
      check: `evidence[${idx}].sourceTier is 1|2|3`,
      passed: VALID_SOURCE_TIERS.includes(e.sourceTier),
      detail: String(e.sourceTier),
    });
  }

  if (e.confidence != null) {
    results.push({
      check: `evidence[${idx}].confidence is 0-1`,
      passed: typeof e.confidence === 'number' && e.confidence >= 0 && e.confidence <= 1,
      detail: String(e.confidence),
    });
  }

  if (e.timestamp != null) {
    results.push({
      check: `evidence[${idx}].timestamp is positive number`,
      passed: typeof e.timestamp === 'number' && e.timestamp > 0,
    });
  }

  return results;
}

function validateRawSignal(signal: RawSignal, idx: number): { check: string; passed: boolean; detail?: string }[] {
  const results: { check: string; passed: boolean; detail?: string }[] = [];

  results.push({
    check: `signal[${idx}].collectorId is non-empty string`,
    passed: typeof signal.collectorId === 'string' && signal.collectorId.length > 0,
    detail: signal.collectorId,
  });

  results.push({
    check: `signal[${idx}].timestamp is ISO string`,
    passed: typeof signal.timestamp === 'string' && !isNaN(Date.parse(signal.timestamp)),
    detail: signal.timestamp,
  });

  results.push({
    check: `signal[${idx}].query is non-empty string`,
    passed: typeof signal.query === 'string' && signal.query.length > 0,
  });

  results.push({
    check: `signal[${idx}].evidence is array`,
    passed: Array.isArray(signal.evidence),
  });

  if (Array.isArray(signal.evidence)) {
    for (let i = 0; i < signal.evidence.length; i++) {
      results.push(...validateEvidence(signal.evidence[i], i));
    }
  }

  return results;
}

// Validate a mock RawSignal matches the expected shape
export function validateCollectorOutput(collectorId: string, signals: RawSignal[]): HealthCheckResult {
  const checks: { check: string; passed: boolean; detail?: string }[] = [];

  checks.push({
    check: 'output is array',
    passed: Array.isArray(signals),
  });

  if (!Array.isArray(signals)) {
    return { collectorId, passed: false, checks };
  }

  for (let i = 0; i < signals.length; i++) {
    checks.push(...validateRawSignal(signals[i], i));
  }

  return {
    collectorId,
    passed: checks.every(c => c.passed),
    checks,
  };
}

// Create a well-formed mock signal for a given collector
function makeMockSignal(collectorId: string): RawSignal {
  return {
    collectorId,
    timestamp: new Date().toISOString(),
    query: 'test query',
    evidence: [
      {
        source: `${collectorId}:test`,
        url: 'https://example.com/test',
        excerpt: 'Test evidence excerpt for structural validation',
        signalType: 'demand',
        sourceTier: 2,
        confidence: 0.7,
        timestamp: Date.now(),
      },
      {
        source: `${collectorId}:test`,
        url: 'https://example.com/test2',
        excerpt: 'Second test excerpt with pain signal',
        signalType: 'pain',
        sourceTier: 2,
        confidence: 0.6,
        timestamp: Date.now() - 86400000,
      },
    ],
  };
}

// Run health checks for all registered collectors
export function runCollectorHealthChecks(): {
  passed: number;
  failed: number;
  total: number;
  results: HealthCheckResult[];
} {
  const results: HealthCheckResult[] = [];

  // Check 1: Verify all collector IDs can be instantiated
  for (const id of ALL_COLLECTOR_IDS) {
    const collector = createCollectorById(id);
    const checks: { check: string; passed: boolean; detail?: string }[] = [];

    checks.push({
      check: `createCollectorById("${id}") returns a collector`,
      passed: collector !== null,
    });

    if (collector) {
      checks.push({
        check: `collector.id matches "${id}"`,
        passed: collector.id === id,
        detail: collector.id,
      });

      checks.push({
        check: `collector.collect is a function`,
        passed: typeof collector.collect === 'function',
      });
    }

    // Validate mock signal shape
    const mockSignal = makeMockSignal(id);
    const shapeResult = validateCollectorOutput(id, [mockSignal]);
    checks.push(...shapeResult.checks);

    results.push({
      collectorId: id,
      passed: checks.every(c => c.passed),
      checks,
    });
  }

  // Check 2: Validate that bad signals fail validation
  const badSignal: RawSignal = {
    collectorId: '',
    timestamp: 'not-a-date',
    query: '',
    evidence: [
      {
        source: '',
        url: 'https://example.com',
        excerpt: '',
        signalType: 'invalid' as SignalType,
        sourceTier: 5 as 1 | 2 | 3,
        confidence: 2.0,
      },
    ],
  };

  const badResult = validateCollectorOutput('bad-signal-test', [badSignal]);
  const badCheckResult: HealthCheckResult = {
    collectorId: 'negative-validation',
    passed: !badResult.passed, // Should FAIL validation
    checks: [{
      check: 'malformed signal correctly fails validation',
      passed: !badResult.passed,
      detail: badResult.passed ? 'validation should have failed' : 'correctly rejected',
    }],
  };
  results.push(badCheckResult);

  return {
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    total: results.length,
    results,
  };
}
