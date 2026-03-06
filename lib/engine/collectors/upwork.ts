import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Scrapes Upwork job search results for demand and money signals.
// Companies hiring for solutions = validated demand.

const JOB_PREFIXES = [
  'build software for',
  'automation for',
  'SaaS tool needed',
  'develop app for',
  'need developer for',
];

export class UpworkCollector implements Collector {
  id = 'upwork';

  async collect(queries: string[]): Promise<RawSignal[]> {
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

    // Search Upwork directly
    await this.searchUpwork(query, evidence);

    // Try with job-related prefixes for broader reach
    const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 2).join(' ');
    for (const prefix of JOB_PREFIXES.slice(0, 2)) {
      await this.searchUpwork(`${prefix} ${keywords}`, evidence);
    }

    return evidence;
  }

  private async searchUpwork(query: string, evidence: Evidence[]): Promise<void> {
    try {
      const url = `https://www.upwork.com/search/jobs/?q=${encodeURIComponent(query)}&sort=recency`;
      const html = await throttledFetchText(url, {
        headers: { 'Accept': 'text/html' },
      });

      // Extract job titles and descriptions from HTML
      const jobTitles = this.extractMatches(html, [
        /<h2[^>]*class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi,
        /<a[^>]*class="[^"]*job-title-link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
      ]);

      const jobDescriptions = this.extractMatches(html, [
        /<span[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        /<p[^>]*data-test="[^"]*Description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      ]);

      // Extract budget/pricing info
      const budgets = this.extractMatches(html, [
        /<span[^>]*class="[^"]*budget[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        /\$[\d,]+(?:\s*-\s*\$[\d,]+)?/g,
      ]);

      const allSnippets = [...jobTitles, ...jobDescriptions];

      for (const snippet of allSnippets.slice(0, 8)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 10) continue;

        const hasBudget = budgets.some(b => b.includes('$'));
        const signalType = classifySignal(clean);

        evidence.push({
          source: 'upwork:jobs',
          url: `https://www.upwork.com/search/jobs/?q=${encodeURIComponent(query)}`,
          excerpt: `Job post: ${clean.slice(0, 250)}${hasBudget ? ` [Budget signals found]` : ''}`,
          signalType: hasBudget ? 'money' : (signalType === 'pain' ? 'pain' : 'demand'),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.8, 0.9),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Upwork may block or require auth; non-fatal
    }
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
