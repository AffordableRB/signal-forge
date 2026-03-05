import { Collector } from './base';
import { RawSignal } from '../models/types';
import { mockTimestamps } from './mock-timestamp';

export class SearchIntentCollector implements Collector {
  id = 'search-intent';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      try {
        await this.fetchSearchIntent(query);
      } catch {
        console.warn(`[SearchIntentCollector] Live fetch failed for "${query}", using mock data`);
      }
      signals.push(this.mockSignal(query));
    }

    return signals;
  }

  private async fetchSearchIntent(_query: string): Promise<void> {
    // TODO: Use Google Trends RSS or autocomplete API for search intent signals
    throw new Error('Live scraping not implemented');
  }

  private mockSignal(query: string): RawSignal {
    const ts = mockTimestamps(`search:${query}`, 2);
    return {
      collectorId: this.id,
      timestamp: new Date().toISOString(),
      query,
      evidence: [
        {
          source: 'google:autocomplete',
          url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`,
          excerpt: `Search volume for "${query} software" growing 25% YoY. Related queries: "${query} alternative", "${query} for small business", "best ${query} tool".`,
          signalType: 'demand',
          sourceTier: 1,
          confidence: 0.8,
          timestamp: ts[0],
        },
        {
          source: 'google:trends',
          url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`,
          excerpt: `"${query} automation" breakout search term. Interest increasing steadily over 12 months.`,
          signalType: 'demand',
          sourceTier: 1,
          confidence: 0.75,
          timestamp: ts[1],
        },
      ],
    };
  }
}
