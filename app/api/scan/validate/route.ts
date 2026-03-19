import { NextRequest, NextResponse } from 'next/server';
import { OpportunityCandidate } from '@/lib/engine/models/types';
import { isLLMAvailable, resetCostTracker, getCostTracker } from '@/lib/engine/detectors/llm-client';
import { llmEnrichCandidate } from '@/lib/engine/enrichment/llm-enrichment';
import { deepValidateTop } from '@/lib/engine/validation/deep-validator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ValidateRequest {
  candidates: OpportunityCandidate[];
}

export async function POST(req: NextRequest) {
  try {
    const body: ValidateRequest = await req.json();
    const { candidates } = body;

    if (!candidates?.length) {
      return NextResponse.json({ error: 'candidates required' }, { status: 400 });
    }

    resetCostTracker();

    let result = candidates;

    if (isLLMAvailable()) {
      // LLM enrich top 5 non-rejected candidates
      const sorted = [...result].sort((a, b) => b.scores.final - a.scores.final);
      const topForLLM = sorted.filter(c => !c.rejected).slice(0, 5);
      const llmEnriched = await Promise.all(topForLLM.map(c => llmEnrichCandidate(c)));
      const llmMap = new Map(llmEnriched.map(c => [c.id, c]));
      result = sorted.map(c => llmMap.get(c.id) ?? c);

      // Deep validation on top 5
      result = await deepValidateTop(result, 5);
    }

    const apiCost = getCostTracker();
    return NextResponse.json({ candidates: result, apiCost });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
