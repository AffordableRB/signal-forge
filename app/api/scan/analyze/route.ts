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
import { extractCompetitorsAll } from '@/lib/engine/competitors/extract-competitors';
import { estimateSearchVolume } from '@/lib/engine/collectors/volume-estimator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  // Inject momentum as a detector result so it feeds into weighted scoring
  const enrichedCandidate = { ...withWedges, startupConcepts, validationPlan, volumeEstimate };
  if (momentum) {
    const hasMomentumResult = enrichedCandidate.detectorResults.some(d => d.detectorId === 'momentum');
    if (!hasMomentumResult) {
      enrichedCandidate.detectorResults.push({
        detectorId: 'momentum',
        score: momentum.momentumScore,
        explanation: `Trend: ${momentum.trend}. ${momentum.recent30d} signals in last 30d (${momentum.growthRate > 0 ? '+' : ''}${momentum.growthRate}% growth).`,
      });
    }
  }

  return enrichedCandidate;
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

    // Heuristic enrich all candidates
    const enriched = analyzed.map(c => enrichCandidate(c));

    // Extract competitors
    const withCompetitors = await extractCompetitorsAll(enriched);

    // Score
    const scored = scoreAll(withCompetitors);

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

    const apiCost = getCostTracker();
    return NextResponse.json({ candidates: ranked, apiCost });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
