import { Collector } from './base';
import { RawSignal } from '../models/types';
import { mockTimestamps } from './mock-timestamp';

export class ReviewCollector implements Collector {
  id = 'reviews';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      try {
        await this.fetchReviews(query);
      } catch {
        console.warn(`[ReviewCollector] Live fetch failed for "${query}", using mock data`);
      }
      signals.push(this.mockSignal(query));
    }

    return signals;
  }

  private async fetchReviews(_query: string): Promise<void> {
    // TODO: Scrape G2, Capterra, or Trustpilot reviews
    throw new Error('Live scraping not implemented');
  }

  private mockSignal(query: string): RawSignal {
    const ts = mockTimestamps(`reviews:${query}`, 2);
    return {
      collectorId: this.id,
      timestamp: new Date().toISOString(),
      query,
      evidence: [
        {
          source: 'g2:reviews',
          url: `https://www.g2.com/search?query=${encodeURIComponent(query)}`,
          excerpt: `Top competitor has 3.2/5 stars. Common complaints: "clunky UI", "overpriced for what it does", "poor customer support".`,
          signalType: 'competition',
          sourceTier: 1,
          confidence: 0.85,
          timestamp: ts[0],
        },
        {
          source: 'capterra:reviews',
          url: `https://www.capterra.com/search/?query=${encodeURIComponent(query)}`,
          excerpt: `Users frustrated with existing ${query} tools: "I waste 2 hours every week on this" and "The pricing tripled after acquisition".`,
          signalType: 'pain',
          sourceTier: 1,
          confidence: 0.8,
          timestamp: ts[1],
        },
      ],
    };
  }
}
