import { Collector } from './base';
import { RedditCollector } from './reddit';
import { HackerNewsCollector } from './hacker-news';
import { SearchIntentCollector } from './search-intent';
import { GoogleTrendsCollector } from './google-trends';
import { ReviewCollector } from './reviews';
import { UpworkCollector } from './upwork';
import { ProductHuntCollector } from './product-hunt';
import { PricingCollector } from './pricing';
import { deduplicateEvidence } from './dedup';
import { RawSignal } from '../models/types';

export interface CollectorStat {
  id: string;
  signalCount: number;
  status: 'success' | 'failed' | 'timeout';
  durationMs: number;
  error?: string;
}

// Fast collectors (direct APIs, no proxy needed) — run first
function createFastCollectors(): Collector[] {
  return [
    new RedditCollector(),
    new HackerNewsCollector(),
    new SearchIntentCollector(),
    new GoogleTrendsCollector(),
  ];
}

// Slow collectors (need proxy, may take 10-30s per request)
function createProxyCollectors(): Collector[] {
  return [
    new ReviewCollector(),
    new UpworkCollector(),
    new ProductHuntCollector(),
    new PricingCollector(),
  ];
}

// Wrap a collector with a timeout so one slow source doesn't block everything
interface TimedCollector {
  id: string;
  collect(queries: string[]): Promise<{ signals: RawSignal[]; stat: CollectorStat }>;
}

function withTimeout(collector: Collector, ms: number): TimedCollector {
  return {
    id: collector.id,
    async collect(queries: string[]): Promise<{ signals: RawSignal[]; stat: CollectorStat }> {
      const start = Date.now();
      let timedOut = false;

      try {
        const signals = await Promise.race([
          collector.collect(queries),
          new Promise<RawSignal[]>((_, reject) =>
            setTimeout(() => {
              timedOut = true;
              reject(new Error('timeout'));
            }, ms)
          ),
        ]);

        return {
          signals,
          stat: {
            id: collector.id,
            signalCount: signals.length,
            status: 'success',
            durationMs: Date.now() - start,
          },
        };
      } catch (e) {
        return {
          signals: [],
          stat: {
            id: collector.id,
            signalCount: 0,
            status: timedOut ? 'timeout' : 'failed',
            durationMs: Date.now() - start,
            error: e instanceof Error ? e.message : 'Unknown error',
          },
        };
      }
    },
  };
}

export interface CollectionResult {
  signals: RawSignal[];
  collectorStats: CollectorStat[];
}

export async function collectAllSignals(queries: string[]): Promise<CollectionResult> {
  const fast = createFastCollectors().map(c => withTimeout(c, 25000));
  const proxy = createProxyCollectors().map(c => withTimeout(c, 40000));

  // Run fast and proxy collectors simultaneously
  const all = [...fast, ...proxy];
  const results = await Promise.allSettled(
    all.map(c => c.collect(queries))
  );

  const allSignals: RawSignal[] = [];
  const collectorStats: CollectorStat[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allSignals.push(...result.value.signals);
      collectorStats.push(result.value.stat);
    } else {
      collectorStats.push({
        id: all[i].id,
        signalCount: 0,
        status: 'failed',
        durationMs: 0,
        error: result.reason?.message ?? 'Unknown',
      });
    }
  }

  // Deduplicate evidence within each signal
  for (const signal of allSignals) {
    signal.evidence = deduplicateEvidence(signal.evidence);
  }

  return { signals: allSignals, collectorStats };
}
