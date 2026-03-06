import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { RunRecord } from '@/lib/types';
import { runPipeline } from '@/lib/engine/pipeline';

export const maxDuration = 60;

export async function POST() {
  const runId = uuid();
  const now = new Date().toISOString();

  try {
    const result = await runPipeline();

    const sorted = result.candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.scores.final - a.scores.final);

    const run: RunRecord = {
      id: runId,
      date: now,
      status: 'completed',
      candidates: result.candidates,
      candidateCount: result.candidateCount,
      topScore: sorted[0]?.scores.final ?? 0,
      topOpportunity: sorted[0]?.jobToBeDone ?? 'N/A',
      collectorStats: result.collectorStats,
      queriesUsed: result.queriesUsed,
    };

    return NextResponse.json(run);
  } catch (e) {
    return NextResponse.json(
      {
        id: runId,
        date: now,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Pipeline failed',
      } satisfies RunRecord,
      { status: 500 }
    );
  }
}
