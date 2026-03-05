import { NextResponse } from 'next/server';
import { getAllRuns } from '@/lib/runs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runs = getAllRuns().map(r => ({
    id: r.id,
    date: r.date,
    status: r.status,
    topScore: r.topScore,
    topOpportunity: r.topOpportunity,
    candidateCount: r.candidateCount,
    error: r.error,
  }));
  return NextResponse.json(runs);
}
