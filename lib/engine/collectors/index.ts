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
function withTimeout(collector: Collector, ms: number): Collector {
  return {
    id: collector.id,
    async collect(queries: string[]): Promise<RawSignal[]> {
      return Promise.race([
        collector.collect(queries),
        new Promise<RawSignal[]>(resolve =>
          setTimeout(() => {
            console.warn(`[${collector.id}] Timed out after ${ms}ms`);
            resolve([]);
          }, ms)
        ),
      ]);
    },
  };
}

export async function collectAllSignals(queries: string[]): Promise<RawSignal[]> {
  const fast = createFastCollectors().map(c => withTimeout(c, 25000));
  const proxy = createProxyCollectors().map(c => withTimeout(c, 40000));

  // Run fast and proxy collectors simultaneously
  const all = [...fast, ...proxy];
  const results = await Promise.allSettled(
    all.map(c => c.collect(queries))
  );

  const allSignals: RawSignal[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allSignals.push(...result.value);
    }
  }

  // Deduplicate evidence within each signal
  for (const signal of allSignals) {
    signal.evidence = deduplicateEvidence(signal.evidence);
  }

  return allSignals;
}
