// SignalForge Orchestrator CLI
//
// Usage:
//   npx tsx scripts/orchestrator.ts scan                                    # standard scan
//   npx tsx scripts/orchestrator.ts scan --mode deep                       # deep scan
//   npx tsx scripts/orchestrator.ts scan --mode quick                      # quick scan
//   npx tsx scripts/orchestrator.ts scan --mode thorough --topic "construction"  # topic-focused deep scan
//   npx tsx scripts/orchestrator.ts benchmark             # run benchmarks
//   npx tsx scripts/orchestrator.ts benchmark --verbose   # with details
//   npx tsx scripts/orchestrator.ts benchmark --e2e       # include end-to-end cases
//   npx tsx scripts/orchestrator.ts benchmark:check       # check for regressions
//   npx tsx scripts/orchestrator.ts benchmark:baseline    # save new baseline

import * as fs from 'fs';
import * as path from 'path';
import { ScanOrchestrator } from '../src/orchestrator';
import { FileScanStore } from '../src/state/file-scan-store';
import { JobQueue } from '../src/queue/job-queue';
import {
  runBenchmarkSuite,
  compareToBaseline,
  createBaseline,
} from '../benchmarks/benchmark-runner';
import type { BaselineData } from '../benchmarks/benchmark-runner';
import { BENCHMARK_CASES, E2E_BENCHMARK_CASES } from '../benchmarks/cases';
import { runCollectorHealthChecks } from '../benchmarks/collector-health';
import { runIntegrationTest } from '../benchmarks/integration-test';
import type { ScanMode } from '../src/orchestrator/scan-phases';

const args = process.argv.slice(2);
const command = args[0];
const BASELINE_PATH = path.resolve(__dirname, '..', 'benchmarks', 'baseline.json');

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

function loadBaseline(): BaselineData | null {
  try {
    const raw = fs.readFileSync(BASELINE_PATH, 'utf-8');
    return JSON.parse(raw) as BaselineData;
  } catch {
    return null;
  }
}

// ─── Scan command ───────────────────────────────────────────────────

async function runScan() {
  const mode = (getFlag('--mode') ?? 'standard') as ScanMode;
  if (!['quick', 'standard', 'deep', 'thorough'].includes(mode)) {
    console.error(`Invalid mode: ${mode}. Use quick, standard, deep, or thorough.`);
    process.exit(1);
  }

  const topic = getFlag('--topic');

  if (mode === 'thorough' && !topic) {
    console.error('Thorough mode requires --topic. Example: --topic "construction"');
    process.exit(1);
  }

  const topicLabel = topic ? ` — topic: "${topic}"` : '';
  console.log(`\n=== SignalForge Orchestrator — ${mode.toUpperCase()} scan${topicLabel} ===\n`);

  const store = new FileScanStore();
  const queue = new JobQueue();
  const orchestrator = new ScanOrchestrator(store, queue);

  const startTime = Date.now();

  // Show per-job progress events
  queue.onJobEvent((event) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (event.type === 'job:start') {
      console.log(`    [${elapsed}s] START  ${event.jobType}`);
    } else if (event.type === 'job:complete') {
      const dur = event.result?.durationMs ? `${(event.result.durationMs / 1000).toFixed(1)}s` : '';
      console.log(`    [${elapsed}s] DONE   ${event.jobType} ${dur}`);
    } else if (event.type === 'job:fail') {
      console.log(`    [${elapsed}s] FAIL   ${event.jobType}: ${event.error ?? 'unknown'}`);
    }
  });

  const scan = await orchestrator.runScan(mode, (progress) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `  [${elapsed}s] ${progress.phase} — ${progress.status} — ${progress.progressPercent}% — ${progress.signalCount} signals`
    );
  }, topic);

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
  const scanWithCandidates = scan as typeof scan & { candidates?: Array<{
    jobToBeDone: string; scores: { final: number }; rejected: boolean;
    confidence?: { overall: number }; marketStructure?: { type: string };
    deepValidation?: {
      verdict: string; verdictReasoning: string; confidencePercent: number;
      checks: Array<{ name: string; passed: boolean; evidence: string; confidence: number }>;
      unitEconomics: { estimatedCAC: string; estimatedLTV: string; estimatedMargin: string; monthlyRevenueAt100Customers: string; breakEvenCustomers: number; reasoning: string };
      competitorDeepDive: Array<{ name: string; mainWeakness: string; whyYouWin: string }>;
      first10Customers: { segment: string; howToReach: string; estimatedConversionRate: string; exampleOutreach: string };
      exactGap: string; unfairAdvantage: string; biggestRisk: string;
      validationTests: Array<{ testType: string; description: string; successCriteria: string; timeRequired: string; costRequired: string }>;
      killReasons: string[];
    };
  }> };
  if (scanWithCandidates.candidates) {
    console.log(`\nOpportunities:`);
    for (const c of scanWithCandidates.candidates) {
      const conf = c.confidence ? `${c.confidence.overall}%` : '-';
      const market = c.marketStructure?.type ?? '-';
      const status = c.rejected ? ' [rejected]' : '';
      console.log(`  ${c.scores.final.toFixed(1).padStart(5)}  ${market.padEnd(8)} ${conf.padStart(5)} conf  ${c.jobToBeDone}${status}`);

      // Deep validation details
      if (c.deepValidation) {
        const dv = c.deepValidation;
        const verdictColor = dv.verdict === 'GO' ? 'GO' : dv.verdict === 'NO-GO' ? 'NO-GO' : 'CONDITIONAL';
        console.log(`\n         --- DEEP VALIDATION: ${verdictColor} (${dv.confidencePercent}% confidence) ---`);
        console.log(`         ${dv.verdictReasoning}`);

        // Checks
        const passed = dv.checks.filter(ch => ch.passed).length;
        const total = dv.checks.length;
        console.log(`\n         Checks: ${passed}/${total} passed`);
        for (const ch of dv.checks) {
          const icon = ch.passed ? '[PASS]' : '[FAIL]';
          console.log(`           ${icon} ${ch.name} (${ch.confidence}%)`);
          console.log(`                 ${ch.evidence.substring(0, 120)}`);
        }

        // Unit economics
        const ue = dv.unitEconomics;
        console.log(`\n         Unit Economics:`);
        console.log(`           CAC: ${ue.estimatedCAC}  |  LTV: ${ue.estimatedLTV}  |  Margin: ${ue.estimatedMargin}`);
        console.log(`           Revenue @100 customers: ${ue.monthlyRevenueAt100Customers}/mo  |  Break-even: ${ue.breakEvenCustomers} customers`);
        console.log(`           ${ue.reasoning}`);

        // Gap & risk
        console.log(`\n         Exact Gap: ${dv.exactGap}`);
        console.log(`         Biggest Risk: ${dv.biggestRisk}`);

        // First 10 customers
        const f10 = dv.first10Customers;
        console.log(`\n         First 10 Customers:`);
        console.log(`           Segment: ${f10.segment}`);
        console.log(`           Reach: ${f10.howToReach}`);
        console.log(`           Conv. rate: ${f10.estimatedConversionRate}`);
        console.log(`           Outreach: "${f10.exampleOutreach}"`);

        // Competitors
        if (dv.competitorDeepDive.length > 0) {
          console.log(`\n         Competitor Analysis:`);
          for (const comp of dv.competitorDeepDive) {
            console.log(`           ${comp.name}: weakness="${comp.mainWeakness}" | you win="${comp.whyYouWin}"`);
          }
        }

        // Validation tests
        if (dv.validationTests.length > 0) {
          console.log(`\n         Validation Tests:`);
          for (const vt of dv.validationTests) {
            console.log(`           [${vt.testType}] ${vt.description} (${vt.timeRequired}, ${vt.costRequired})`);
            console.log(`             Success: ${vt.successCriteria}`);
          }
        }

        // Kill reasons
        if (dv.killReasons.length > 0) {
          console.log(`\n         Kill Reasons:`);
          for (const kr of dv.killReasons) {
            console.log(`           - ${kr}`);
          }
        }

        console.log(`         ---`);
      }
    }
  }

  console.log('');

  if (scan.status === 'failed') process.exit(1);
}

// ─── Benchmark command ──────────────────────────────────────────────

async function runBenchmarks() {
  const verbose = hasFlag('--verbose');
  const includeE2E = hasFlag('--e2e');

  const cases = includeE2E
    ? [...BENCHMARK_CASES, ...E2E_BENCHMARK_CASES]
    : BENCHMARK_CASES;

  const label = includeE2E ? 'Benchmark Suite (with E2E)' : 'Benchmark Suite';
  console.log(`\n=== SignalForge ${label} ===\n`);

  const result = runBenchmarkSuite(cases);

  for (const r of result.results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    const e2eTag = r.detectorScores ? ' [E2E]' : '';
    console.log(`  ${icon}  ${r.name}${e2eTag}`);
    console.log(`       Score: ${r.score.toFixed(1)} | Ocean: ${r.ocean} | Confidence: ${r.confidence}% | ROI: ${r.roi}x | Contradictions: ${r.contradictions}`);
    if (!r.passed) {
      for (const f of r.failures) {
        console.log(`       FAIL: ${f}`);
      }
    }
    if (verbose && r.detectorScores) {
      console.log('       Detector scores:');
      for (const [id, score] of Object.entries(r.detectorScores)) {
        console.log(`         ${id.padEnd(22)} ${score}`);
      }
    }
    if (verbose) {
      console.log('');
    }
  }

  console.log(`\n=== ${result.passed} passed, ${result.failed} failed out of ${result.total} ===\n`);

  if (result.failed > 0) process.exit(1);
}

// ─── Regression check command ───────────────────────────────────────

async function runRegressionCheck() {
  const baseline = loadBaseline();
  if (!baseline) {
    console.error('No baseline found at benchmarks/baseline.json');
    console.error('Run: npx tsx scripts/orchestrator.ts benchmark:baseline');
    process.exit(1);
  }

  // Run both fixture and E2E cases for regression checking
  const allCases = [...BENCHMARK_CASES, ...E2E_BENCHMARK_CASES];
  console.log(`\n=== SignalForge Regression Check ===\n`);
  console.log(`Baseline from: ${baseline.createdAt}`);
  console.log(`Cases: ${allCases.length} (${baseline.entries.length} in baseline)\n`);

  const result = runBenchmarkSuite(allCases);

  // First check if all benchmarks pass
  const failures = result.results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('BENCHMARK FAILURES:');
    for (const f of failures) {
      console.log(`  FAIL  ${f.name}`);
      for (const msg of f.failures) {
        console.log(`        ${msg}`);
      }
    }
    console.log('');
  }

  // Then check for drift
  const regressions = compareToBaseline(result, baseline);

  if (regressions.length === 0 && failures.length === 0) {
    console.log('All benchmarks pass. No regressions detected.\n');
    return;
  }

  if (regressions.length > 0) {
    const warnings = regressions.filter(r => r.severity === 'warning');
    const hard = regressions.filter(r => r.severity === 'regression');

    if (warnings.length > 0) {
      console.log(`WARNINGS (${warnings.length} score drifts detected):`);
      for (const w of warnings) {
        const drift = w.driftPercent ? ` (${w.driftPercent}% drift)` : '';
        console.log(`  ${w.caseId}.${w.field}: ${w.baseline} -> ${w.current}${drift}`);
      }
      console.log('');
    }

    if (hard.length > 0) {
      console.log(`REGRESSIONS (${hard.length} breaking changes):`);
      for (const r of hard) {
        const drift = r.driftPercent ? ` (${r.driftPercent}% drift)` : '';
        console.log(`  ${r.caseId}.${r.field}: ${r.baseline} -> ${r.current}${drift}`);
      }
      console.log('');
    }

    if (hard.length > 0 || failures.length > 0) {
      console.log(`=== FAILED: ${failures.length} benchmark failures, ${hard.length} regressions ===\n`);
      process.exit(1);
    } else {
      console.log(`=== PASSED with ${warnings.length} warnings ===\n`);
    }
  } else if (failures.length > 0) {
    console.log(`=== FAILED: ${failures.length} benchmark failures ===\n`);
    process.exit(1);
  }
}

// ─── Baseline save command ──────────────────────────────────────────

async function saveBaseline() {
  const allCases = [...BENCHMARK_CASES, ...E2E_BENCHMARK_CASES];
  console.log(`\n=== Generating Baseline ===\n`);

  const result = runBenchmarkSuite(allCases);

  // Verify all pass first
  const failures = result.results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.error('Cannot save baseline — benchmarks are failing:');
    for (const f of failures) {
      console.error(`  FAIL  ${f.name}`);
      for (const msg of f.failures) {
        console.error(`        ${msg}`);
      }
    }
    process.exit(1);
  }

  const baseline = createBaseline(result);
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');

  console.log(`Saved baseline with ${baseline.entries.length} cases to benchmarks/baseline.json`);
  console.log(`Score range: ${Math.min(...result.results.map(r => r.score)).toFixed(1)} - ${Math.max(...result.results.map(r => r.score)).toFixed(1)}`);
  console.log('');
}

// ─── Collector health check command ──────────────────────────────────

async function runCollectorHealth() {
  console.log(`\n=== SignalForge Collector Health Check ===\n`);

  const result = runCollectorHealthChecks();

  for (const r of result.results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  ${r.collectorId}`);

    const failedChecks = r.checks.filter(c => !c.passed);
    for (const c of failedChecks) {
      const detail = c.detail ? ` (${c.detail})` : '';
      console.log(`       FAIL: ${c.check}${detail}`);
    }
  }

  console.log(`\n=== ${result.passed} passed, ${result.failed} failed out of ${result.total} ===\n`);

  if (result.failed > 0) process.exit(1);
}

// ─── Integration test command ────────────────────────────────────────

async function runIntegration() {
  console.log('\n=== SignalForge Integration Test (quick scan) ===\n');
  const result = await runIntegrationTest();
  for (const r of result.results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    const detail = r.detail ? ` (${r.detail})` : '';
    console.log(`  ${icon}  ${r.check}${detail}`);
  }
  const dur = (result.durationMs / 1000).toFixed(1);
  const status = result.passed ? 'PASSED' : 'FAILED';
  console.log(`\n=== ${status} in ${dur}s ===\n`);
  if (!result.passed) process.exit(1);
}

// ─── Benchmark history command ───────────────────────────────────────

async function recordBenchmarkHistory() {
  const allCases = [...BENCHMARK_CASES, ...E2E_BENCHMARK_CASES];
  console.log('\n=== Recording Benchmark History ===\n');

  const result = runBenchmarkSuite(allCases);
  const historyPath = path.resolve(__dirname, '..', 'docs', 'benchmark-history.md');

  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].split('.')[0];
  const lines: string[] = [
    `## ${date} ${time}`,
    '',
    `| Case | Score | Ocean | Confidence | ROI | Status |`,
    `|------|-------|-------|------------|-----|--------|`,
  ];

  for (const r of result.results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const e2e = r.detectorScores ? ' [E2E]' : '';
    lines.push(`| ${r.name}${e2e} | ${r.score.toFixed(1)} | ${r.ocean} | ${r.confidence}% | ${r.roi.toFixed(1)}x | ${status} |`);
  }

  lines.push('');
  lines.push(`**Summary:** ${result.passed}/${result.total} passed`);
  lines.push('');

  let history = '';
  try {
    history = fs.readFileSync(historyPath, 'utf-8');
  } catch {
    history = '# Benchmark History\n\n<!-- BENCHMARK_HISTORY_START -->\n<!-- BENCHMARK_HISTORY_END -->\n';
  }

  const marker = '<!-- BENCHMARK_HISTORY_START -->';
  const entry = lines.join('\n');
  history = history.replace(marker, marker + '\n' + entry);

  fs.writeFileSync(historyPath, history, 'utf-8');

  console.log(`Appended ${result.total} results to docs/benchmark-history.md`);
  console.log(`${result.passed} passed, ${result.failed} failed`);
  console.log('');
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
    --e2e                  Include end-to-end detector tests

  benchmark:check          Check for regressions against baseline
  benchmark:baseline       Save current results as new baseline
  benchmark:history        Record benchmark results to docs/benchmark-history.md
  collector:health         Run collector structure health checks
  integration              Run integration test (quick scan + validation)

Examples:
  npx tsx scripts/orchestrator.ts scan
  npx tsx scripts/orchestrator.ts scan --mode deep
  npx tsx scripts/orchestrator.ts benchmark
  npx tsx scripts/orchestrator.ts benchmark --e2e
  npx tsx scripts/orchestrator.ts benchmark:check
  npx tsx scripts/orchestrator.ts benchmark:baseline
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
    case 'benchmark:check':
      await runRegressionCheck();
      break;
    case 'benchmark:baseline':
      await saveBaseline();
      break;
    case 'collector:health':
      await runCollectorHealth();
      break;
    case 'integration':
      await runIntegration();
      break;
    case 'benchmark:history':
      await recordBenchmarkHistory();
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
