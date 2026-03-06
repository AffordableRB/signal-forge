import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText, hasProxyKey } from './rate-limiter';
import { computeConfidence } from './classify';

// Scrapes competitor pricing pages via search results.
// Uses proxy for Google search (which blocks bots aggressively).

const PRICE_PATTERNS = [
  /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/?\s*(?:mo(?:nth)?|yr|year|user|seat))/gi,
  /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per\s+(?:month|year|user|seat))/gi,
  /starting\s+(?:at|from)\s+\$(\d+)/gi,
  /plans?\s+(?:start|begin)\s+at\s+\$(\d+)/gi,
  /free\s+(?:plan|tier|trial)/gi,
  /enterprise\s+(?:plan|pricing|contact)/gi,
];

const PRICE_HIKE_PATTERNS = [
  /price\s*(?:increase|hike|raise|change)/i,
  /raised?\s+(?:the\s+)?price/i,
  /(?:doubled|tripled|increased)\s+(?:the\s+)?(?:price|cost|subscription)/i,
  /now\s+(?:costs?|charges?)\s+(?:more|\$\d+)/i,
  /used\s+to\s+(?:be|cost)\s+\$/i,
  /too\s+expensive/i,
  /overpriced/i,
];

export class PricingCollector implements Collector {
  id = 'pricing';
  private queryCount: number;

  constructor(queryCount?: number) {
    this.queryCount = queryCount ?? 2;
  }

  async collect(queries: string[]): Promise<RawSignal[]> {
    if (!hasProxyKey()) {
      console.warn('[PricingCollector] Skipped — set SCRAPER_API_KEY to enable');
      return [];
    }

    const signals: RawSignal[] = [];

    for (const query of queries.slice(0, this.queryCount)) {
      const evidence = await this.fetchPricingSignals(query);
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

  private async fetchPricingSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    // Only run the pricing search (skip complaints search to save proxy time)
    await this.scrapePricingSearch(query, evidence);
    return evidence;
  }

  private async scrapePricingSearch(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' software pricing')}`;
      const html = await throttledFetchText(searchUrl, { useProxy: true });

      const snippets = this.extractSnippets(html);

      for (const snippet of snippets.slice(0, 8)) {
        const prices = this.extractPrices(snippet);
        const hasPriceHike = PRICE_HIKE_PATTERNS.some(p => p.test(snippet));

        if (prices.length === 0 && !hasPriceHike) continue;

        const priceRange = prices.length > 0
          ? `Pricing found: ${prices.slice(0, 3).join(', ')}`
          : '';
        const hikeNote = hasPriceHike ? ' Price increase signals detected.' : '';

        evidence.push({
          source: 'pricing:search',
          url: searchUrl,
          excerpt: `${priceRange}${hikeNote} Context: ${snippet.slice(0, 200)}`,
          signalType: hasPriceHike ? 'competition' : 'money',
          sourceTier: 1,
          confidence: computeConfidence(snippet, 0.75, 0.9),
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[PricingCollector] Search failed:', (err as Error).message);
    }
  }

  private async scrapePricingComplaints(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' too expensive alternatives')}`;
      const html = await throttledFetchText(searchUrl, { useProxy: true });

      const snippets = this.extractSnippets(html);

      for (const snippet of snippets.slice(0, 5)) {
        const isRelevant = /expensive|overpriced|costly|cheaper|alternative|afford/i.test(snippet);
        if (!isRelevant) continue;

        evidence.push({
          source: 'pricing:complaints',
          url: searchUrl,
          excerpt: `Pricing complaint signal: ${snippet.slice(0, 250)}`,
          signalType: 'money',
          sourceTier: 2,
          confidence: computeConfidence(snippet, 0.65, 0.8),
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[PricingCollector] Complaints search failed:', (err as Error).message);
    }
  }

  private extractSnippets(html: string): string[] {
    const results: string[] = [];
    const patterns = [
      // Google search result snippets (various class names Google uses)
      /<span[^>]*class="[^"]*(?:st|snippet)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      /<div[^>]*class="[^"]*(?:VwiC3b|IsZvec|s3v9rd)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*BNeawe[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Generic longer text spans (fallback)
      /<span[^>]*>([\s\S]{50,400}?)<\/span>/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const clean = match[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (clean.length > 20) results.push(clean);
      }
    }

    return results;
  }

  private extractPrices(text: string): string[] {
    const prices: string[] = [];
    for (const pattern of PRICE_PATTERNS) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        prices.push(match[0].trim());
      }
    }
    return prices;
  }
}
