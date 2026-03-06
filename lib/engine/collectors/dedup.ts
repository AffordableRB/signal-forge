// Evidence deduplication using string similarity.

import { Evidence } from '../models/types';

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = Array.from(a).filter(x => b.has(x)).length;
  const union = new Set(Array.from(a).concat(Array.from(b))).size;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateEvidence(evidence: Evidence[]): Evidence[] {
  if (evidence.length === 0) return [];

  const result: Evidence[] = [];

  for (const e of evidence) {
    const tokens = tokenize(e.excerpt);
    let isDuplicate = false;

    for (const existing of result) {
      // Same source + similar text = duplicate
      if (e.source === existing.source) {
        const existingTokens = tokenize(existing.excerpt);
        if (jaccardSimilarity(tokens, existingTokens) > 0.6) {
          // Keep the one with higher confidence
          if ((e.confidence ?? 0) > (existing.confidence ?? 0)) {
            const idx = result.indexOf(existing);
            result[idx] = e;
          }
          isDuplicate = true;
          break;
        }
      }

      // Different source but very similar text
      const existingTokens = tokenize(existing.excerpt);
      if (jaccardSimilarity(tokens, existingTokens) > 0.8) {
        if ((e.confidence ?? 0) > (existing.confidence ?? 0)) {
          const idx = result.indexOf(existing);
          result[idx] = e;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(e);
    }
  }

  return result;
}
