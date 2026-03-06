import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Product Hunt collector using their RSS feed and public pages.
// Identifies competition signals (crowded categories) and demand (new launches).

export class ProductHuntCollector implements Collector {
  id = 'product-hunt';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchPHSignals(query);
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

  private async fetchPHSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Search Product Hunt
    try {
      const url = `https://www.producthunt.com/search?q=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, {
        headers: { 'Accept': 'text/html' },
      });

      // Extract product names and taglines
      const products = this.extractMatches(html, [
        /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
        /<div[^>]*class="[^"]*tagline[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<p[^>]*class="[^"]*text-secondary[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      ]);

      let productCount = 0;
      for (const snippet of products.slice(0, 10)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 10 || clean.length > 500) continue;

        productCount++;
        const signalType = classifySignal(clean);

        evidence.push({
          source: 'producthunt:search',
          url,
          excerpt: `PH product: ${clean.slice(0, 250)}`,
          signalType: signalType === 'demand' ? 'demand' : 'competition',
          sourceTier: 2,
          confidence: computeConfidence(clean, 0.6, 0.75),
          timestamp: Date.now(),
        });
      }

      // If many products found, emit a competition saturation signal
      if (productCount >= 5) {
        evidence.push({
          source: 'producthunt:analysis',
          url,
          excerpt: `Found ${productCount}+ products on Product Hunt for "${query}" — category is active with competition.`,
          signalType: 'competition',
          sourceTier: 2,
          confidence: 0.7,
          timestamp: Date.now(),
        });
      }
    } catch {
      // PH may block; non-fatal
    }

    // Try RSS feed for recent launches
    try {
      const rssUrl = 'https://www.producthunt.com/feed';
      const xml = await throttledFetchText(rssUrl, {
        headers: { 'Accept': 'application/rss+xml, text/xml, application/xml' },
      });

      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const items = xml.split(/<item>/i).slice(1);

      for (const item of items.slice(0, 30)) {
        const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const descMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
        const linkMatch = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        const dateMatch = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

        const title = this.stripHtml(titleMatch?.[1] ?? '');
        const desc = this.stripHtml(descMatch?.[1] ?? '');
        const combined = `${title} ${desc}`.toLowerCase();

        // Check if this launch is relevant to our query
        const relevant = keywords.some(kw => combined.includes(kw));
        if (!relevant) continue;

        const link = linkMatch?.[1]?.trim() ?? '';
        const pubDate = dateMatch?.[1]?.trim();

        evidence.push({
          source: 'producthunt:launch',
          url: link,
          excerpt: `Recent launch: ${title}. ${desc}`.slice(0, 300),
          signalType: 'competition',
          sourceTier: 2,
          confidence: 0.65,
          timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
        });
      }
    } catch {
      // RSS feed may not be available; non-fatal
    }

    return evidence;
  }

  private extractMatches(html: string, patterns: RegExp[]): string[] {
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
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
  }
}
