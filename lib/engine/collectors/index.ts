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

export function createCollectors(): Collector[] {
  return [
    new RedditCollector(),
    new HackerNewsCollector(),
    new SearchIntentCollector(),
    new GoogleTrendsCollector(),
    new ReviewCollector(),
    new UpworkCollector(),
    new ProductHuntCollector(),
    new PricingCollector(),
  ];
}

export async function collectAllSignals(queries: string[]): Promise<RawSignal[]> {
  const collectors = createCollectors();

  // Run all collectors concurrently (rate-limiter handles throttling)
  const results = await Promise.allSettled(
    collectors.map(c => c.collect(queries))
  );

  const allSignals: RawSignal[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allSignals.push(...result.value);
    } else {
      console.warn('[collectAllSignals] Collector failed:', result.reason);
    }
  }

  // Deduplicate evidence within each signal
  for (const signal of allSignals) {
    signal.evidence = deduplicateEvidence(signal.evidence);
  }

  return allSignals;
}
