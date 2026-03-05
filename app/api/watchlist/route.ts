import { NextResponse } from 'next/server';
import { getWatchlist } from '@/lib/watchlist';

export const dynamic = 'force-dynamic';

export async function GET() {
  const entries = getWatchlist();
  return NextResponse.json(entries);
}
