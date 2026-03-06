import { NextRequest, NextResponse } from 'next/server';
import { RawSignal, OpportunityCandidate, EconomicImpact } from '@/lib/engine/models/types';
import { clusterSignals } from '@/lib/engine/cluster';
import { analyzeAll } from '@/lib/engine/detectors';
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

export const maxDuration = 60;

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

    // Cluster & analyze
    const candidates = clusterSignals(signals);
    const analyzed = analyzeAll(candidates);
    const reanalyzed = analyzeAll(analyzed);

    // Enrich
    const enriched = reanalyzed.map(c => enrichCandidate(c));

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

    return NextResponse.json({ candidates: ranked });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
