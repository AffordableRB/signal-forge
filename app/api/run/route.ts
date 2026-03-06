import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { RunRecord } from '@/lib/types';
import { runPipeline } from '@/lib/engine/pipeline';

export const maxDuration = 60;

// Thorough mode uses client-orchestrated /api/scan/* routes, not this endpoint
const VALID_MODES = ['quick', 'standard', 'deep'] as const;
type PipelineScanMode = (typeof VALID_MODES)[number];

export async function POST(req: NextRequest) {
  const runId = uuid();
  const now = new Date().toISOString();

  // Parse scan mode from query string or body
  const url = new URL(req.url);
  const modeParam = url.searchParams.get('mode') ?? 'standard';
  const scanMode: PipelineScanMode = VALID_MODES.includes(modeParam as PipelineScanMode)
    ? (modeParam as PipelineScanMode)
    : 'standard';

  try {
    const result = await runPipeline(scanMode);

    const sorted = result.candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.scores.final - a.scores.final);

    const run: RunRecord = {
      id: runId,
      date: now,
      status: 'completed',
      scanMode,
      phases: result.phases.map(p => ({
        id: p.phase,
        label: p.label,
        status: p.status === 'running' ? 'completed' : p.status,
        durationMs: p.durationMs,
        signalsAdded: p.signalsAdded,
      })),
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
