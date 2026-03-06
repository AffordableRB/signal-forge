// SignalForge Orchestrator CLI
//
// Usage:
//   npx tsx scripts/orchestrator.ts scan                  # standard scan
//   npx tsx scripts/orchestrator.ts scan --mode deep      # deep scan
//   npx tsx scripts/orchestrator.ts scan --mode quick     # quick scan
//   npx tsx scripts/orchestrator.ts benchmark             # run benchmarks
//   npx tsx scripts/orchestrator.ts benchmark --verbose   # with details

import { ScanOrchestrator } from '../src/orchestrator';
import { InMemoryScanStore } from '../src/state/scan-store';
import { JobQueue } from '../src/queue/job-queue';
import { runBenchmarkSuite } from '../benchmarks/benchmark-runner';
import { BENCHMARK_CASES } from '../benchmarks/cases';
import type { ScanMode } from '../src/orchestrator/scan-phases';

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

// ─── Scan command ───────────────────────────────────────────────────

async function runScan() {
  const mode = (getFlag('--mode') ?? 'standard') as ScanMode;
  if (!['quick', 'standard', 'deep'].includes(mode)) {
    console.error(`Invalid mode: ${mode}. Use quick, standard, or deep.`);
    process.exit(1);
  }

  console.log(`\n=== SignalForge Orchestrator — ${mode.toUpperCase()} scan ===\n`);

  const store = new InMemoryScanStore();
  const queue = new JobQueue();
  const orchestrator = new ScanOrchestrator(store, queue);

  const startTime = Date.now();

  const scan = await orchestrator.runScan(mode, (progress) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `  [${elapsed}s] ${progress.phase} — ${progress.status} — ${progress.progressPercent}% — ${progress.signalCount} signals`
    );
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Scan ${scan.status.toUpperCase()} in ${elapsed}s ===\n`);

  // Phase summary
  console.log('Phases:');
  for (const phase of scan.phases) {
    const dur = phase.durationMs ? `${(phase.durationMs / 1000).toFixed(1)}s` : '-';
    const signals = phase.signalsAdded > 0 ? `+${phase.signalsAdded} signals` : '';
    const jobs = phase.jobIds.length > 0 ? `${phase.jobIds.length} jobs` : '';
    const status = phase.status === 'completed' ? 'OK' :
                   phase.status === 'failed' ? 'FAIL' :
                   phase.status === 'skipped' ? 'SKIP' : phase.status;
    console.log(`  ${phase.phase.padEnd(20)} ${status.padEnd(6)} ${dur.padStart(8)}  ${signals.padEnd(14)} ${jobs}`);
  }

  // Results
  console.log(`\nResults:`);
  console.log(`  Candidates: ${scan.candidateCount}`);
  console.log(`  Top score:  ${scan.topScore.toFixed(1)}`);
  console.log(`  Top opp:    ${scan.topOpportunity}`);
  console.log(`  Signals:    ${scan.signalCount}`);

  // Job results summary
  const jobResults = await store.getJobResults(scan.id);
  const succeeded = jobResults.filter(j => j.status === 'completed').length;
  const failed = jobResults.filter(j => j.status === 'failed').length;
  const timedOut = jobResults.filter(j => j.status === 'timeout').length;
  console.log(`  Jobs:       ${jobResults.length} total (${succeeded} ok, ${failed} failed, ${timedOut} timeout)`);

  if (scan.errorSummary) {
    console.log(`\n  ERROR: ${scan.errorSummary}`);
  }

  // Show candidate details
  const scanWithCandidates = scan as typeof scan & { candidates?: Array<{ jobToBeDone: string; scores: { final: number }; rejected: boolean; confidence?: { overall: number }; marketStructure?: { type: string } }> };
  if (scanWithCandidates.candidates) {
    console.log(`\nOpportunities:`);
    for (const c of scanWithCandidates.candidates) {
      const conf = c.confidence ? `${c.confidence.overall}%` : '-';
      const market = c.marketStructure?.type ?? '-';
      const status = c.rejected ? ' [rejected]' : '';
      console.log(`  ${c.scores.final.toFixed(1).padStart(5)}  ${market.padEnd(8)} ${conf.padStart(5)} conf  ${c.jobToBeDone}${status}`);
    }
  }

  console.log('');

  if (scan.status === 'failed') process.exit(1);
}

// ─── Benchmark command ──────────────────────────────────────────────

async function runBenchmarks() {
  const verbose = hasFlag('--verbose');

  console.log('\n=== SignalForge Benchmark Suite ===\n');

  const result = runBenchmarkSuite(BENCHMARK_CASES);

  for (const r of result.results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  ${r.name}`);
    console.log(`       Score: ${r.score.toFixed(1)} | Ocean: ${r.ocean} | Confidence: ${r.confidence}% | ROI: ${r.roi}x | Contradictions: ${r.contradictions}`);
    if (!r.passed) {
      for (const f of r.failures) {
        console.log(`       FAIL: ${f}`);
      }
    }
    if (verbose) {
      console.log('');
    }
  }

  console.log(`\n=== ${result.passed} passed, ${result.failed} failed out of ${result.total} ===\n`);

  if (result.failed > 0) process.exit(1);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  if (!command || command === 'help' || command === '--help') {
    console.log(`
SignalForge Orchestrator CLI

Commands:
  scan                     Run a market scan
    --mode <quick|standard|deep>   Scan depth (default: standard)

  benchmark                Run benchmark validation suite
    --verbose              Show detailed output

Examples:
  npx tsx scripts/orchestrator.ts scan
  npx tsx scripts/orchestrator.ts scan --mode deep
  npx tsx scripts/orchestrator.ts benchmark
`);
    return;
  }

  switch (command) {
    case 'scan':
      await runScan();
      break;
    case 'benchmark':
      await runBenchmarks();
      break;
    default:
      console.error(`Unknown command: ${command}. Run with --help for usage.`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
