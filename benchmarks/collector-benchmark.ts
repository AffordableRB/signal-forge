// Collector-level benchmark — tests each collector against real network sources.
// Unlike collector-health.ts (structural only), this makes actual HTTP calls
// and validates that collectors return meaningful evidence for known topics.
//
// Usage: npm run orch:benchmark:collectors
// Requires: SCRAPER_API_KEY env var for proxy-dependent collectors
//
// Each test case defines:
//   - collectorId: which collector to test
//   - queries: realistic search queries
//   - expect: minimum evidence count, allowed signal types, max duration

import { createCollectorById, CollectionOptions } from '../lib/engine/collectors/index';
import { hasProxyKey } from '../lib/engine/collectors/rate-limiter';
import { RawSignal, SignalType } from '../lib/engine/models/types';

interface CollectorBenchmarkCase {
  id: string;
  name: string;
  collectorId: string;
  queries: string[];
  options?: CollectionOptions;
  expect: {
    minSignals: number;          // minimum RawSignal[] length
    minEvidence: number;         // minimum total evidence pieces
    maxDurationMs: number;       // timeout threshold
    allowedTypes?: SignalType[]; // if set, all evidence must be one of these
    requiresProxy?: boolean;     // skip if no SCRAPER_API_KEY
  };
}

interface CollectorBenchmarkResult {
  caseId: string;
  passed: boolean;
  signalCount: number;
  evidenceCount: number;
  durationMs: number;
  failures: string[];
  sampleExcerpts: string[];  // first 3 excerpts for debugging
}

// ── Benchmark Cases ──────────────────────────────────────────────────

const CASES: CollectorBenchmarkCase[] = [
  // ── HackerNews (Algolia API, no proxy) ──
  {
    id: 'hn-fitness',
    name: 'HackerNews: Fitness topic',
    collectorId: 'hackernews',
    queries: [
      'gym members complaining about booking classes',
      'personal trainer scheduling software expensive',
      'fitness studio management software pricing',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 15000 },
  },
  {
    id: 'hn-saas',
    name: 'HackerNews: SaaS/startup topic (baseline)',
    collectorId: 'hackernews',
    queries: [
      'startup billing subscription management problems',
      'developer tools pricing too expensive',
    ],
    expect: { minSignals: 1, minEvidence: 3, maxDurationMs: 15000 },
  },

  // ── Reddit (proxy recommended, direct may work) ──
  {
    id: 'reddit-fitness',
    name: 'Reddit: Fitness topic with dynamic subs',
    collectorId: 'reddit',
    queries: [
      'gym members complaining about booking classes',
      'personal trainer scheduling software expensive alternatives',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 30000, requiresProxy: true },
  },
  {
    id: 'reddit-plumbing',
    name: 'Reddit: Plumbing/HVAC (baseline — default subs)',
    collectorId: 'reddit',
    queries: [
      'plumbing dispatch software too expensive',
      'HVAC scheduling problems contractors',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 30000, requiresProxy: true },
  },

  // ── Search Intent (Google Autocomplete, no proxy) ──
  {
    id: 'search-intent-fitness',
    name: 'SearchIntent: Fitness topic',
    collectorId: 'search-intent',
    queries: [
      'fitness studio management software',
      'personal trainer scheduling',
    ],
    expect: { minSignals: 1, minEvidence: 3, maxDurationMs: 15000 },
  },

  // ── Google Trends (RSS, no proxy) ──
  {
    id: 'trends-fitness',
    name: 'GoogleTrends: Fitness topic',
    collectorId: 'google-trends',
    queries: [
      'fitness studio management',
      'gym booking software',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 15000 },
  },

  // ── Reviews (G2, Capterra, Trustpilot — proxy required) ──
  {
    id: 'reviews-fitness',
    name: 'Reviews: Fitness software',
    collectorId: 'reviews',
    queries: ['fitness studio management software', 'gym membership software'],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 40000, requiresProxy: true },
  },
  {
    id: 'reviews-crm',
    name: 'Reviews: CRM software (baseline)',
    collectorId: 'reviews',
    queries: ['CRM software for small business', 'customer relationship management'],
    expect: { minSignals: 1, minEvidence: 3, maxDurationMs: 40000, requiresProxy: true },
  },

  // ── Pricing (Google search — proxy required) ──
  {
    id: 'pricing-fitness',
    name: 'Pricing: Fitness software pricing',
    collectorId: 'pricing',
    queries: ['fitness studio management', 'gym membership software'],
    expect: { minSignals: 1, minEvidence: 1, maxDurationMs: 40000, requiresProxy: true },
  },
  {
    id: 'pricing-crm',
    name: 'Pricing: CRM pricing (baseline)',
    collectorId: 'pricing',
    queries: ['CRM software', 'customer management platform'],
    expect: { minSignals: 1, minEvidence: 1, maxDurationMs: 40000, requiresProxy: true },
  },

  // ── Jobs/Indeed (proxy required) ──
  {
    id: 'jobs-fitness',
    name: 'Jobs: Fitness industry hiring',
    collectorId: 'jobs',
    queries: ['fitness software developer', 'gym management software'],
    expect: { minSignals: 1, minEvidence: 1, maxDurationMs: 40000, requiresProxy: true },
  },
  {
    id: 'jobs-plumbing',
    name: 'Jobs: Plumbing/HVAC hiring (baseline)',
    collectorId: 'jobs',
    queries: ['plumbing dispatch software', 'HVAC scheduling software'],
    expect: { minSignals: 1, minEvidence: 1, maxDurationMs: 40000, requiresProxy: true },
  },

  // ── Restaurant topic (cross-collector) ──
  {
    id: 'hn-restaurant',
    name: 'HackerNews: Restaurant/POS topic',
    collectorId: 'hackernews',
    queries: [
      'restaurant point of sale software',
      'restaurant management system problems',
      'food ordering platform startup',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 15000 },
  },
  {
    id: 'search-intent-restaurant',
    name: 'SearchIntent: Restaurant software',
    collectorId: 'search-intent',
    queries: [
      'restaurant management software',
      'restaurant POS system',
    ],
    expect: { minSignals: 1, minEvidence: 3, maxDurationMs: 15000 },
  },

  // ── Construction topic (cross-collector) ──
  {
    id: 'hn-construction',
    name: 'HackerNews: Construction/project mgmt topic',
    collectorId: 'hackernews',
    queries: [
      'construction project management software',
      'contractor scheduling bidding platform',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 15000 },
  },
  {
    id: 'trends-construction',
    name: 'GoogleTrends: Construction software',
    collectorId: 'google-trends',
    queries: [
      'construction management software',
      'contractor scheduling software',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 15000 },
  },

  // ── Legal topic (cross-collector) ──
  {
    id: 'hn-legal',
    name: 'HackerNews: Legal tech topic',
    collectorId: 'hackernews',
    queries: [
      'legal practice management software',
      'law firm billing time tracking',
      'contract review automation',
    ],
    expect: { minSignals: 1, minEvidence: 2, maxDurationMs: 15000 },
  },
  {
    id: 'search-intent-legal',
    name: 'SearchIntent: Legal software',
    collectorId: 'search-intent',
    queries: [
      'legal practice management software',
      'law firm case management',
    ],
    expect: { minSignals: 1, minEvidence: 3, maxDurationMs: 15000 },
  },

  // ── Product Hunt (proxy for search, RSS fallback) ──
  {
    id: 'ph-fitness',
    name: 'ProductHunt: Fitness products',
    collectorId: 'product-hunt',
    queries: ['fitness tracking', 'gym management'],
    expect: { minSignals: 0, minEvidence: 0, maxDurationMs: 30000 }, // RSS may not have fitness
  },
  {
    id: 'ph-productivity',
    name: 'ProductHunt: Productivity tools (baseline)',
    collectorId: 'product-hunt',
    queries: ['productivity tool', 'project management'],
    expect: { minSignals: 0, minEvidence: 0, maxDurationMs: 30000 },
  },
];

// ── Runner ──────────────────────────────────────────────────────────

async function runCase(c: CollectorBenchmarkCase): Promise<CollectorBenchmarkResult> {
  const failures: string[] = [];

  // Skip proxy-required cases if no key
  if (c.expect.requiresProxy && !hasProxyKey()) {
    return {
      caseId: c.id,
      passed: false,
      signalCount: 0,
      evidenceCount: 0,
      durationMs: 0,
      failures: ['SKIP — SCRAPER_API_KEY not set'],
      sampleExcerpts: [],
    };
  }

  const collector = createCollectorById(c.collectorId, c.options ?? {});
  if (!collector) {
    return {
      caseId: c.id,
      passed: false,
      signalCount: 0,
      evidenceCount: 0,
      durationMs: 0,
      failures: [`Unknown collector: ${c.collectorId}`],
      sampleExcerpts: [],
    };
  }

  const start = Date.now();
  let signals: RawSignal[] = [];

  try {
    signals = await Promise.race([
      collector.collect(c.queries),
      new Promise<RawSignal[]>((_, reject) =>
        setTimeout(() => reject(new Error('benchmark timeout')), c.expect.maxDurationMs)
      ),
    ]);
  } catch (err) {
    const duration = Date.now() - start;
    return {
      caseId: c.id,
      passed: false,
      signalCount: 0,
      evidenceCount: 0,
      durationMs: duration,
      failures: [`Error: ${(err as Error).message}`],
      sampleExcerpts: [],
    };
  }

  const duration = Date.now() - start;
  const totalEvidence = signals.reduce((n, s) => n + s.evidence.length, 0);
  const allExcerpts = signals.flatMap(s => s.evidence.map(e => e.excerpt));

  // Assertions
  if (signals.length < c.expect.minSignals) {
    failures.push(`signals: ${signals.length} < minSignals(${c.expect.minSignals})`);
  }
  if (totalEvidence < c.expect.minEvidence) {
    failures.push(`evidence: ${totalEvidence} < minEvidence(${c.expect.minEvidence})`);
  }
  if (duration > c.expect.maxDurationMs) {
    failures.push(`duration: ${duration}ms > maxDuration(${c.expect.maxDurationMs}ms)`);
  }
  if (c.expect.allowedTypes) {
    const badTypes = signals.flatMap(s =>
      s.evidence.filter(e => !c.expect.allowedTypes!.includes(e.signalType))
    );
    if (badTypes.length > 0) {
      failures.push(`${badTypes.length} evidence items have disallowed signalType`);
    }
  }

  return {
    caseId: c.id,
    passed: failures.length === 0,
    signalCount: signals.length,
    evidenceCount: totalEvidence,
    durationMs: duration,
    failures,
    sampleExcerpts: allExcerpts.slice(0, 3).map(e => e.slice(0, 120)),
  };
}

export async function runCollectorBenchmarks(filter?: string): Promise<{
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  results: CollectorBenchmarkResult[];
}> {
  const cases = filter
    ? CASES.filter(c => c.id.includes(filter) || c.collectorId.includes(filter))
    : CASES;

  console.log(`=== Collector Benchmark Suite ===`);
  console.log(`Running ${cases.length} cases${filter ? ` (filter: "${filter}")` : ''}...\n`);

  const results: CollectorBenchmarkResult[] = [];

  for (const c of cases) {
    const result = await runCase(c);
    results.push(result);

    const icon = result.failures[0]?.startsWith('SKIP') ? 'SKIP' : result.passed ? 'PASS' : 'FAIL';
    console.log(
      `  ${icon}  ${c.name}`,
    );
    console.log(
      `       Signals: ${result.signalCount} | Evidence: ${result.evidenceCount} | ${result.durationMs}ms`,
    );

    if (result.failures.length > 0) {
      for (const f of result.failures) {
        console.log(`       > ${f}`);
      }
    }

    if (result.sampleExcerpts.length > 0) {
      console.log(`       Sample: "${result.sampleExcerpts[0]}..."`);
    }
    console.log();
  }

  const passed = results.filter(r => r.passed).length;
  const skipped = results.filter(r => r.failures[0]?.startsWith('SKIP')).length;
  const failed = results.filter(r => !r.passed && !r.failures[0]?.startsWith('SKIP')).length;

  console.log(`=== ${passed} passed, ${failed} failed, ${skipped} skipped out of ${results.length} ===`);

  return { passed, failed, skipped, total: results.length, results };
}

// CLI entrypoint
if (require.main === module || process.argv[1]?.includes('collector-benchmark')) {
  const filter = process.argv[2];
  runCollectorBenchmarks(filter).then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}
