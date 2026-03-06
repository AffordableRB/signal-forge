import { NextRequest, NextResponse } from 'next/server';
import { RawSignal, OpportunityCandidate, EconomicImpact } from '@/lib/engine/models/types';
import { clusterSignals } from '@/lib/engine/cluster';
import { analyzeAll } from '@/lib/engine/detectors';
import { llmAnalyzeAll } from '@/lib/engine/detectors/llm-analyzer';
import { isLLMAvailable } from '@/lib/engine/detectors/llm-client';
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
import { deepValidateTop } from '@/lib/engine/validation/deep-validator';

export const maxDuration = 300; // LLM analysis + deep validation needs more time

interface AnalyzeRequest {
  signals: RawSignal[];
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

  return { ...withWedges, startupConcepts, validationPlan };
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();
    const { signals } = body;

    if (!signals?.length) {
      return NextResponse.json({ error: 'signals required' }, { status: 400 });
    }

    // Deduplicate evidence across all signals
    for (const signal of signals) {
      signal.evidence = deduplicateEvidence(signal.evidence);
    }

    // Cluster & analyze (LLM if available, keyword fallback)
    const candidates = clusterSignals(signals);
    const analyzed = isLLMAvailable()
      ? await llmAnalyzeAll(candidates)
      : analyzeAll(candidates);

    // Enrich
    const enriched = analyzed.map(c => enrichCandidate(c));

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

    // Deep validation on top 2 (LLM only)
    const validated = isLLMAvailable()
      ? await deepValidateTop(ranked, 2)
      : ranked;

    return NextResponse.json({ candidates: validated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
