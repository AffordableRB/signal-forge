// Topic relevance filter.
// Removes evidence that is clearly irrelevant to the scan topic.
// Applied after collection to prevent garbage from polluting analysis.

import { RawSignal } from '../models/types';

// Extract meaningful keywords from a topic (ignore common filler words)
const FILLER = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'in', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'that', 'this',
  'these', 'those', 'it', 'its', 'my', 'your', 'our', 'their',
  'software', 'tool', 'app', 'platform', 'solution', 'best', 'top',
  'problems', 'reddit', 'complaints', 'reviews', 'alternatives',
  'pricing', 'competitors', 'challenges', 'difficulties',
]);

function extractTopicKeywords(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !FILLER.has(w));
}

// Check if evidence text is relevant to the topic
function isRelevant(text: string, topicKeywords: string[], threshold: number): boolean {
  const textLower = text.toLowerCase();
  let hits = 0;
  for (const kw of topicKeywords) {
    if (textLower.includes(kw)) hits++;
  }
  // At least N keywords must appear (or all if fewer than threshold)
  return hits >= Math.min(threshold, topicKeywords.length);
}

export function filterSignalsByTopic(signals: RawSignal[], topic: string): RawSignal[] {
  if (!topic || topic.trim().length === 0) return signals;

  const keywords = extractTopicKeywords(topic);
  if (keywords.length === 0) return signals;

  // Require at least 1 keyword match in evidence for topic relevance
  const threshold = 1;

  const filtered: RawSignal[] = [];

  for (const signal of signals) {
    const relevantEvidence = signal.evidence.filter(e =>
      isRelevant(e.excerpt, keywords, threshold)
    );

    if (relevantEvidence.length > 0) {
      filtered.push({
        ...signal,
        evidence: relevantEvidence,
      });
    }
  }

  const removed = signals.reduce((n, s) => n + s.evidence.length, 0) -
    filtered.reduce((n, s) => n + s.evidence.length, 0);
  if (removed > 0) {
    console.log(`[RelevanceFilter] Removed ${removed} irrelevant evidence pieces for topic "${topic}"`);
  }

  return filtered;
}
