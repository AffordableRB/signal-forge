import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { saveRun } from '@/lib/runs';
import { updateWatchlistFromRun } from '@/lib/watchlist';
import { opportunityKey } from '@/lib/opportunity-key';
import { RunRecord } from '@/lib/types';
import { runPipeline } from '@/lib/engine/pipeline';

export const maxDuration = 60;

export async function POST() {
  const runId = uuid();
  const now = new Date().toISOString();

  const run: RunRecord = {
    id: runId,
    date: now,
    status: 'running',
  };
  saveRun(run);

  try {
    const result = await runPipeline();

    const sorted = result.candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.scores.final - a.scores.final);

    run.status = 'completed';
    run.candidates = result.candidates;
    run.candidateCount = result.candidateCount;
    run.topScore = sorted[0]?.scores.final ?? 0;
    run.topOpportunity = sorted[0]?.jobToBeDone ?? 'N/A';
    saveRun(run);

    updateWatchlistFromRun(runId, result.candidates, opportunityKey);

    return NextResponse.json({
      id: runId,
      status: 'completed',
      candidateCount: run.candidateCount,
      topScore: run.topScore,
    });
  } catch (e) {
    run.status = 'failed';
    run.error = e instanceof Error ? e.message : 'Pipeline failed';
    saveRun(run);

    return NextResponse.json(
      { id: runId, status: 'failed', error: run.error },
      { status: 500 }
    );
  }
}
