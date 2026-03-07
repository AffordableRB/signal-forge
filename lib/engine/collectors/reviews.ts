import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText, hasProxyKey } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Scrapes publicly accessible review snippets from G2, Capterra, and Trustpilot.
// Requires SCRAPER_API_KEY env var to bypass bot protection.

export class ReviewCollector implements Collector {
  id = 'reviews';
  private snippetLimit: number;

  constructor(snippetLimit?: number) {
    this.snippetLimit = snippetLimit ?? 8;
  }

  async collect(queries: string[]): Promise<RawSignal[]> {
    if (!hasProxyKey()) {
      console.warn('[ReviewCollector] Skipped — set SCRAPER_API_KEY to enable');
      return [];
    }

    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchReviewSignals(query);
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

  private async fetchReviewSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    await Promise.allSettled([
      this.scrapeG2(query, evidence),
      this.scrapeCapterra(query, evidence),
      this.scrapeTrustpilot(query, evidence),
    ]);
    return evidence;
  }

  private async scrapeG2(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.g2.com/search?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, { useProxy: true });

      // G2 search results: product cards with names, descriptions, review counts
      // Try multiple patterns from most specific to least specific
      const snippets = this.extractTextSnippets(html, [
        // Product card descriptions / review text
        /<div[^>]*data-testid="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // Paragraph/span text within cards
        /<p[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<div[^>]*class="[^"]*star-wrapper[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // JSON-LD structured data (often contains review/product info)
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        // Broad: any div/p/span with meaningful text
        /<p[^>]*>([\s\S]{40,400}?)<\/p>/gi,
        /<div[^>]*class="[^"]*"[^>]*>([\s\S]{50,500}?)<\/div>/gi,
      ]);

      let added = 0;
      for (const snippet of snippets) {
        if (added >= this.snippetLimit) break;
        const clean = this.stripHtml(snippet);
        if (clean.length < 20 || clean.length > 500) continue;
        if (this.isBoilerplate(clean)) continue;

        evidence.push({
          source: 'g2:reviews',
          url,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.75, 0.9),
          timestamp: Date.now(),
        });
        added++;
      }

      // If specific patterns found nothing, try generic fallback
      if (added === 0) {
        this.genericFallback(html, url, 'g2:reviews', 0.75, 0.9, evidence);
      }
    } catch (err) {
      console.warn('[ReviewCollector] G2 failed:', (err as Error).message);
    }
  }

  private async scrapeCapterra(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.capterra.com/search/?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, { useProxy: true, render: true });

      // Capterra search results: listing cards with product names, descriptions, ratings
      const snippets = this.extractTextSnippets(html, [
        // Listing card patterns
        /<div[^>]*data-testid="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        // Card content and text
        /<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // JSON-LD structured data
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        // Broad patterns
        /<p[^>]*>([\s\S]{40,400}?)<\/p>/gi,
        /<div[^>]*class="[^"]*"[^>]*>([\s\S]{50,500}?)<\/div>/gi,
      ]);

      let added = 0;
      for (const snippet of snippets) {
        if (added >= this.snippetLimit) break;
        const clean = this.stripHtml(snippet);
        if (clean.length < 20 || clean.length > 500) continue;
        if (this.isBoilerplate(clean)) continue;

        evidence.push({
          source: 'capterra:reviews',
          url,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.75, 0.88),
          timestamp: Date.now(),
        });
        added++;
      }

      if (added === 0) {
        this.genericFallback(html, url, 'capterra:reviews', 0.75, 0.88, evidence);
      }
    } catch (err) {
      console.warn('[ReviewCollector] Capterra failed:', (err as Error).message);
    }
  }

  private async scrapeTrustpilot(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.trustpilot.com/search?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, { useProxy: true });

      // Trustpilot search results: business cards with names, review counts, categories
      const snippets = this.extractTextSnippets(html, [
        // Review text patterns
        /<p[^>]*data-service-review-text[^>]*>([\s\S]*?)<\/p>/gi,
        /<p[^>]*data-review-body[^>]*>([\s\S]*?)<\/p>/gi,
        // Business unit / search result cards
        /<a[^>]*class="[^"]*business-unit[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
        /<div[^>]*class="[^"]*styles_businessUnit[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*styles_reviewContent[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // Card/result patterns
        /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*search-result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // JSON-LD
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        // Broad
        /<p[^>]*>([\s\S]{30,400}?)<\/p>/gi,
        /<div[^>]*class="[^"]*"[^>]*>([\s\S]{50,500}?)<\/div>/gi,
      ]);

      let added = 0;
      for (const snippet of snippets) {
        if (added >= this.snippetLimit) break;
        const clean = this.stripHtml(snippet);
        if (clean.length < 15 || clean.length > 500) continue;
        if (this.isBoilerplate(clean)) continue;

        evidence.push({
          source: 'trustpilot:reviews',
          url,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.75, 0.88),
          timestamp: Date.now(),
        });
        added++;
      }

      if (added === 0) {
        this.genericFallback(html, url, 'trustpilot:reviews', 0.75, 0.88, evidence);
      }
    } catch (err) {
      console.warn('[ReviewCollector] Trustpilot failed:', (err as Error).message);
    }
  }

  /**
   * Generic fallback extractor: grabs substantial text blocks (50-500 chars)
   * from the HTML when specific patterns fail. Filters for text near
   * review-related keywords to avoid pulling in navigation/footer junk.
   */
  private genericFallback(
    html: string,
    url: string,
    source: string,
    confMin: number,
    confMax: number,
    evidence: Evidence[],
  ): void {
    // First try JSON-LD structured data — most reliable
    const jsonLdTexts = this.extractJsonLdTexts(html);
    let added = 0;

    for (const text of jsonLdTexts) {
      if (added >= this.snippetLimit) break;
      if (text.length < 30 || text.length > 500) continue;

      evidence.push({
        source,
        url,
        excerpt: text.slice(0, 300),
        signalType: classifySignal(text),
        sourceTier: 2,
        confidence: computeConfidence(text, confMin * 0.9, confMax * 0.9),
        timestamp: Date.now(),
      });
      added++;
    }

    if (added > 0) return;

    // Fallback: extract text blocks between tags that are 50-500 chars
    // and contain review/product-relevant keywords
    const blockPattern = />([^<]{50,500})</g;
    const seen = new Set<string>();
    let match;

    while ((match = blockPattern.exec(html)) !== null && added < this.snippetLimit) {
      const raw = this.stripHtml(match[1]).trim();
      if (raw.length < 40 || raw.length > 500) continue;
      if (this.isBoilerplate(raw)) continue;

      // Deduplicate
      const key = raw.slice(0, 60).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Must contain at least one relevant keyword
      if (!this.hasRelevantKeyword(raw)) continue;

      evidence.push({
        source,
        url,
        excerpt: raw.slice(0, 300),
        signalType: classifySignal(raw),
        sourceTier: 2,
        confidence: computeConfidence(raw, confMin * 0.85, confMax * 0.85),
        timestamp: Date.now(),
      });
      added++;
    }
  }

  /**
   * Extract useful text from JSON-LD structured data blocks.
   */
  private extractJsonLdTexts(html: string): string[] {
    const results: string[] = [];
    const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        this.extractJsonStrings(data, results);
      } catch {
        // Invalid JSON-LD, skip
      }
    }

    return results;
  }

  private extractJsonStrings(obj: unknown, results: string[]): void {
    if (typeof obj === 'string' && obj.length >= 30 && obj.length <= 500) {
      // Only keep strings that look like descriptions/reviews
      if (/[a-zA-Z]{3,}/.test(obj) && !obj.startsWith('http')) {
        results.push(obj);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) this.extractJsonStrings(item, results);
    } else if (obj && typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      // Prioritize description, reviewBody, name fields
      for (const key of ['description', 'reviewBody', 'name', 'text', 'headline']) {
        if (key in record) this.extractJsonStrings(record[key], results);
      }
      for (const [key, val] of Object.entries(record)) {
        if (!['description', 'reviewBody', 'name', 'text', 'headline'].includes(key)) {
          this.extractJsonStrings(val, results);
        }
      }
    }
  }

  private hasRelevantKeyword(text: string): boolean {
    const lower = text.toLowerCase();
    const keywords = [
      'review', 'rating', 'star', 'recommend', 'software', 'tool', 'platform',
      'product', 'solution', 'feature', 'pricing', 'price', 'plan', 'customer',
      'user', 'business', 'management', 'service', 'support', 'integration',
      'easy', 'difficult', 'expensive', 'affordable', 'best', 'worst',
      'alternative', 'comparison', 'pros', 'cons', 'trial', 'free',
      'gym', 'fitness', 'crm', 'scheduling', 'booking', 'membership',
    ];
    return keywords.some(kw => lower.includes(kw));
  }

  private isBoilerplate(text: string): boolean {
    const lower = text.toLowerCase();
    // Filter out nav, footer, cookie, legal boilerplate
    const boilerplatePatterns = [
      'cookie', 'privacy policy', 'terms of service', 'terms of use',
      'sign up', 'sign in', 'log in', 'create account', 'subscribe',
      'copyright', 'all rights reserved', 'javascript',
      'enable javascript', 'browser', 'loading',
      'accept all', 'manage cookies', 'gdpr',
    ];
    const matchCount = boilerplatePatterns.filter(p => lower.includes(p)).length;
    // If multiple boilerplate signals, skip it
    if (matchCount >= 2) return true;
    // If mostly short words or looks like nav (lots of | or > separators)
    if ((text.match(/[|>]/g) ?? []).length > 3) return true;
    // If it's just a list of links
    if ((text.match(/https?:\/\//g) ?? []).length > 2) return true;
    return false;
  }

  private extractTextSnippets(html: string, patterns: RegExp[]): string[] {
    const results: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) results.push(match[1]);
      }
    }
    return results;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
