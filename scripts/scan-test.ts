// Test script: npx tsx scripts/scan-test.ts
// Verifies real collectors return 50-200+ signals for test seed queries.

import { collectAllSignals } from '../lib/engine/collectors';
import { deduplicateEvidence } from '../lib/engine/collectors/dedup';
import { Evidence } from '../lib/engine/models/types';

const TEST_SEEDS = [
  'missed call software',
  'tenant screening automation',
  'legal client intake',
  'contractor lead follow up',
];

async function main() {
  console.log('=== SignalForge Collector Test ===\n');
  console.log(`Testing ${TEST_SEEDS.length} seed queries...\n`);

  const startTime = Date.now();
  const signals = await collectAllSignals(TEST_SEEDS);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Aggregate all evidence
  let totalEvidence: Evidence[] = [];
  const byCollector: Record<string, number> = {};
  const bySignalType: Record<string, number> = {};
  const byTier: Record<number, number> = {};
  const byQuery: Record<string, number> = {};

  for (const signal of signals) {
    totalEvidence.push(...signal.evidence);

    byCollector[signal.collectorId] = (byCollector[signal.collectorId] ?? 0) + signal.evidence.length;
    byQuery[signal.query] = (byQuery[signal.query] ?? 0) + signal.evidence.length;

    for (const e of signal.evidence) {
      bySignalType[e.signalType] = (bySignalType[e.signalType] ?? 0) + 1;
      byTier[e.sourceTier ?? 2] = (byTier[e.sourceTier ?? 2] ?? 0) + 1;
    }
  }

  // Deduplicate
  const deduped = deduplicateEvidence(totalEvidence);

  console.log(`Time: ${elapsed}s`);
  console.log(`Signals (RawSignal objects): ${signals.length}`);
  console.log(`Evidence (raw): ${totalEvidence.length}`);
  console.log(`Evidence (deduped): ${deduped.length}`);
  console.log('');

  console.log('--- By Collector ---');
  for (const [id, count] of Object.entries(byCollector).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id.padEnd(20)} ${count}`);
  }
  console.log('');

  console.log('--- By Signal Type ---');
  for (const [type, count] of Object.entries(bySignalType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(15)} ${count}`);
  }
  console.log('');

  console.log('--- By Tier ---');
  for (const [tier, count] of Object.entries(byTier).sort()) {
    console.log(`  T${tier}             ${count}`);
  }
  console.log('');

  console.log('--- By Query ---');
  for (const [q, count] of Object.entries(byQuery).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${q.slice(0, 40).padEnd(42)} ${count}`);
  }
  console.log('');

  // Sample evidence
  console.log('--- Sample Evidence (first 5) ---');
  for (const e of deduped.slice(0, 5)) {
    console.log(`  [${e.signalType}] T${e.sourceTier} c=${e.confidence?.toFixed(2)} | ${e.source}`);
    console.log(`    ${e.excerpt.slice(0, 120)}`);
    console.log('');
  }

  // Pass/fail
  const target = 50;
  if (deduped.length >= target) {
    console.log(`✓ PASS: ${deduped.length} signals collected (target: ${target}+)`);
  } else {
    console.log(`✗ FAIL: Only ${deduped.length} signals collected (target: ${target}+)`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
