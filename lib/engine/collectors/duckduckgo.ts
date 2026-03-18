// DuckDuckGo search collector.
// DDG doesn't block cloud IPs nearly as aggressively as Google.
// Uses the HTML search results page (no API key needed).
// Provides competition signals, demand signals, and pricing data.

import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

export class DuckDuckGoCollector implements Collector {
  id = 'duckduckgo';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seen = new Set<string>();

    // Generate search-optimized queries from the raw queries
    const searchQueries = this.buildSearchQueries(queries);

    for (const query of searchQueries.slice(0, 6)) {
      const evidence = await this.search(query, seen);
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

  private buildSearchQueries(queries: string[]): string[] {
    const result: string[] = [];
    // Take the most relevant keywords from each query
    for (const q of queries) {
      // Strip common noise from query generator output
      const cleaned = q
        .replace(/site:\S+/gi, '')
        .replace(/"[^"]*"/g, (m) => m.replace(/"/g, ''))
        .replace(/\bOR\b/gi, '')
        .trim();
      if (cleaned.length > 5) result.push(cleaned);
    }
    return result;
  }

  private async search(query: string, seen: Set<string>): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // DDG HTML search
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const html = await throttledFetchText(url, {
        headers: {
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      // Extract results from DDG HTML format
      // DDG HTML results have class="result__body"
      const resultBlocks = html.split(/class="result__body"/i).slice(1, 11);

      for (const block of resultBlocks) {
        // Extract title
        const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
        // Extract snippet
        const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:td|div|span)/i);
        // Extract URL
        const urlMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\//i);

        const title = this.stripHtml(titleMatch?.[1] ?? '').trim();
        const snippet = this.stripHtml(snippetMatch?.[1] ?? '').trim();
        const resultUrl = this.stripHtml(urlMatch?.[1] ?? '').trim();

        if (!title || title.length < 5) continue;
        if (seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());

        const combined = `${title} ${snippet}`;
        const signalType = classifySignal(combined);

        // Determine source tier based on URL
        let sourceTier: 1 | 2 | 3 = 3;
        if (/g2\.com|capterra\.com|trustpilot\.com/i.test(resultUrl)) sourceTier = 2;
        if (/reddit\.com|quora\.com|stackoverflow\.com/i.test(resultUrl)) sourceTier = 2;
        if (/forbes\.com|techcrunch\.com|bloomberg\.com/i.test(resultUrl)) sourceTier = 1;

        evidence.push({
          source: `duckduckgo:search`,
          url: resultUrl ? `https://${resultUrl.replace(/^https?:\/\//, '')}` : '',
          excerpt: `${title}. ${snippet}`.slice(0, 350),
          signalType,
          sourceTier,
          confidence: computeConfidence(combined, 0.45, 0.7),
          timestamp: Date.now(),
        });
      }

      // If we found very few results, the search might have been too specific
      if (evidence.length === 0) {
        // Try a simpler version of the query
        const simpleKeywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(' ');
        if (simpleKeywords !== query && simpleKeywords.length > 5) {
          return this.search(simpleKeywords, seen);
        }
      }
    } catch (err) {
      console.warn('[DuckDuckGo] Search failed:', (err as Error).message);
    }

    return evidence;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<b>/gi, '').replace(/<\/b>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ').trim();
  }
}
