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

// Pain/demand signal prefixes — these indicate real buying intent
const DEMAND_PREFIXES = [
  'why is',
  'how to fix',
  'frustrated with',
  'problems with',
  'hate',
  'switch from',
  'cheaper alternative to',
  'free alternative to',
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

    // Pain/demand signal queries — these find real buying intent
    for (const prefix of DEMAND_PREFIXES.slice(0, 3)) {
      await this.fetchSuggestions(`${prefix} ${keyPhrase}`, evidence, seen);
    }

    // Alphabet expansion for demand depth — "topic software a", "topic software b"...
    // More autocomplete results = more real search volume = stronger demand signal
    const alphaQuery = `${keyPhrase} software`;
    let alphaHits = 0;
    for (const letter of 'abcdefghij') {
      const beforeCount = evidence.length;
      await this.fetchSuggestions(`${alphaQuery} ${letter}`, evidence, seen);
      if (evidence.length > beforeCount) alphaHits++;
    }

    // If many alphabet expansions return results, this is a high-demand space
    if (alphaHits >= 5) {
      evidence.push({
        source: 'google:autocomplete-depth',
        url: `https://www.google.com/search?q=${encodeURIComponent(alphaQuery)}`,
        excerpt: `High search depth: "${keyPhrase}" software has autocomplete results for ${alphaHits}/10 alphabet expansions, indicating strong and diverse search demand.`,
        signalType: 'demand',
        sourceTier: 2,
        confidence: 0.75,
        timestamp: Date.now(),
      });
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
