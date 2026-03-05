import { NextResponse } from 'next/server';
import { getWatchlist } from '@/lib/watchlist';

export async function GET() {
  const entries = getWatchlist();
  return NextResponse.json(entries);
}
