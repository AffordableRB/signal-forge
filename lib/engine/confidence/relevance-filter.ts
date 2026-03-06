import { Evidence } from '../models/types';

export interface RelevanceResult {
  evidence: Evidence;
  relevance: 'relevant' | 'weakly-relevant' | 'irrelevant';
  relevanceScore: number; // 0-1
  reasons: string[];
}

// Compute relevance of a piece of evidence to the opportunity
export function assessRelevance(
  evidence: Evidence,
  jobToBeDone: string,
  targetBuyer: string,
  vertical: string
): RelevanceResult {
  const text = evidence.excerpt.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  // Job relevance: do keywords from the job appear in evidence?
  const jobTokens = tokenize(jobToBeDone);
  const jobPhrases = extractPhrases(jobToBeDone);
  const jobHits = jobTokens.filter(t => text.includes(t));
  const jobPhraseHits = jobPhrases.filter(p => text.includes(p));
  const jobRelevance = jobTokens.length > 0 ? jobHits.length / jobTokens.length : 0;
  // Phrase matches are stronger signals than individual token matches
  if (jobPhraseHits.length > 0) {
    score += 0.4;
    reasons.push(`Job phrase match: ${jobPhraseHits.join(', ')}`);
  } else if (jobRelevance >= 0.3) {
    score += 0.35;
    reasons.push(`Job match: ${jobHits.length}/${jobTokens.length} keywords`);
  } else if (jobRelevance > 0) {
    score += 0.15;
    reasons.push(`Weak job match: ${jobHits.length}/${jobTokens.length} keywords`);
  }

  // Buyer relevance
  const buyerTokens = tokenize(targetBuyer);
  const buyerPhrases = extractPhrases(targetBuyer);
  const buyerHits = buyerTokens.filter(t => text.includes(t));
  const buyerPhraseHits = buyerPhrases.filter(p => text.includes(p));
  if (buyerPhraseHits.length > 0 || buyerHits.length > 0) {
    score += buyerPhraseHits.length > 0 ? 0.25 : 0.2;
    reasons.push(`Buyer match: ${(buyerPhraseHits.length > 0 ? buyerPhraseHits : buyerHits).join(', ')}`);
  }

  // Industry/vertical relevance
  const vertTokens = tokenize(vertical);
  const vertPhrases = extractPhrases(vertical);
  const vertHits = vertTokens.filter(t => text.includes(t));
  const vertPhraseHits = vertPhrases.filter(p => text.includes(p));
  if (vertPhraseHits.length > 0 || vertHits.length > 0) {
    score += vertPhraseHits.length > 0 ? 0.25 : 0.2;
    reasons.push(`Vertical match: ${(vertPhraseHits.length > 0 ? vertPhraseHits : vertHits).join(', ')}`);
  }

  // Actionability: does the evidence contain actionable signals?
  const actionablePatterns = /need|want|looking for|struggling|frustrated|hate|waste|cost|spend|pay|budget|expensive|alternative|switch|replace/i;
  if (actionablePatterns.test(text)) {
    score += 0.2;
    reasons.push('Contains actionable signal');
  }

  // Signal type quality bonus
  if (evidence.signalType === 'pain' || evidence.signalType === 'money') {
    score += 0.1;
  }

  score = Math.min(1, score);

  let relevance: RelevanceResult['relevance'];
  if (score >= 0.5) relevance = 'relevant';
  else if (score >= 0.25) relevance = 'weakly-relevant';
  else relevance = 'irrelevant';

  return { evidence, relevance, relevanceScore: score, reasons };
}

// Filter and tag evidence by relevance
export function filterByRelevance(
  evidence: Evidence[],
  jobToBeDone: string,
  targetBuyer: string,
  vertical: string
): { relevant: RelevanceResult[]; weaklyRelevant: RelevanceResult[]; irrelevant: RelevanceResult[]; signalRelevanceScore: number } {
  const results = evidence.map(e => assessRelevance(e, jobToBeDone, targetBuyer, vertical));

  const relevant = results.filter(r => r.relevance === 'relevant');
  const weaklyRelevant = results.filter(r => r.relevance === 'weakly-relevant');
  const irrelevant = results.filter(r => r.relevance === 'irrelevant');

  // Signal relevance score: 0-100
  const totalScore = results.reduce((s, r) => s + r.relevanceScore, 0);
  const signalRelevanceScore = results.length > 0
    ? Math.round((totalScore / results.length) * 100)
    : 0;

  return { relevant, weaklyRelevant, irrelevant, signalRelevanceScore };
}

function tokenize(text: string): string[] {
  const stopWords = new Set(['a', 'an', 'the', 'for', 'and', 'or', 'to', 'of', 'in', 'with', 'is', 'are', 'was', 'be', 'by', 'on', 'at', 'it', 'that', 'this', 'as']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

// Extract meaningful bigram phrases from text
function extractPhrases(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  return phrases;
}
