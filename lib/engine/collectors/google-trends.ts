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
    const seen = new Set<string>();

    for (const query of queries) {
      const evidence = await this.fetchTrendSignals(query, seen);
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

  private async fetchTrendSignals(query: string, seen: Set<string>): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const queryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Run autocomplete and daily trends in parallel for reliability
    await Promise.allSettled([
      this.fetchAutocompleteTrends(query, queryKeywords, seen, evidence),
      this.fetchDailyTrends(queryKeywords, seen, evidence),
    ]);

    return evidence;
  }

  private async fetchAutocompleteTrends(
    query: string,
    queryKeywords: string[],
    seen: Set<string>,
    evidence: Evidence[],
  ): Promise<void> {
    // Full query lookup
    try {
      const url = `https://trends.google.com/trends/api/autocomplete/${encodeURIComponent(query)}?hl=en-US`;
      const raw = await throttledFetchText(url);

      const jsonStr = raw.replace(/^\)\]\}',?\n?/, '');
      const data = JSON.parse(jsonStr) as {
        default: { topics: Array<{ title: string; type: string }> };
      };

      const topics = data?.default?.topics ?? [];
      for (const topic of topics) {
        this.addIfRelevant(topic, query, queryKeywords, seen, evidence, 0.4, 0.65);
      }
    } catch {
      // Trends autocomplete may be blocked; non-fatal
    }

    // Individual keyword lookups for broader coverage
    try {
      const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
      for (const kw of keywords) {
        const url = `https://trends.google.com/trends/api/autocomplete/${encodeURIComponent(kw)}?hl=en-US`;
        const raw = await throttledFetchText(url);
        const jsonStr = raw.replace(/^\)\]\}',?\n?/, '');
        const data = JSON.parse(jsonStr) as {
          default: { topics: Array<{ title: string; type: string }> };
        };

        for (const topic of (data?.default?.topics ?? []).slice(0, 5)) {
          this.addIfRelevant(topic, query, queryKeywords, seen, evidence, 0.35, 0.55);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  private async fetchDailyTrends(
    queryKeywords: string[],
    seen: Set<string>,
    evidence: Evidence[],
  ): Promise<void> {
    try {
      // Google Trends daily RSS — more reliable than the autocomplete API
      const rssUrl = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US';
      const xml = await throttledFetchText(rssUrl);

      // Extract <title> and <ht:approx_traffic> from RSS items
      const items = xml.split('<item>').slice(1, 21); // Top 20 trends

      for (const item of items) {
        const titleMatch = item.match(/<title>([^<]+)<\/title>/);
        const trafficMatch = item.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/);
        const newsMatch = item.match(/<ht:news_item_title>([^<]+)<\/ht:news_item_title>/);

        if (!titleMatch) continue;

        const title = titleMatch[1].trim();
        const titleLower = title.toLowerCase();
        const traffic = trafficMatch?.[1] ?? '';
        const newsTitle = newsMatch?.[1] ?? '';

        if (seen.has(titleLower)) continue;

        // Check relevance: trend must relate to query keywords
        const combined = `${titleLower} ${newsTitle.toLowerCase()}`;
        const domainGeneric = new Set(['software', 'tool', 'app', 'platform', 'service', 'online', 'free', 'best']);
        const domainKeywords = queryKeywords.filter(kw => !domainGeneric.has(kw));
        const hasRelevance = domainKeywords.some(kw => combined.includes(kw));
        if (!hasRelevance) continue;

        seen.add(titleLower);

        // Parse traffic number for confidence scaling
        const trafficNum = parseInt(traffic.replace(/[^0-9]/g, ''), 10) || 0;
        let confMin = 0.4;
        let confMax = 0.6;
        if (trafficNum > 100000) { confMin = 0.55; confMax = 0.75; }
        if (trafficNum > 500000) { confMin = 0.65; confMax = 0.8; }

        evidence.push({
          source: 'google:daily-trends',
          url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=US`,
          excerpt: `Daily trending: "${title}" (${traffic} searches). ${newsTitle ? `Related: ${newsTitle.slice(0, 150)}` : ''}`.trim(),
          signalType: 'demand',
          sourceTier: 2,
          confidence: computeConfidence(title, confMin, confMax),
          timestamp: Date.now(),
        });
      }
    } catch {
      // RSS feed may be blocked; non-fatal
    }
  }

  private addIfRelevant(
    topic: { title: string; type: string },
    query: string,
    queryKeywords: string[],
    seen: Set<string>,
    evidence: Evidence[],
    confMin: number,
    confMax: number,
  ): void {
    const titleLower = topic.title.toLowerCase();
    const typeLower = topic.type.toLowerCase();

    // Skip duplicates
    if (seen.has(titleLower)) return;

    // Reject obviously irrelevant results
    if (titleLower.length > 80) return;
    if (/\b(book|novel|movie|film|song|album|actor|actress|vacation|rental|stay)\b/i.test(typeLower)) return;
    if (/\b(book|novel|movie|film|song|album|actor|actress|vacation|rental|stay)\b/i.test(titleLower)) return;

    // Relevance: topic must share a meaningful keyword with the query.
    // Single common words like "software", "studio", "booking" alone cause false positives,
    // so require a domain-specific keyword match (not just generic terms).
    const genericWords = new Set(['software', 'studio', 'booking', 'management', 'system', 'tool', 'app', 'platform', 'service', 'online', 'digital', 'free', 'best', 'top']);
    const domainKeywords = queryKeywords.filter(kw => !genericWords.has(kw));

    const hasDomainOverlap = domainKeywords.some(kw => titleLower.includes(kw));

    // Must match at least one domain keyword, OR match 2+ generic keywords
    if (!hasDomainOverlap) {
      const genericHits = queryKeywords.filter(kw => titleLower.includes(kw)).length;
      if (genericHits < 2) return;
    }

    seen.add(titleLower);

    // Higher confidence if topic matches a domain keyword
    const relevanceBoost = hasDomainOverlap ? 0.05 : 0;

    evidence.push({
      source: 'google:trends',
      url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic.title)}`,
      excerpt: `Trending: "${topic.title}" (${topic.type}). Related to "${query}".`,
      signalType: 'demand',
      sourceTier: 3,
      confidence: computeConfidence(topic.title, confMin + relevanceBoost, confMax + relevanceBoost),
      timestamp: Date.now(),
    });
  }
}
