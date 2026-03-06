// Benchmark runner that can be invoked by the orchestrator or standalone.
// Validates system outputs against known calibration cases.
// This is the objective referee — no code ships without benchmarks passing.

import { OpportunityCandidate, Evidence, DetectorResult, EconomicImpact } from '../lib/engine/models/types';
import { computeConfidence } from '../lib/engine/confidence/confidence-scorer';
import { classifyMarketStructureV2 } from '../lib/engine/market/market-structure-v2';
import { estimateEconomicImpactV2 } from '../lib/engine/detectors/economic-impact-v2';
import { detectContradictions } from '../lib/engine/confidence/contradiction-detector';
import { analyzeCandidate } from '../lib/engine/detectors/index';
import { scoreCandidate } from '../lib/engine/scoring/index';

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
  detectorScores?: Record<string, number>;
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
  const hasDetectorScores = Object.keys(detectorScores).length > 0;
  const detectorIds = [
    'demand', 'painIntensity', 'abilityToPay', 'competitionWeakness',
    'easeToBuild', 'distributionAccess', 'workflowAnchor',
    'marketTiming', 'revenueDensity', 'switchingFriction', 'aiAdvantage', 'marketExpansion',
  ];

  const detectorResults: DetectorResult[] = hasDetectorScores
    ? detectorIds.map(id => ({
        detectorId: id,
        score: detectorScores[id] ?? 5,
        explanation: `Test score for ${id}`,
      }))
    : []; // Empty — detectors will be run in E2E mode

  const scores = { final: 0, breakdown: {} as Record<string, number> };
  if (hasDetectorScores) {
    for (const dr of detectorResults) {
      scores.breakdown[dr.detectorId] = dr.score;
    }
    scores.final = detectorResults.reduce((s, r) => s + r.score, 0) / detectorResults.length;
  }

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
  let c = benchCase.candidate;

  // E2E mode: if no detector results, run the full detector + scoring pipeline
  const isE2E = c.detectorResults.length === 0;
  if (isE2E) {
    c = analyzeCandidate(c);
    c = scoreCandidate(c);
  }

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

  // For E2E cases, use the weighted score; for fixture cases, use the simple average
  const score = isE2E ? c.scores.final : c.scores.final;
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

  // Capture detector scores for baseline comparison
  const detectorScoreMap: Record<string, number> = {};
  for (const dr of c.detectorResults) {
    detectorScoreMap[dr.detectorId] = dr.score;
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
    detectorScores: isE2E ? detectorScoreMap : undefined,
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

// ─── Regression detection ───────────────────────────────────────────

export interface BaselineEntry {
  caseId: string;
  score: number;
  ocean: string;
  confidence: number;
  contradictions: number;
  roi: number;
  detectorScores?: Record<string, number>;
}

export interface BaselineData {
  version: number;
  createdAt: string;
  entries: BaselineEntry[];
}

export interface RegressionResult {
  caseId: string;
  field: string;
  baseline: number | string;
  current: number | string;
  driftPercent?: number;
  severity: 'warning' | 'regression';
}

const DRIFT_THRESHOLD = 0.10; // 10% drift triggers regression
const DETECTOR_DRIFT_THRESHOLD = 0.15; // 15% for individual detectors

export function compareToBaseline(
  suiteResult: BenchmarkSuiteResult,
  baseline: BaselineData,
): RegressionResult[] {
  const regressions: RegressionResult[] = [];

  for (const result of suiteResult.results) {
    const baseEntry = baseline.entries.find(e => e.caseId === result.caseId);
    if (!baseEntry) continue; // New case, no baseline to compare

    // Score drift
    if (baseEntry.score > 0) {
      const scoreDrift = Math.abs(result.score - baseEntry.score) / baseEntry.score;
      if (scoreDrift > DRIFT_THRESHOLD) {
        regressions.push({
          caseId: result.caseId,
          field: 'score',
          baseline: baseEntry.score,
          current: result.score,
          driftPercent: Math.round(scoreDrift * 100),
          severity: scoreDrift > DRIFT_THRESHOLD * 2 ? 'regression' : 'warning',
        });
      }
    }

    // Ocean classification change
    if (result.ocean !== baseEntry.ocean) {
      regressions.push({
        caseId: result.caseId,
        field: 'ocean',
        baseline: baseEntry.ocean,
        current: result.ocean,
        severity: 'regression',
      });
    }

    // Confidence drift
    if (baseEntry.confidence > 0) {
      const confDrift = Math.abs(result.confidence - baseEntry.confidence) / baseEntry.confidence;
      if (confDrift > DRIFT_THRESHOLD) {
        regressions.push({
          caseId: result.caseId,
          field: 'confidence',
          baseline: baseEntry.confidence,
          current: result.confidence,
          driftPercent: Math.round(confDrift * 100),
          severity: confDrift > DRIFT_THRESHOLD * 2 ? 'regression' : 'warning',
        });
      }
    }

    // Contradiction score drift
    if (baseEntry.contradictions > 0) {
      const contrDrift = Math.abs(result.contradictions - baseEntry.contradictions) / baseEntry.contradictions;
      if (contrDrift > DRIFT_THRESHOLD) {
        regressions.push({
          caseId: result.caseId,
          field: 'contradictions',
          baseline: baseEntry.contradictions,
          current: result.contradictions,
          driftPercent: Math.round(contrDrift * 100),
          severity: 'warning',
        });
      }
    }

    // Per-detector score drift (E2E cases only)
    if (result.detectorScores && baseEntry.detectorScores) {
      for (const [detId, baseScore] of Object.entries(baseEntry.detectorScores)) {
        const currentScore = result.detectorScores[detId];
        if (currentScore != null && baseScore > 0) {
          const detDrift = Math.abs(currentScore - baseScore) / baseScore;
          if (detDrift > DETECTOR_DRIFT_THRESHOLD) {
            regressions.push({
              caseId: result.caseId,
              field: `detector.${detId}`,
              baseline: baseScore,
              current: currentScore,
              driftPercent: Math.round(detDrift * 100),
              severity: detDrift > DETECTOR_DRIFT_THRESHOLD * 2 ? 'regression' : 'warning',
            });
          }
        }
      }
    }
  }

  return regressions;
}

export function createBaseline(suiteResult: BenchmarkSuiteResult): BaselineData {
  return {
    version: 1,
    createdAt: suiteResult.runAt,
    entries: suiteResult.results.map(r => ({
      caseId: r.caseId,
      score: r.score,
      ocean: r.ocean,
      confidence: r.confidence,
      contradictions: r.contradictions,
      roi: r.roi,
      detectorScores: r.detectorScores,
    })),
  };
}
