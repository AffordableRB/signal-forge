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

    // Try mobile Indeed first (simpler HTML), then fall back to desktop
    const encodedQuery = encodeURIComponent(query);
    const urls = [
      `https://m.indeed.com/jobs?q=${encodedQuery}&sort=date`,
      `https://www.indeed.com/jobs?q=${encodedQuery}&sort=date`,
    ];

    for (const url of urls) {
      if (evidence.length > 0) break;
      try {
        const html = await throttledFetchText(url, { useProxy: true });

        const allSnippets = this.extractJobSnippets(html);

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
        console.warn(`[JobsCollector] Indeed failed (${url}):`, (err as Error).message);
      }
    }

    return evidence;
  }

  private extractJobSnippets(html: string): string[] {
    // Layer 1: Elements with data-jk attribute (Indeed job key — stable across redesigns)
    const layer1 = this.extractMatches(html, [
      /<[^>]+data-jk="[^"]*"[^>]*>([\s\S]*?)<\/(?:div|a|td|article)>/gi,
    ]);
    if (layer1.length > 0) return layer1;

    // Layer 2: Broad class-based patterns (current and historical Indeed classes)
    const layer2 = this.extractMatches(html, [
      /<div[^>]*class="[^"]*(?:cardOutline|jobCard|job-cardstyle|resultContent|job_seen_beacon|tapItem)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<h2[^>]*class="[^"]*(?:jobTitle|job-title)[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi,
      /<td[^>]*class="[^"]*resultContent[^"]*"[^>]*>([\s\S]*?)<\/td>/gi,
      /<div[^>]*class="[^"]*(?:job-snippet|jobsnippet|underShelfFooter)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<span[^>]*class="[^"]*(?:salary|salaryText|metadata)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    ]);
    if (layer2.length > 0) return layer2;

    // Layer 3: data-testid based selectors (React-rendered Indeed)
    const layer3 = this.extractMatches(html, [
      /<[^>]+data-testid="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/(?:div|a|li|article)>/gi,
    ]);
    if (layer3.length > 0) return layer3;

    // Layer 4: Fallback — <a> tags linking to job detail pages
    const linkFallback = this.extractMatches(html, [
      /<a[^>]*href="[^"]*(?:\/viewjob|\/rc\/clk|\/pagead\/clk|clk\?jk=)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
      /<a[^>]*href="[^"]*\/job\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    ]);
    if (linkFallback.length > 0) return linkFallback;

    // Layer 5: Last resort — extract <h2> tags (job titles are always in h2 on Indeed)
    // plus nearby text blocks containing job-related keywords
    const h2Tags = this.extractMatches(html, [
      /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    ]);
    const jobKeywordBlocks = this.extractTextBlocks(html);

    return [...h2Tags, ...jobKeywordBlocks];
  }

  private extractTextBlocks(html: string): string[] {
    // Extract text segments between tags that look like job content
    const results: string[] = [];
    const blockPattern = />([^<]{30,500})</g;
    let match;
    while ((match = blockPattern.exec(html)) !== null) {
      const text = match[1].trim();
      if (/\b(hiring|salary|position|apply|job|experience|qualifications|requirements|full.?time|part.?time|remote|hybrid)\b/i.test(text)) {
        results.push(text);
      }
    }
    return results;
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
