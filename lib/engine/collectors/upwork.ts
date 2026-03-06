import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText, hasProxyKey } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Scrapes Upwork job search results for demand and money signals.
// Requires SCRAPER_API_KEY to bypass bot protection.

export class UpworkCollector implements Collector {
  id = 'upwork';

  async collect(queries: string[]): Promise<RawSignal[]> {
    if (!hasProxyKey()) {
      console.warn('[UpworkCollector] Skipped — set SCRAPER_API_KEY to enable');
      return [];
    }

    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchUpworkSignals(query);
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

  private async fetchUpworkSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const url = `https://www.upwork.com/search/jobs/?q=${encodeURIComponent(query)}&sort=recency`;
      const html = await throttledFetchText(url, { useProxy: true });

      // Extract job cards from Upwork's HTML
      const jobBlocks = this.extractMatches(html, [
        /<section[^>]*class="[^"]*job-tile[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
        /<div[^>]*class="[^"]*job-tile[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<article[^>]*>([\s\S]*?)<\/article>/gi,
      ]);

      // Also get individual fields
      const jobTitles = this.extractMatches(html, [
        /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
        /<a[^>]*class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
      ]);

      const descriptions = this.extractMatches(html, [
        /<span[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        /<p[^>]*data-test="[^"]*UpCLineClamp[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        /<span[^>]*data-test="[^"]*Description[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      ]);

      const budgets = this.extractMatches(html, [
        /<span[^>]*class="[^"]*budget[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        /<strong[^>]*data-test="[^"]*budget[^"]*"[^>]*>([\s\S]*?)<\/strong>/gi,
      ]);

      // Process job blocks first (most complete)
      for (const block of jobBlocks.slice(0, 10)) {
        const clean = this.stripHtml(block);
        if (clean.length < 20) continue;

        const hasBudget = /\$\d/.test(clean);

        evidence.push({
          source: 'upwork:jobs',
          url,
          excerpt: `Job: ${clean.slice(0, 280)}`,
          signalType: hasBudget ? 'money' : 'demand',
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.8, 0.9),
          timestamp: Date.now(),
        });
      }

      // If no job blocks, try individual fields
      if (evidence.length === 0) {
        const allSnippets = [...jobTitles, ...descriptions];
        const hasBudgets = budgets.some(b => /\$\d/.test(b));

        for (const snippet of allSnippets.slice(0, 8)) {
          const clean = this.stripHtml(snippet);
          if (clean.length < 10 || clean.length > 500) continue;

          evidence.push({
            source: 'upwork:jobs',
            url,
            excerpt: `Job post: ${clean.slice(0, 250)}${hasBudgets ? ' [Budget signals found]' : ''}`,
            signalType: hasBudgets ? 'money' : (classifySignal(clean) === 'pain' ? 'pain' : 'demand'),
            sourceTier: 1,
            confidence: computeConfidence(clean, 0.8, 0.9),
            timestamp: Date.now(),
          });
        }
      }

      // Emit aggregate signal if jobs found
      if (evidence.length > 0) {
        evidence.push({
          source: 'upwork:analysis',
          url,
          excerpt: `Found ${evidence.length} active job postings for "${query}" on Upwork — companies are actively hiring for this solution.`,
          signalType: 'demand',
          sourceTier: 1,
          confidence: 0.85,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[UpworkCollector] Failed:', (err as Error).message);
    }

    return evidence;
  }

  private extractMatches(html: string, patterns: RegExp[]): string[] {
    const results: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        results.push(match[1] ?? match[0]);
      }
    }
    return results;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
