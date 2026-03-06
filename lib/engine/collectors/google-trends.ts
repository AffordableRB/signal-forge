import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { computeConfidence } from './classify';

// Google Trends doesn't have a stable public API.
// We use the autocomplete/related queries endpoint and the
// daily trends RSS as lightweight proxies for trend signals.

export class GoogleTrendsCollector implements Collector {
  id = 'google-trends';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchTrendSignals(query);
      if (evidence.length > 0) {
        signals.push({
          collectorId: this.id,
          timestamp: new Date().toISOString(),
          query,
          evidence,
        });
      }
    }

    return signals;
  }

  private async fetchTrendSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Use Google Trends explore suggestions to find related trending terms
    try {
      const url = `https://trends.google.com/trends/api/autocomplete/${encodeURIComponent(query)}?hl=en-US`;
      const raw = await throttledFetchText(url);

      // Google Trends returns JSONP with )]}', prefix
      const jsonStr = raw.replace(/^\)\]\}',?\n?/, '');
      const data = JSON.parse(jsonStr) as {
        default: { topics: Array<{ title: string; type: string }> };
      };

      const topics = data?.default?.topics ?? [];
      for (const topic of topics) {
        evidence.push({
          source: 'google:trends',
          url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic.title)}`,
          excerpt: `Trending topic: "${topic.title}" (${topic.type}). Related to search query "${query}".`,
          signalType: 'demand',
          sourceTier: 3,
          confidence: computeConfidence(topic.title, 0.4, 0.6),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Trends autocomplete may be blocked; non-fatal
    }

    // Use related queries via the suggestions endpoint
    try {
      const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
      for (const kw of keywords) {
        const url = `https://trends.google.com/trends/api/autocomplete/${encodeURIComponent(kw)}?hl=en-US`;
        const raw = await throttledFetchText(url);
        const jsonStr = raw.replace(/^\)\]\}',?\n?/, '');
        const data = JSON.parse(jsonStr) as {
          default: { topics: Array<{ title: string; type: string }> };
        };

        for (const topic of (data?.default?.topics ?? []).slice(0, 3)) {
          evidence.push({
            source: 'google:trends',
            url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic.title)}`,
            excerpt: `Rising interest in "${topic.title}" — signals expanding market around "${query}".`,
            signalType: 'demand',
            sourceTier: 3,
            confidence: computeConfidence(topic.title, 0.4, 0.55),
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // Non-fatal
    }

    return evidence;
  }
}
