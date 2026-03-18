// Volume estimator — infers relative search demand from evidence already collected.
// This is a utility function (not a collector). It analyzes evidence from other
// collectors to produce a demand volume estimate without making any API calls.

import { Evidence } from '../models/types';

export interface VolumeEstimate {
  relativeVolume: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  score: number; // 0-100
  signals: string[]; // explanations of what contributed
}

export function estimateSearchVolume(evidence: Evidence[]): VolumeEstimate {
  let score = 0;
  const signals: string[] = [];

  // 1. Autocomplete depth — more autocomplete results = more search volume
  const autocompleteCount = evidence.filter(e => e.source === 'google:autocomplete').length;
  if (autocompleteCount > 20) { score += 25; signals.push(`${autocompleteCount} autocomplete suggestions (high)`); }
  else if (autocompleteCount > 10) { score += 15; signals.push(`${autocompleteCount} autocomplete suggestions (moderate)`); }
  else if (autocompleteCount > 5) { score += 8; signals.push(`${autocompleteCount} autocomplete suggestions (low)`); }

  // 2. Autocomplete depth indicator
  const depthEvidence = evidence.find(e => e.source === 'google:autocomplete-depth');
  if (depthEvidence) {
    score += 20;
    signals.push('High autocomplete alphabet expansion depth');
  }

  // 3. DuckDuckGo result count — more search results = more market activity
  const ddgResults = evidence.filter(e => e.source === 'duckduckgo:search').length;
  if (ddgResults > 30) { score += 20; signals.push(`${ddgResults} DuckDuckGo results (very high)`); }
  else if (ddgResults > 15) { score += 12; signals.push(`${ddgResults} DuckDuckGo results (high)`); }
  else if (ddgResults > 5) { score += 6; signals.push(`${ddgResults} DuckDuckGo results (moderate)`); }

  // 4. GitHub repo count and stars
  const githubRepos = evidence.filter(e => e.source === 'github:repo');
  const githubAnalysis = evidence.find(e => e.source === 'github:analysis');
  if (githubRepos.length > 5) { score += 10; signals.push(`${githubRepos.length} GitHub repos found`); }
  if (githubAnalysis) {
    const countMatch = githubAnalysis.excerpt.match(/(\d+) repositories/);
    if (countMatch) {
      const repoCount = parseInt(countMatch[1]);
      if (repoCount > 100) { score += 10; signals.push(`${repoCount} total GitHub repos in space`); }
      else if (repoCount > 20) { score += 5; signals.push(`${repoCount} total GitHub repos in space`); }
    }
  }

  // 5. Google Trends signals
  const trendsCount = evidence.filter(e => e.source === 'google:trends' || e.source === 'google:daily-trends').length;
  if (trendsCount > 3) { score += 10; signals.push(`${trendsCount} Google Trends matches`); }
  else if (trendsCount > 0) { score += 5; signals.push(`${trendsCount} Google Trends matches`); }

  // 6. Stack Exchange activity
  const seCount = evidence.filter(e => e.source?.startsWith('stackexchange')).length;
  if (seCount > 5) { score += 8; signals.push(`${seCount} StackExchange discussions`); }

  // 7. HackerNews activity
  const hnCount = evidence.filter(e => e.source?.startsWith('hackernews')).length;
  if (hnCount > 3) { score += 5; signals.push(`${hnCount} HackerNews discussions`); }

  // Cap at 100
  score = Math.min(100, score);

  let relativeVolume: VolumeEstimate['relativeVolume'];
  if (score >= 70) relativeVolume = 'very-high';
  else if (score >= 50) relativeVolume = 'high';
  else if (score >= 30) relativeVolume = 'medium';
  else if (score >= 15) relativeVolume = 'low';
  else relativeVolume = 'very-low';

  return { relativeVolume, score, signals };
}
