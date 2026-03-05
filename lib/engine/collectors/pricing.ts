import { Collector } from './base';
import { RawSignal } from '../models/types';
import { mockTimestamps } from './mock-timestamp';

export class PricingCollector implements Collector {
  id = 'pricing';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      try {
        await this.fetchPricing(query);
      } catch {
        console.warn(`[PricingCollector] Live fetch failed for "${query}", using mock data`);
      }
      signals.push(this.mockSignal(query));
    }

    return signals;
  }

  private async fetchPricing(_query: string): Promise<void> {
    // TODO: Scrape pricing pages of known competitors
    throw new Error('Live scraping not implemented');
  }

  private mockSignal(query: string): RawSignal {
    const ts = mockTimestamps(`pricing:${query}`, 2);
    return {
      collectorId: this.id,
      timestamp: new Date().toISOString(),
      query,
      evidence: [
        {
          source: 'pricing:competitor-analysis',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}+pricing`,
          excerpt: `Market pricing ranges from $29/mo to $299/mo. Large gap between budget and enterprise tiers suggests room for mid-market entry.`,
          signalType: 'money',
          sourceTier: 2,
          confidence: 0.65,
          timestamp: ts[0],
        },
        {
          source: 'pricing:competitor-analysis',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}+alternatives`,
          excerpt: `Several competitors recently raised prices 40-60%. Customer backlash evident in forums and review sites.`,
          signalType: 'competition',
          sourceTier: 2,
          confidence: 0.6,
          timestamp: ts[1],
        },
      ],
    };
  }
}
