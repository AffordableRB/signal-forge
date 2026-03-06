import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { computeConfidence } from './classify';

// Scrapes competitor pricing pages via Google search results.
// Looks for pricing patterns, price increases, and enterprise lock-in signals.

const PRICE_PATTERNS = [
  /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/?\s*(?:mo(?:nth)?|yr|year|user|seat))/gi,
  /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per\s+(?:month|year|user|seat))/gi,
  /starting\s+(?:at|from)\s+\$(\d+)/gi,
  /plans?\s+(?:start|begin)\s+at\s+\$(\d+)/gi,
  /free\s+(?:plan|tier|trial)/gi,
  /enterprise\s+(?:plan|pricing|contact)/gi,
];

const PRICE_HIKE_PATTERNS = [
  /price\s*(?:increase|hike|raise|change)/gi,
  /raised?\s+(?:the\s+)?price/gi,
  /(?:doubled|tripled|increased)\s+(?:the\s+)?(?:price|cost|subscription)/gi,
  /now\s+(?:costs?|charges?)\s+(?:more|\$\d+)/gi,
  /used\s+to\s+(?:be|cost)\s+\$/gi,
];

export class PricingCollector implements Collector {
  id = 'pricing';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
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

    // Search for pricing pages
    await this.scrapePricingSearch(query, evidence);

    // Search for pricing complaints/changes
    await this.scrapePricingComplaints(query, evidence);

    return evidence;
  }

  private async scrapePricingSearch(query: string, evidence: Evidence[]): Promise<void> {
    try {
      // Use Google search to find pricing pages
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' pricing')}`;
      const html = await throttledFetchText(searchUrl, {
        headers: { 'Accept': 'text/html' },
      });

      // Extract pricing-related snippets
      const snippets = this.extractSnippets(html);

      for (const snippet of snippets.slice(0, 8)) {
        const prices = this.extractPrices(snippet);
        const hasPriceHike = PRICE_HIKE_PATTERNS.some(p => p.test(snippet));

        // Reset regex lastIndex
        PRICE_HIKE_PATTERNS.forEach(p => p.lastIndex = 0);

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
    } catch {
      // Search may block; non-fatal
    }
  }

  private async scrapePricingComplaints(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' too expensive alternatives')}`;
      const html = await throttledFetchText(searchUrl, {
        headers: { 'Accept': 'text/html' },
      });

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
    } catch {
      // Non-fatal
    }
  }

  private extractSnippets(html: string): string[] {
    const results: string[] = [];
    const patterns = [
      /<span[^>]*class="[^"]*(?:st|snippet|description)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      /<div[^>]*class="[^"]*(?:VwiC3b|IsZvec|s3v9rd)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
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
