import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchJson } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

interface HNHit {
  title: string;
  url: string | null;
  story_text: string | null;
  comment_text: string | null;
  objectID: string;
  created_at_i: number;
  points: number | null;
  num_comments: number | null;
  author: string;
}

interface HNSearchResult {
  hits: HNHit[];
  nbHits: number;
}

export class HackerNewsCollector implements Collector {
  id = 'hackernews';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchHNSignals(query);
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

  private async fetchHNSignals(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Search stories
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`;
      const data = await throttledFetchJson<HNSearchResult>(url);

      for (const hit of data.hits) {
        const text = hit.title + (hit.story_text ? ` ${hit.story_text}` : '');
        if (text.trim().length < 15) continue;

        const signalType = classifySignal(text);
        const points = hit.points ?? 0;
        let confMin = 0.6;
        let confMax = 0.8;
        if (points > 50) { confMin = 0.7; confMax = 0.85; }

        evidence.push({
          source: 'hackernews:story',
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          excerpt: text.slice(0, 300),
          signalType,
          sourceTier: 2,
          confidence: computeConfidence(text, confMin, confMax),
          timestamp: hit.created_at_i * 1000,
        });
      }
    } catch (err) {
      console.warn(`[HackerNewsCollector] Story search failed for "${query}":`, (err as Error).message);
    }

    // Search comments for deeper pain/demand signals
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=15`;
      const data = await throttledFetchJson<HNSearchResult>(url);

      for (const hit of data.hits) {
        const text = hit.comment_text ?? '';
        if (text.trim().length < 30) continue;

        // Strip HTML tags
        const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        evidence.push({
          source: 'hackernews:comment',
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          excerpt: clean.slice(0, 300),
          signalType: classifySignal(clean),
          sourceTier: 2,
          confidence: computeConfidence(clean, 0.6, 0.75),
          timestamp: hit.created_at_i * 1000,
        });
      }
    } catch (err) {
      console.warn(`[HackerNewsCollector] Comment search failed for "${query}":`, (err as Error).message);
    }

    return evidence;
  }
}
