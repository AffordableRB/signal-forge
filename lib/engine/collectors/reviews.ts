import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Scrapes publicly accessible review snippets from G2, Capterra, and Trustpilot
// search results pages. Extracts visible text from HTML.

export class ReviewCollector implements Collector {
  id = 'reviews';

  async collect(queries: string[]): Promise<RawSignal[]> {
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

    // G2 search
    await this.scrapeG2(query, evidence);

    // Capterra search
    await this.scrapeCapterra(query, evidence);

    // Trustpilot search
    await this.scrapeTrustpilot(query, evidence);

    return evidence;
  }

  private async scrapeG2(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.g2.com/search?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, {
        headers: { 'Accept': 'text/html' },
      });

      // Extract product cards and review snippets from HTML
      const snippets = this.extractTextSnippets(html, [
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<span[^>]*class="[^"]*star-rating[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      ]);

      for (const snippet of snippets.slice(0, 5)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 20) continue;

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
    } catch {
      // G2 may block; non-fatal
    }
  }

  private async scrapeCapterra(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.capterra.com/search/?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, {
        headers: { 'Accept': 'text/html' },
      });

      const snippets = this.extractTextSnippets(html, [
        /<div[^>]*class="[^"]*review[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      ]);

      for (const snippet of snippets.slice(0, 5)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 20) continue;

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
    } catch {
      // Capterra may block; non-fatal
    }
  }

  private async scrapeTrustpilot(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.trustpilot.com/search?query=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, {
        headers: { 'Accept': 'text/html' },
      });

      const snippets = this.extractTextSnippets(html, [
        /<p[^>]*class="[^"]*review-content[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<a[^>]*class="[^"]*business-unit[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
      ]);

      for (const snippet of snippets.slice(0, 5)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 15) continue;

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
    } catch {
      // Trustpilot may block; non-fatal
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
