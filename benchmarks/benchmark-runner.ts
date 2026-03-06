// Benchmark runner that can be invoked by the orchestrator or standalone.
// Validates system outputs against known calibration cases.
// This is the objective referee — no code ships without benchmarks passing.

import { OpportunityCandidate, Evidence, DetectorResult, EconomicImpact } from '../lib/engine/models/types';
import { computeConfidence } from '../lib/engine/confidence/confidence-scorer';
import { classifyMarketStructureV2 } from '../lib/engine/market/market-structure-v2';
import { estimateEconomicImpactV2 } from '../lib/engine/detectors/economic-impact-v2';
import { detectContradictions } from '../lib/engine/confidence/contradiction-detector';

// ─── Types ──────────────────────────────────────────────────────────

export interface BenchmarkCase {
  id: string;
  name: string;
  candidate: OpportunityCandidate;
  expect: {
    minScore?: number;
    maxScore?: number;
    ocean?: 'red' | 'blue' | 'purple';
    minConfidence?: number;
    maxContradictions?: number;
    minROI?: number;
  };
}

export interface BenchmarkResult {
  caseId: string;
  name: string;
  passed: boolean;
  score: number;
  ocean: string;
  confidence: number;
  contradictions: number;
  roi: number;
  failures: string[];
}

export interface BenchmarkSuiteResult {
  passed: number;
  failed: number;
  total: number;
  results: BenchmarkResult[];
  runAt: string;
}

// ─── Test fixture helpers ───────────────────────────────────────────

export function makeCandidate(overrides: Partial<OpportunityCandidate> & {
  detectorScores?: Record<string, number>;
}): OpportunityCandidate {
  const detectorScores = overrides.detectorScores ?? {};
  const detectorIds = [
    'demand', 'painIntensity', 'abilityToPay', 'competitionWeakness',
    'easeToBuild', 'distributionAccess', 'workflowAnchor',
    'marketTiming', 'revenueDensity', 'switchingFriction', 'aiAdvantage', 'marketExpansion',
  ];

  const detectorResults: DetectorResult[] = detectorIds.map(id => ({
    detectorId: id,
    score: detectorScores[id] ?? 5,
    explanation: `Test score for ${id}`,
  }));

  const scores = { final: 0, breakdown: {} as Record<string, number> };
  for (const dr of detectorResults) {
    scores.breakdown[dr.detectorId] = dr.score;
  }
  scores.final = detectorResults.reduce((s, r) => s + r.score, 0) / detectorResults.length;

  return {
    id: 'bench-' + Math.random().toString(36).slice(2, 8),
    vertical: overrides.vertical ?? 'general',
    jobToBeDone: overrides.jobToBeDone ?? 'test job',
    targetBuyer: overrides.targetBuyer ?? 'Small business owner',
    triggerMoment: overrides.triggerMoment ?? 'Growth trigger',
    evidence: overrides.evidence ?? [],
    competitors: overrides.competitors ?? [],
    rawSignals: [],
    detectorResults,
    scores,
    rejected: false,
    rejectionReasons: [],
    riskFlags: overrides.riskFlags ?? [],
  };
}

export function makeEvidence(count: number, opts: Partial<Evidence> = {}): Evidence[] {
  return Array.from({ length: count }, (_, i) => ({
    source: opts.source ?? 'Reddit: r/startup',
    url: `https://example.com/${i}`,
    excerpt: opts.excerpt ?? 'Looking for a solution to manage missed calls and follow up automatically',
    signalType: opts.signalType ?? 'demand',
    sourceTier: opts.sourceTier ?? 2,
    confidence: opts.confidence ?? 0.7,
    timestamp: opts.timestamp ?? Date.now() - i * 86400000,
  }));
}

// ─── Runner ─────────────────────────────────────────────────────────

export function runBenchmark(benchCase: BenchmarkCase): BenchmarkResult {
  const c = benchCase.candidate;

  const ms = classifyMarketStructureV2(c);
  const eco = estimateEconomicImpactV2(c);

  const withAnalysis = {
    ...c,
    marketStructure: ms,
    economicImpact: {
      timeCostHoursPerMonth: eco.base.timeCostHoursPerMonth,
      laborCostPerMonth: [eco.conservative.laborCostPerMonth, eco.aggressive.laborCostPerMonth] as [number, number],
      revenueLossPerMonth: [eco.conservative.revenueLossPerMonth, eco.aggressive.revenueLossPerMonth] as [number, number],
      totalMonthlyCost: [eco.conservative.totalMonthlyCost, eco.aggressive.totalMonthlyCost] as [number, number],
      economicPainScore: eco.economicPainScore,
      explanation: eco.explanation,
      conservative: eco.conservative,
      base: eco.base,
      aggressive: eco.aggressive,
      impliedROIMultiple: eco.impliedROIMultiple,
      paybackPeriodMonths: eco.paybackPeriodMonths,
      confidence: eco.confidence,
    } as EconomicImpact,
  };

  const confidence = computeConfidence(withAnalysis);
  const contradictions = detectContradictions(withAnalysis);

  const score = c.scores.final;
  const failures: string[] = [];

  if (benchCase.expect.minScore != null && score < benchCase.expect.minScore) {
    failures.push(`score ${score.toFixed(1)} < min ${benchCase.expect.minScore}`);
  }
  if (benchCase.expect.maxScore != null && score > benchCase.expect.maxScore) {
    failures.push(`score ${score.toFixed(1)} > max ${benchCase.expect.maxScore}`);
  }
  if (benchCase.expect.ocean && ms.type !== benchCase.expect.ocean) {
    failures.push(`ocean ${ms.type} != expected ${benchCase.expect.ocean}`);
  }
  if (benchCase.expect.minConfidence != null && confidence.overall < benchCase.expect.minConfidence) {
    failures.push(`confidence ${confidence.overall} < min ${benchCase.expect.minConfidence}`);
  }
  if (benchCase.expect.maxContradictions != null && contradictions.contradictionScore > benchCase.expect.maxContradictions) {
    failures.push(`contradictions ${contradictions.contradictionScore} > max ${benchCase.expect.maxContradictions}`);
  }
  if (benchCase.expect.minROI != null && eco.impliedROIMultiple < benchCase.expect.minROI) {
    failures.push(`ROI ${eco.impliedROIMultiple} < min ${benchCase.expect.minROI}`);
  }

  return {
    caseId: benchCase.id,
    name: benchCase.name,
    passed: failures.length === 0,
    score,
    ocean: ms.type,
    confidence: confidence.overall,
    contradictions: contradictions.contradictionScore,
    roi: eco.impliedROIMultiple,
    failures,
  };
}

export function runBenchmarkSuite(cases: BenchmarkCase[]): BenchmarkSuiteResult {
  const results = cases.map(c => runBenchmark(c));
  return {
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    total: results.length,
    results,
    runAt: new Date().toISOString(),
  };
}
