import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchJson } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

// StackExchange API — free, no auth required, 300 requests/day without key.
// Questions = pain/demand signals. High-vote questions = validated problems.
// Covers many verticals via different sites (fitness, money, cooking, etc.)

// Map topic keywords to relevant StackExchange sites
const TOPIC_SITES: Record<string, string[]> = {
  fitness: ['fitness', 'health'],
  health: ['health', 'medicalsciences', 'bioinformatics'],
  cooking: ['cooking'],
  food: ['cooking'],
  restaurant: ['cooking'],
  finance: ['money', 'quant', 'economics'],
  money: ['money', 'personalfinance'],
  legal: ['law', 'opensource'],
  education: ['academia', 'matheducators'],
  photography: ['photo'],
  diy: ['diy', 'home'],
  construction: ['diy', 'home', 'engineering'],
  automotive: ['mechanics'],
  pet: ['pets'],
  garden: ['gardening'],
};

interface SEQuestion {
  title: string;
  link: string;
  score: number;
  answer_count: number;
  view_count: number;
  creation_date: number;
  tags: string[];
  body_markdown?: string;
}

interface SEResponse {
  items: SEQuestion[];
  has_more: boolean;
  quota_remaining: number;
}

export class StackExchangeCollector implements Collector {
  id = 'stackexchange';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seen = new Set<string>();

    // Determine which SE sites to search based on query content
    const sites = this.getSitesForQueries(queries);

    // Search across relevant sites + Stack Overflow (always included for tech topics)
    const maxQueries = Math.min(queries.length, 3);

    for (const query of queries.slice(0, maxQueries)) {
      const evidence = await this.fetchSESignals(query, sites, seen);
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

  private getSitesForQueries(queries: string[]): string[] {
    const combined = queries.join(' ').toLowerCase();
    const sites = new Set<string>(['stackoverflow']); // always include SO

    for (const [topic, seSites] of Object.entries(TOPIC_SITES)) {
      if (combined.includes(topic)) {
        for (const s of seSites) sites.add(s);
      }
    }

    return Array.from(sites);
  }

  private async fetchSESignals(query: string, sites: string[], seen: Set<string>): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // StackExchange API only accepts one site per request
    for (const site of sites.slice(0, 3)) {
      try {
        const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=${site}&pagesize=10&filter=default`;
        const data = await throttledFetchJson<SEResponse>(url);

        for (const q of data.items) {
          if (seen.has(q.link)) continue;
          seen.add(q.link);

          const text = `${q.title} ${(q.body_markdown ?? '').slice(0, 300)}`;
          if (text.trim().length < 20) continue;

          let confMin = 0.5;
          let confMax = 0.7;
          if (q.score > 10) { confMin = 0.6; confMax = 0.8; }
          if (q.view_count > 1000) { confMin += 0.05; confMax = Math.min(0.85, confMax + 0.05); }

          evidence.push({
            source: `stackexchange:${site}`,
            url: q.link,
            excerpt: `${q.title} (${q.score} votes, ${q.view_count} views, ${q.answer_count} answers)`,
            signalType: classifySignal(text),
            sourceTier: 2,
            confidence: computeConfidence(text, confMin, confMax),
            timestamp: q.creation_date * 1000,
          });
        }
      } catch (err) {
        console.warn(`[StackExchange] ${site} search failed for "${query}":`, (err as Error).message);
      }
    }

    return evidence;
  }
}
