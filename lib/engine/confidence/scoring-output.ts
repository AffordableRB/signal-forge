import { OpportunityCandidate, ScoringOutput } from '../models/types';
import { computeEvidenceQualityScore } from './evidence-weights';
import { filterByRelevance } from './relevance-filter';

const DETECTOR_LABELS: Record<string, string> = {
  demand: 'Demand',
  painIntensity: 'Pain intensity',
  abilityToPay: 'Ability to pay',
  competitionWeakness: 'Competition weakness',
  easeToBuild: 'Ease to build',
  distributionAccess: 'Distribution access',
  workflowAnchor: 'Workflow anchor',
  marketTiming: 'Market timing',
  revenueDensity: 'Revenue density',
  aiAdvantage: 'AI advantage',
  marketExpansion: 'Market expansion',
  switchingFriction: 'Switching friction',
};

export function generateScoringOutput(candidate: OpportunityCandidate): ScoringOutput {
  // Top reasons (highest scoring detectors)
  const sorted = [...candidate.detectorResults].sort((a, b) => b.score - a.score);
  const topReasons = sorted.slice(0, 3).map(r => {
    const label = DETECTOR_LABELS[r.detectorId] ?? r.detectorId;
    return `${label}: ${r.score}/10 — ${r.explanation.slice(0, 100)}`;
  });

  // Bottom reasons (lowest scoring detectors)
  const bottomReasons = sorted.slice(-3).reverse().map(r => {
    const label = DETECTOR_LABELS[r.detectorId] ?? r.detectorId;
    return `${label}: ${r.score}/10 — ${r.explanation.slice(0, 100)}`;
  });

  // Evidence quality summary
  const eqScore = computeEvidenceQualityScore(candidate.evidence);
  const sourceSet = new Set(candidate.evidence.map(e => {
    const l = e.source.toLowerCase();
    if (l.includes('reddit')) return 'Reddit';
    if (l.includes('g2') || l.includes('capterra') || l.includes('trustpilot')) return 'Reviews';
    if (l.includes('indeed') || l.includes('job')) return 'Jobs';
    if (l.includes('product hunt')) return 'Product Hunt';
    if (l.includes('trend')) return 'Trends';
    if (l.includes('pricing')) return 'Pricing';
    return 'Other';
  }));
  const sources = Array.from(sourceSet);
  const evidenceQualitySummary = `${candidate.evidence.length} signals from ${sources.length} source types (${sources.join(', ')}). Quality score: ${eqScore}/100.`;

  // Excluded noise summary
  const relevance = filterByRelevance(
    candidate.evidence,
    candidate.jobToBeDone,
    candidate.targetBuyer,
    candidate.vertical
  );
  const excluded = relevance.irrelevant.length;
  const weak = relevance.weaklyRelevant.length;
  const excludedNoiseSummary = excluded > 0 || weak > 0
    ? `${excluded} irrelevant and ${weak} weakly-relevant signals identified. ${excluded > 0 ? 'Irrelevant signals excluded from confidence scoring.' : ''}`
    : 'All signals classified as relevant to this opportunity.';

  return { topReasons, bottomReasons, evidenceQualitySummary, excludedNoiseSummary };
}
