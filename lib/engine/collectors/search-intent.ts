import { Collector } from './base';
import { RawSignal, Evidence } from '../models/types';
import { throttledFetchText } from './rate-limiter';
import { classifySignal, computeConfidence } from './classify';

const INTENT_PREFIXES = [
  'software for',
  'tool for',
  'app for',
  'automation for',
  'best',
  'how to automate',
  'alternative to',
];

export class SearchIntentCollector implements Collector {
  id = 'search-intent';

  async collect(queries: string[]): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const query of queries) {
      const evidence = await this.fetchAutocomplete(query);
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

  private async fetchAutocomplete(query: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const seen = new Set<string>();

    // Direct query autocomplete
    await this.fetchSuggestions(query, evidence, seen);

    // Prefix-modified queries for broader signal capture
    const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
    const keyPhrase = keywords.join(' ');

    for (const prefix of INTENT_PREFIXES.slice(0, 4)) {
      await this.fetchSuggestions(`${prefix} ${keyPhrase}`, evidence, seen);
    }

    return evidence;
  }

  private async fetchSuggestions(
    query: string,
    evidence: Evidence[],
    seen: Set<string>,
  ): Promise<void> {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      const text = await throttledFetchText(url);

      // Response format: ["query", ["suggestion1", "suggestion2", ...]]
      const parsed = JSON.parse(text) as [string, string[]];
      const suggestions = parsed[1] ?? [];

      for (const suggestion of suggestions) {
        const normalized = suggestion.toLowerCase().trim();
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const signalType = classifySignal(suggestion);
        evidence.push({
          source: 'google:autocomplete',
          url: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`,
          excerpt: `Search suggestion: "${suggestion}"`,
          signalType,
          sourceTier: 3,
          confidence: computeConfidence(suggestion, 0.4, 0.55),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Autocomplete failures are non-fatal
    }
  }
}
