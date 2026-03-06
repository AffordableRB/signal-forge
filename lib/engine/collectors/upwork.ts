import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText, hasProxyKey } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// Job board collector — searches Indeed for demand/money signals.
// Companies actively hiring for solutions = validated demand.
// Requires SCRAPER_API_KEY for proxy access.

export class UpworkCollector implements Collector {
  id = 'jobs';
  private jobLimit: number;

  constructor(jobLimit?: number) {
    this.jobLimit = jobLimit ?? 10;
  }

  async collect(queries: string[]): Promise<RawSignal[]> {
    if (!hasProxyKey()) {
      console.warn('[JobsCollector] Skipped — set SCRAPER_API_KEY to enable');
      return [];
    }

    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchJobSignals(query);
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

  private async fetchJobSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Search Indeed for job postings related to the query
    try {
      const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&sort=date`;
      const html = await throttledFetchText(url, { useProxy: true });

      // Extract job cards
      const jobCards = this.extractMatches(html, [
        /<td[^>]*class="[^"]*resultContent[^"]*"[^>]*>([\s\S]*?)<\/td>/gi,
        /<div[^>]*class="[^"]*job_seen_beacon[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi,
      ]);

      const snippets = this.extractMatches(html, [
        /<div[^>]*class="[^"]*job-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<span[^>]*class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      ]);

      const allSnippets = [...jobCards, ...snippets];

      for (const snippet of allSnippets.slice(0, this.jobLimit)) {
        const clean = this.stripHtml(snippet);
        if (clean.length < 15 || clean.length > 600) continue;

        const hasSalary = /\$[\d,]+/.test(clean);
        const signalType = classifySignal(clean);

        evidence.push({
          source: 'indeed:jobs',
          url,
          excerpt: `Job: ${clean.slice(0, 280)}`,
          signalType: hasSalary ? 'money' : (signalType === 'pain' ? 'pain' : 'demand'),
          sourceTier: 1,
          confidence: computeConfidence(clean, 0.8, 0.9),
          timestamp: Date.now(),
        });
      }

      if (evidence.length > 0) {
        evidence.push({
          source: 'indeed:analysis',
          url,
          excerpt: `Found ${evidence.length} active job postings for "${query}" — companies are hiring for this, validating market demand.`,
          signalType: 'demand',
          sourceTier: 1,
          confidence: 0.85,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[JobsCollector] Indeed failed:', (err as Error).message);
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
