// In-process pipeline runner for serverless environments (Vercel).
// Full pipeline: collect → cluster → analyze → enrich → confidence → score → filter → rank

import { OpportunityCandidate, EconomicImpact } from './models/types';
import { collectAllSignals, CollectorStat } from './collectors';
import { clusterSignals } from './cluster';
import { analyzeAll } from './detectors';
import { scoreAll, rankCandidates } from './scoring';
import { applyFilters } from './filters';
import { applyKillSwitch } from './reality/kill-switch';
import { SEED_QUERIES } from './config/seed-queries';
import { estimateEconomicImpact } from './detectors/economic-impact';
import { estimateEconomicImpactV2 } from './detectors/economic-impact-v2';
import { analyzeMomentum } from './detectors/momentum';
import { classifyMarketStructureV2 } from './market/market-structure-v2';
import { estimateMarketSize } from './market/market-size';
import { generateWedges } from './wedge/wedge-generator';
import { synthesizeStartupConcepts, generateValidationPlan } from './synthesis/synthesizer';
import { computeConfidence } from './confidence/confidence-scorer';
import { generateScoringOutput } from './confidence/scoring-output';

// Use fewer queries in serverless to stay within timeout limits
const WEB_QUERY_LIMIT = 4;

export interface PipelineResult {
  candidates: OpportunityCandidate[];
  topScore: number;
  topOpportunity: string;
  candidateCount: number;
  collectorStats: CollectorStat[];
  queriesUsed: string[];
}

export async function runPipeline(): Promise<PipelineResult> {
  // 1. Collect (limit queries for serverless timeout)
  const queries = SEED_QUERIES.slice(0, WEB_QUERY_LIMIT);
  const { signals, collectorStats } = await collectAllSignals(queries);

  // 2. Cluster
  const candidates = clusterSignals(signals);

  // 3. Analyze (12 core detectors)
  const analyzed = analyzeAll(candidates);

  // 4. Enrich: market analysis, economics, momentum, wedges, synthesis
  const enriched = analyzed.map(c => enrichCandidate(c));

  // 5. Score
  const scored = scoreAll(enriched);

  // 6. Confidence & scoring output (runs after scoring so scores are available)
  const withConfidence = scored.map(c => {
    const confidence = computeConfidence(c);
    const scoringOutput = generateScoringOutput(c);
    return { ...c, confidence, scoringOutput };
  });

  // 7. Filter + kill switch
  const filtered = applyKillSwitch(applyFilters(withConfidence));

  // 8. Rank
  const ranked = rankCandidates(filtered);

  const accepted = ranked.filter(c => !c.rejected);

  return {
    candidates: ranked,
    topScore: accepted[0]?.scores.final ?? 0,
    topOpportunity: accepted[0]?.jobToBeDone ?? 'N/A',
    candidateCount: ranked.length,
    collectorStats,
    queriesUsed: queries,
  };
}

function enrichCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  // Economic impact (v1 for backward compat fields)
  const ecoV1 = estimateEconomicImpact(candidate);

  // Economic impact v2 (scenario modeling)
  const ecoV2 = estimateEconomicImpactV2(candidate);

  // Merge v1 and v2 into single EconomicImpact
  const economicImpact: EconomicImpact = {
    ...ecoV1,
    conservative: ecoV2.conservative,
    base: ecoV2.base,
    aggressive: ecoV2.aggressive,
    impliedROIMultiple: ecoV2.impliedROIMultiple,
    paybackPeriodMonths: ecoV2.paybackPeriodMonths,
    confidence: ecoV2.confidence,
  };

  // Signal momentum
  const momentum = analyzeMomentum(candidate);

  // Market structure v2 (tighter Red/Blue/Purple classification)
  const marketStructure = classifyMarketStructureV2(candidate);

  // Market size estimation
  const marketSize = estimateMarketSize(candidate);

  // Attach market structure first (wedge generator needs it)
  const withMarket = { ...candidate, economicImpact, momentum, marketStructure, marketSize };

  // Purple ocean wedges
  const purpleOpportunities = generateWedges(withMarket);

  // Attach wedges (synthesizer needs them)
  const withWedges = { ...withMarket, purpleOpportunities };

  // Startup concepts + validation plan
  const startupConcepts = synthesizeStartupConcepts(withWedges);
  const validationPlan = generateValidationPlan(withWedges);

  return { ...withWedges, startupConcepts, validationPlan };
}
