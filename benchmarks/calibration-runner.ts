// Calibration benchmark runner.
// Runs quick scans for each calibration case and compares scores against expected ranges.
// Usage: npx tsx benchmarks/calibration-runner.ts [--live]
// --live: hit the deployed Vercel API instead of local pipeline

import { CALIBRATION_CASES, CalibrationCase } from './calibration-cases';

const API_BASE = process.argv.includes('--live')
  ? 'https://signal-forge-one.vercel.app'
  : 'http://localhost:3000';

interface ScanResult {
  candidates: Array<{
    jobToBeDone: string;
    scores: { final: number };
    evidence: unknown[];
    rejected?: boolean;
  }>;
  queriesUsed: string[];
}

interface CalibrationResult {
  case: CalibrationCase;
  matchedCandidate: string | null;
  score: number | null;
  evidenceCount: number;
  inRange: boolean;
  delta: number; // how far from expected range
  error?: string;
}

async function runScan(topic: string): Promise<ScanResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/run?mode=quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal: AbortSignal.timeout(55000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`  Scan failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

function findMatchingCandidate(
  result: ScanResult,
  cal: CalibrationCase
): { name: string; score: number; evidence: number } | null {
  const candidates = result.candidates.filter(c => !c.rejected);
  if (candidates.length === 0) return null;

  // Find candidate whose job-to-be-done contains expected keywords
  for (const c of candidates) {
    const jobLower = c.jobToBeDone.toLowerCase();
    const matched = cal.expectedKeywords.filter(kw => jobLower.includes(kw));
    if (matched.length >= Math.ceil(cal.expectedKeywords.length / 2)) {
      return { name: c.jobToBeDone, score: c.scores.final, evidence: c.evidence.length };
    }
  }

  // Fallback: return highest-scoring candidate
  const best = candidates.sort((a, b) => b.scores.final - a.scores.final)[0];
  return { name: best.jobToBeDone, score: best.scores.final, evidence: best.evidence.length };
}

async function runCalibration(): Promise<void> {
  console.log(`Calibration benchmark — ${CALIBRATION_CASES.length} cases`);
  console.log(`API: ${API_BASE}`);
  console.log('');

  const results: CalibrationResult[] = [];
  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (const cal of CALIBRATION_CASES) {
    process.stdout.write(`[${cal.id}] ${cal.topic}... `);

    const scanResult = await runScan(cal.topic);
    if (!scanResult) {
      console.log('ERROR (scan failed)');
      results.push({
        case: cal,
        matchedCandidate: null,
        score: null,
        evidenceCount: 0,
        inRange: false,
        delta: 0,
        error: 'scan failed',
      });
      errors++;
      continue;
    }

    const match = findMatchingCandidate(scanResult, cal);
    if (!match) {
      console.log('ERROR (no candidates)');
      results.push({
        case: cal,
        matchedCandidate: null,
        score: null,
        evidenceCount: 0,
        inRange: false,
        delta: 0,
        error: 'no candidates',
      });
      errors++;
      continue;
    }

    const inRange = match.score >= cal.expectedScoreMin && match.score <= cal.expectedScoreMax;
    const delta = match.score < cal.expectedScoreMin
      ? cal.expectedScoreMin - match.score
      : match.score > cal.expectedScoreMax
        ? match.score - cal.expectedScoreMax
        : 0;

    const status = inRange ? 'PASS' : 'FAIL';
    if (inRange) passed++;
    else failed++;

    console.log(
      `${status} | Score: ${match.score.toFixed(1)} ` +
      `(expected ${cal.expectedScoreMin}-${cal.expectedScoreMax}) ` +
      `| "${match.name}" | Ev: ${match.evidence}` +
      (delta > 0 ? ` | Off by ${delta.toFixed(1)}` : '')
    );

    results.push({
      case: cal,
      matchedCandidate: match.name,
      score: match.score,
      evidenceCount: match.evidence,
      inRange,
      delta,
    });

    // Small delay between scans to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed, ${errors} errors`);
  console.log(`Accuracy: ${((passed / (passed + failed)) * 100).toFixed(0)}%`);
  console.log('');

  // Score distribution by verdict
  for (const verdict of ['strong', 'moderate', 'weak'] as const) {
    const group = results.filter(r => r.case.verdict === verdict && r.score !== null);
    if (group.length === 0) continue;
    const scores = group.map(r => r.score as number);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    console.log(`${verdict.toUpperCase()} opportunities: avg=${avg.toFixed(1)} min=${min.toFixed(1)} max=${max.toFixed(1)}`);
  }

  // Worst misses
  const misses = results
    .filter(r => !r.inRange && r.score !== null)
    .sort((a, b) => b.delta - a.delta);

  if (misses.length > 0) {
    console.log('');
    console.log('Worst misses:');
    for (const m of misses.slice(0, 5)) {
      const dir = (m.score as number) < m.case.expectedScoreMin ? 'too low' : 'too high';
      console.log(
        `  ${m.case.id} "${m.case.topic}" — ` +
        `scored ${m.score?.toFixed(1)} (${dir} by ${m.delta.toFixed(1)}) ` +
        `[expected ${m.case.verdict}]`
      );
    }
  }
}

runCalibration().catch(e => {
  console.error('Calibration failed:', e);
  process.exit(1);
});
