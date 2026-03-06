// Evidence deduplication using URL matching and string similarity.

import { Evidence } from '../models/types';

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2)
  );
}

function trigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const result = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    result.add(normalized.slice(i, i + 3));
  }
  return result;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = Array.from(a).filter(x => b.has(x)).length;
  const union = new Set(Array.from(a).concat(Array.from(b))).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '');
}

export function deduplicateEvidence(evidence: Evidence[]): Evidence[] {
  if (evidence.length === 0) return [];

  const result: Evidence[] = [];
  const seenUrls = new Map<string, number>();

  for (const e of evidence) {
    // URL-based dedup: same URL is always a duplicate
    if (e.url) {
      const nUrl = normalizeUrl(e.url);
      const existingIdx = seenUrls.get(nUrl);
      if (existingIdx !== undefined) {
        if ((e.confidence ?? 0) > (result[existingIdx].confidence ?? 0)) {
          result[existingIdx] = e;
        }
        continue;
      }
    }

    const tokens = tokenize(e.excerpt);
    const tri = trigrams(e.excerpt);
    let isDuplicate = false;

    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      const existingTokens = tokenize(existing.excerpt);

      // Same source + similar text = duplicate
      if (e.source === existing.source) {
        if (jaccardSimilarity(tokens, existingTokens) > 0.6) {
          if ((e.confidence ?? 0) > (existing.confidence ?? 0)) {
            result[i] = e;
          }
          isDuplicate = true;
          break;
        }
      }

      // Cross-source: combined word + trigram similarity
      const wordSim = jaccardSimilarity(tokens, existingTokens);
      const triSim = jaccardSimilarity(tri, trigrams(existing.excerpt));
      const combinedSim = wordSim * 0.6 + triSim * 0.4;

      if (combinedSim > 0.65) {
        if ((e.confidence ?? 0) > (existing.confidence ?? 0)) {
          result[i] = e;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      if (e.url) {
        seenUrls.set(normalizeUrl(e.url), result.length);
      }
      result.push(e);
    }
  }

  return result;
}
