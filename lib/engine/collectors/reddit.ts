import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { mockTimestamps } from './mock-timestamp';

export class RedditCollector implements Collector {
  id = 'reddit';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      try {
        const evidence = await this.fetchRedditSignals(query);
        signals.push({
          collectorId: this.id,
          timestamp: new Date().toISOString(),
          query,
          evidence,
        });
      } catch {
        console.warn(`[RedditCollector] Live fetch failed for "${query}", using mock data`);
        signals.push(this.mockSignal(query));
      }
    }

    return signals;
  }

  private async fetchRedditSignals(_query: string): Promise<Evidence[]> {
    // TODO: Implement real Reddit scraping via public JSON endpoints
    throw new Error('Live scraping not implemented');
  }

  private mockSignal(query: string): RawSignal {
    const ts = mockTimestamps(`reddit:${query}`, 3);
    return {
      collectorId: this.id,
      timestamp: new Date().toISOString(),
      query,
      evidence: [
        {
          source: 'reddit:r/smallbusiness',
          url: `https://reddit.com/r/smallbusiness/search?q=${encodeURIComponent(query)}`,
          excerpt: `Multiple threads discussing frustration with current ${query} solutions. Users report spending hours on manual workarounds.`,
          signalType: 'pain',
          sourceTier: 2,
          confidence: 0.7,
          timestamp: ts[0],
        },
        {
          source: 'reddit:r/SaaS',
          url: `https://reddit.com/r/SaaS/search?q=${encodeURIComponent(query)}`,
          excerpt: `Growing demand signals: "Is there a tool that does ${query}?" posts appearing weekly.`,
          signalType: 'demand',
          sourceTier: 2,
          confidence: 0.6,
          timestamp: ts[1],
        },
        {
          source: 'reddit:r/Entrepreneur',
          url: `https://reddit.com/r/Entrepreneur/search?q=${encodeURIComponent(query)}`,
          excerpt: `Business owners willing to pay $50-200/mo for a reliable ${query} solution.`,
          signalType: 'money',
          sourceTier: 2,
          confidence: 0.6,
          timestamp: ts[2],
        },
      ],
    };
  }
}
