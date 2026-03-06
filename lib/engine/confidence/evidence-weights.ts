export const SOURCE_WEIGHTS: Record<string, number> = {
  pricing: 1.0,
  reviews: 0.9,
  jobs: 0.8,
  directories: 0.7,
  reddit: 0.6,
  'google-trends': 0.4,
  'search-intent': 0.25,
  'product-hunt': 0.2,
};

// Map collector IDs to source weight keys
export function getSourceWeight(source: string): number {
  // source string is like "Reddit: r/startup", "G2: product", "Indeed: job posting", etc.
  const lower = source.toLowerCase();
  if (lower.includes('pricing') || lower.includes('price') || lower.includes('$')) return SOURCE_WEIGHTS.pricing;
  if (lower.includes('g2') || lower.includes('capterra') || lower.includes('trustpilot') || lower.includes('review')) return SOURCE_WEIGHTS.reviews;
  if (lower.includes('indeed') || lower.includes('job') || lower.includes('upwork')) return SOURCE_WEIGHTS.jobs;
  if (lower.includes('directory') || lower.includes('crunchbase')) return SOURCE_WEIGHTS.directories;
  if (lower.includes('reddit')) return SOURCE_WEIGHTS.reddit;
  if (lower.includes('trend')) return SOURCE_WEIGHTS['google-trends'];
  if (lower.includes('autocomplete') || lower.includes('suggest') || lower.includes('search-intent') || lower.includes('google complete')) return SOURCE_WEIGHTS['search-intent'];
  if (lower.includes('product hunt') || lower.includes('producthunt')) return SOURCE_WEIGHTS['product-hunt'];
  return 0.5; // default
}

// Compute source credibility for a single piece of evidence (0-1)
export function computeSourceCredibility(evidence: { source: string; excerpt: string; confidence?: number; sourceTier?: 1 | 2 | 3 }): number {
  let credibility = 0.5;

  if (evidence.sourceTier === 1) credibility += 0.2;
  else if (evidence.sourceTier === 2) credibility += 0.1;

  const sourceW = getSourceWeight(evidence.source);
  credibility += (sourceW - 0.5) * 0.2;

  const excerptLen = evidence.excerpt.length;
  if (excerptLen > 200) credibility += 0.1;
  else if (excerptLen > 100) credibility += 0.05;
  else if (excerptLen < 30) credibility -= 0.1;

  if (/\$[\d,]+|\d+%|\d+\s*(users|customers|employees|companies|hours|minutes)/i.test(evidence.excerpt)) {
    credibility += 0.1;
  }

  if (/\b(I|we|our|my)\b.{0,30}\b(use|used|tried|switched|built|spent|pay|paid|manage|run)\b/i.test(evidence.excerpt)) {
    credibility += 0.05;
  }

  if (evidence.confidence !== undefined) {
    credibility += (evidence.confidence - 0.5) * 0.1;
  }

  return Math.max(0, Math.min(1, credibility));
}

// Compute weighted evidence quality score (0-100)
export function computeEvidenceQualityScore(evidence: Array<{ source: string; excerpt: string; confidence?: number; sourceTier?: 1|2|3 }>): number {
  if (evidence.length === 0) return 0;

  let totalWeight = 0;
  for (const e of evidence) {
    const sourceW = getSourceWeight(e.source);
    const tierW = e.sourceTier === 1 ? 1.0 : e.sourceTier === 2 ? 0.7 : 0.4;
    const confW = e.confidence ?? 0.5;
    const credW = computeSourceCredibility(e);
    totalWeight += sourceW * tierW * confW * (0.7 + 0.3 * credW);
  }

  const avgWeight = totalWeight / evidence.length;
  // Scale: avg weight of ~0.5 = 50, max ~1.0 = 100
  const raw = avgWeight * 100;

  // Volume bonus: more evidence = more reliable (up to +15)
  const volumeBonus = Math.min(15, evidence.length * 1.5);

  // Diversity bonus: more source types = more reliable (up to +10)
  const sourceTypes = new Set(evidence.map(e => {
    const l = e.source.toLowerCase();
    if (l.includes('reddit')) return 'reddit';
    if (l.includes('g2') || l.includes('capterra') || l.includes('trustpilot')) return 'reviews';
    if (l.includes('indeed') || l.includes('job')) return 'jobs';
    if (l.includes('product hunt')) return 'ph';
    if (l.includes('trend')) return 'trends';
    if (l.includes('pricing')) return 'pricing';
    return 'other';
  }));
  const diversityBonus = Math.min(10, (sourceTypes.size - 1) * 3);

  return Math.min(100, Math.round(raw + volumeBonus + diversityBonus));
}
