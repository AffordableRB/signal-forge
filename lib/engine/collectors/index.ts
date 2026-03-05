import { Collector } from './base';
import { RedditCollector } from './reddit';
import { ReviewCollector } from './reviews';
import { PricingCollector } from './pricing';
import { SearchIntentCollector } from './search-intent';
import { RawSignal } from '../models/types';

export function createCollectors(): Collector[] {
  return [
    new RedditCollector(),
    new ReviewCollector(),
    new PricingCollector(),
    new SearchIntentCollector(),
  ];
}

export async function collectAllSignals(queries: string[]): Promise<RawSignal[]> {
  const collectors = createCollectors();
  const results = await Promise.all(
    collectors.map(c => c.collect(queries))
  );
  return results.flat();
}
