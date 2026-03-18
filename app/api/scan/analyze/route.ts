import { NextRequest, NextResponse } from 'next/server';
import { RawSignal, OpportunityCandidate, EconomicImpact } from '@/lib/engine/models/types';
import { clusterSignals } from '@/lib/engine/cluster';
import { analyzeAll } from '@/lib/engine/detectors';
import { llmAnalyzeAll } from '@/lib/engine/detectors/llm-analyzer';
import { isLLMAvailable, resetCostTracker, getCostTracker } from '@/lib/engine/detectors/llm-client';
import { scoreAll, rankCandidates } from '@/lib/engine/scoring';
import { applyFilters } from '@/lib/engine/filters';
import { applyKillSwitch } from '@/lib/engine/reality/kill-switch';
import { estimateEconomicImpact } from '@/lib/engine/detectors/economic-impact';
import { estimateEconomicImpactV2 } from '@/lib/engine/detectors/economic-impact-v2';
import { analyzeMomentum } from '@/lib/engine/detectors/momentum';
import { classifyMarketStructureV2 } from '@/lib/engine/market/market-structure-v2';
import { estimateMarketSize } from '@/lib/engine/market/market-size';
import { generateWedges } from '@/lib/engine/wedge/wedge-generator';
import { synthesizeStartupConcepts, generateValidationPlan } from '@/lib/engine/synthesis/synthesizer';
import { computeConfidence } from '@/lib/engine/confidence/confidence-scorer';
import { generateScoringOutput } from '@/lib/engine/confidence/scoring-output';
import { deduplicateEvidence } from '@/lib/engine/collectors/dedup';
import { filterSignalsByTopic } from '@/lib/engine/collectors/relevance-filter';
import { deepValidateTop } from '@/lib/engine/validation/deep-validator';
import { llmEnrichCandidate } from '@/lib/engine/enrichment/llm-enrichment';
import { estimateSearchVolume } from '@/lib/engine/collectors/volume-estimator';

export const maxDuration = 300; // LLM analysis + deep validation needs more time

interface AnalyzeRequest {
  signals: RawSignal[];
  topic?: string;
}

function enrichCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
  const ecoV1 = estimateEconomicImpact(candidate);
  const ecoV2 = estimateEconomicImpactV2(candidate);

  const economicImpact: EconomicImpact = {
    ...ecoV1,
    conservative: ecoV2.conservative,
    base: ecoV2.base,
    aggressive: ecoV2.aggressive,
    impliedROIMultiple: ecoV2.impliedROIMultiple,
    paybackPeriodMonths: ecoV2.paybackPeriodMonths,
    confidence: ecoV2.confidence,
  };

  const momentum = analyzeMomentum(candidate);
  const marketStructure = classifyMarketStructureV2(candidate);
  const marketSize = estimateMarketSize(candidate);
  const withMarket = { ...candidate, economicImpact, momentum, marketStructure, marketSize };
  const purpleOpportunities = generateWedges(withMarket);
  const withWedges = { ...withMarket, purpleOpportunities };
  const startupConcepts = synthesizeStartupConcepts(withWedges);
  const validationPlan = generateValidationPlan(withWedges);
  const volumeEstimate = estimateSearchVolume(candidate.evidence);

  return { ...withWedges, startupConcepts, validationPlan, volumeEstimate };
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();
    const { signals: rawSignals, topic } = body;

    if (!rawSignals?.length) {
      return NextResponse.json({ error: 'signals required' }, { status: 400 });
    }

    resetCostTracker();

    // Filter by topic relevance first (removes garbage like unrelated HN posts)
    let signals = topic ? filterSignalsByTopic(rawSignals, topic) : rawSignals;

    // If filtering removed everything, fall back to unfiltered
    if (signals.length === 0) signals = rawSignals;

    // Deduplicate evidence across all signals
    for (const signal of signals) {
      signal.evidence = deduplicateEvidence(signal.evidence);
    }

    // Cluster & analyze (LLM if available, keyword fallback)
    const candidates = clusterSignals(signals);
    const analyzed = isLLMAvailable()
      ? await llmAnalyzeAll(candidates)
      : analyzeAll(candidates);

    // Enrich — LLM enrichment for all candidates in thorough mode (300s timeout)
    let enriched: OpportunityCandidate[];
    if (isLLMAvailable()) {
      // Heuristic enrich first for baseline, then LLM enrich top candidates
      const heuristicEnriched = analyzed.map(c => enrichCandidate(c));
      const preScored = scoreAll(heuristicEnriched);
      const preSorted = [...preScored].sort((a, b) => b.scores.final - a.scores.final);
      const topForLLM = preSorted.filter(c => !c.rejected).slice(0, 5);
      const llmEnriched = await Promise.all(topForLLM.map(c => llmEnrichCandidate(c)));
      const llmMap = new Map(llmEnriched.map(c => [c.id, c]));
      enriched = preSorted.map(c => llmMap.get(c.id) ?? c);
    } else {
      enriched = analyzed.map(c => enrichCandidate(c));
    }

    // Score
    const scored = scoreAll(enriched);

    // Confidence
    const withConfidence = scored.map(c => {
      const confidence = computeConfidence(c);
      const scoringOutput = generateScoringOutput(c);
      return { ...c, confidence, scoringOutput };
    });

    // Filter + kill switch
    const filtered = applyKillSwitch(applyFilters(withConfidence));

    // Rank
    const ranked = rankCandidates(filtered);

    // Deep validation on top 5 (LLM only — thorough mode has 300s timeout)
    const validated = isLLMAvailable()
      ? await deepValidateTop(ranked, 5)
      : ranked;

    const apiCost = getCostTracker();
    return NextResponse.json({ candidates: validated, apiCost });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
