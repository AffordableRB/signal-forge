import { NextRequest, NextResponse } from 'next/server';
import { toggleWatch } from '@/lib/watchlist';
import { OpportunityCandidate } from '@/lib/types';

interface ToggleBody {
  opportunityKey: string;
  runId: string;
  opportunitySnapshot: OpportunityCandidate;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ToggleBody;

  if (!body.opportunityKey || !body.runId || !body.opportunitySnapshot) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const isNowWatched = toggleWatch(
    body.opportunityKey,
    body.runId,
    body.opportunitySnapshot
  );

  return NextResponse.json({ watched: isNowWatched, key: body.opportunityKey });
}
