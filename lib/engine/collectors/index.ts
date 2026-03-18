import { Collector } from './base';
import { RedditCollector } from './reddit';
import { HackerNewsCollector } from './hacker-news';
import { SearchIntentCollector } from './search-intent';
import { GoogleTrendsCollector } from './google-trends';
import { ReviewCollector } from './reviews';
import { UpworkCollector } from './upwork';
import { ProductHuntCollector } from './product-hunt';
import { PricingCollector } from './pricing';
import { StackExchangeCollector } from './stackexchange';
import { GitHubCollector } from './github';
import { DuckDuckGoCollector } from './duckduckgo';
import { deduplicateEvidence } from './dedup';
import { RawSignal } from '../models/types';

export interface CollectorStat {
  id: string;
  signalCount: number;
  status: 'success' | 'failed' | 'timeout';
  durationMs: number;
  error?: string;
}

export interface CollectionOptions {
  fastTimeoutMs?: number;
  proxyTimeoutMs?: number;
  redditResultLimit?: number;
  subredditDepth?: number;
  reviewSnippetLimit?: number;
  pricingQueryCount?: number;
  jobResultLimit?: number;
}

// Fast collectors (direct APIs, no proxy needed)
function createFastCollectors(): Collector[] {
  return [
    new HackerNewsCollector(),
    new SearchIntentCollector(),
    new GoogleTrendsCollector(),
    new StackExchangeCollector(),
    new GitHubCollector(),
    new DuckDuckGoCollector(),
  ];
}

// Slow collectors (need proxy)
function createProxyCollectors(opts: CollectionOptions): Collector[] {
  return [
    new RedditCollector(opts.redditResultLimit, opts.subredditDepth),
    new ReviewCollector(opts.reviewSnippetLimit),
    new UpworkCollector(opts.jobResultLimit),
    new ProductHuntCollector(),
    new PricingCollector(opts.pricingQueryCount),
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

// Factory to create a single collector by ID
export function createCollectorById(id: string, opts: CollectionOptions = {}): Collector | null {
  switch (id) {
    case 'hackernews': return new HackerNewsCollector();
    case 'search-intent': return new SearchIntentCollector();
    case 'google-trends': return new GoogleTrendsCollector();
    case 'reddit': return new RedditCollector(opts.redditResultLimit, opts.subredditDepth);
    case 'reviews': return new ReviewCollector(opts.reviewSnippetLimit);
    case 'jobs': return new UpworkCollector(opts.jobResultLimit);
    case 'product-hunt': return new ProductHuntCollector();
    case 'pricing': return new PricingCollector(opts.pricingQueryCount);
    case 'stackexchange': return new StackExchangeCollector();
    case 'github': return new GitHubCollector();
    case 'duckduckgo': return new DuckDuckGoCollector();
    default: return null;
  }
}

export const ALL_COLLECTOR_IDS = [
  'hackernews', 'search-intent', 'google-trends', 'stackexchange', 'github', 'duckduckgo',
  'reddit', 'reviews', 'jobs', 'product-hunt', 'pricing',
];

export async function collectAllSignals(
  queries: string[],
  opts: CollectionOptions = {},
): Promise<CollectionResult> {
  const fastTimeout = opts.fastTimeoutMs ?? 25000;
  const proxyTimeout = opts.proxyTimeoutMs ?? 40000;

  const fast = createFastCollectors().map(c => withTimeout(c, fastTimeout));
  const proxy = createProxyCollectors(opts).map(c => withTimeout(c, proxyTimeout));

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

  for (const signal of allSignals) {
    signal.evidence = deduplicateEvidence(signal.evidence);
  }

  return { signals: allSignals, collectorStats };
}
