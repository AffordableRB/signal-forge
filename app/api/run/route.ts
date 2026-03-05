import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { saveRun } from '@/lib/runs';
import { updateWatchlistFromRun } from '@/lib/watchlist';
import { opportunityKey } from '@/lib/opportunity-key';
import { RunRecord } from '@/lib/types';
import { runPipeline } from '@/lib/engine/pipeline';

export async function POST() {
  const runId = uuid();
  const now = new Date().toISOString();

  const run: RunRecord = {
    id: runId,
    date: now,
    status: 'running',
  };
  saveRun(run);

  // Run pipeline in-process (no child process or file I/O needed)
  runPipeline()
    .then(result => {
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
    })
    .catch(e => {
      run.status = 'failed';
      run.error = e instanceof Error ? e.message : 'Pipeline failed';
      saveRun(run);
    });

  return NextResponse.json({ id: runId, status: 'running' });
}
