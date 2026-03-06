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

      const snippets = this.extractTextSnippets(html, [
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<span[^>]*>([\s\S]{30,300}?)<\/span>/gi,
      ]);

      for (const snippet of snippets.slice(0, this.snippetLimit)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 20 || clean.length > 500) continue;

        evidence.push({
          source: 'g2:reviews',
          url,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.75, 0.9),
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[ReviewCollector] G2 failed:', (err as Error).message);
    }
  }

  private async scrapeCapterra(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.capterra.com/search/?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, { useProxy: true, render: true });

      const snippets = this.extractTextSnippets(html, [
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<div[^>]*class="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<span[^>]*>([\s\S]{30,300}?)<\/span>/gi,
      ]);

      for (const snippet of snippets.slice(0, this.snippetLimit)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 20 || clean.length > 500) continue;

        evidence.push({
          source: 'capterra:reviews',
          url,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.75, 0.88),
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[ReviewCollector] Capterra failed:', (err as Error).message);
    }
  }

  private async scrapeTrustpilot(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.trustpilot.com/search?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, { useProxy: true });

      const snippets = this.extractTextSnippets(html, [
        /<p[^>]*class="[^"]*review-content[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<a[^>]*class="[^"]*business-unit[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
        /<div[^>]*class="[^"]*styles_reviewContent[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*data-service-review-text[^>]*>([\s\S]*?)<\/p>/gi,
      ]);

      for (const snippet of snippets.slice(0, this.snippetLimit)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 15 || clean.length > 500) continue;

        evidence.push({
          source: 'trustpilot:reviews',
          url,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.75, 0.88),
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[ReviewCollector] Trustpilot failed:', (err as Error).message);
    }
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
