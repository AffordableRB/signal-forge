import { NextRequest, NextResponse } from 'next/server';
import { createCollectorById, CollectionOptions, CollectorStat } from '@/lib/engine/collectors';
import { deduplicateEvidence } from '@/lib/engine/collectors/dedup';
import { getCached, setCache } from '@/lib/engine/collectors/cache';
import { RawSignal } from '@/lib/engine/models/types';

export const maxDuration = 60;

interface CollectRequest {
  collectorId: string;
  queries: string[];
  options?: CollectionOptions;
  skipCache?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: CollectRequest = await req.json();
    const { collectorId, queries, options = {}, skipCache = false } = body;

    if (!collectorId || !queries?.length) {
      return NextResponse.json({ error: 'collectorId and queries required' }, { status: 400 });
    }

    // Check cache first (unless explicitly skipped)
    if (!skipCache) {
      const cached = getCached(collectorId, queries);
      if (cached) {
        const stat: CollectorStat = {
          id: collectorId,
          signalCount: cached.length,
          status: 'success',
          durationMs: 0,
        };
        return NextResponse.json({ signals: cached, stat, cached: true });
      }
    }

    const collector = createCollectorById(collectorId, options);
    if (!collector) {
      return NextResponse.json({ error: `Unknown collector: ${collectorId}` }, { status: 400 });
    }

    const start = Date.now();
    let timedOut = false;

    try {
      const signals = await Promise.race([
        collector.collect(queries),
        new Promise<RawSignal[]>((_, reject) =>
          setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, 50000)
        ),
      ]);

      // Deduplicate evidence within each signal
      for (const signal of signals) {
        signal.evidence = deduplicateEvidence(signal.evidence);
      }

      // Cache successful results
      if (signals.length > 0) {
        setCache(collectorId, queries, signals);
      }

      const stat: CollectorStat = {
        id: collectorId,
        signalCount: signals.length,
        status: 'success',
        durationMs: Date.now() - start,
      };

      return NextResponse.json({ signals, stat });
    } catch (e) {
      const stat: CollectorStat = {
        id: collectorId,
        signalCount: 0,
        status: timedOut ? 'timeout' : 'failed',
        durationMs: Date.now() - start,
        error: e instanceof Error ? e.message : 'Unknown error',
      };

      return NextResponse.json({ signals: [], stat });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid request' },
      { status: 400 }
    );
  }
}
