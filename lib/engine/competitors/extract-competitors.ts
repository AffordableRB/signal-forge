// Extract competitor data (names, pricing, weaknesses, ratings) from evidence.
// Uses pattern matching on evidence text to populate the competitors[] array
// that was previously always empty.

import { OpportunityCandidate, Competitor } from '../models/types';
import { callClaude, isLLMAvailable } from '../detectors/llm-client';

// ─── Pattern-based extraction (always runs) ─────────────────────────

// Common SaaS/tool name patterns in review text
const NAME_PATTERNS = [
  // "switching from X", "moved from X", "left X"
  /(?:switch(?:ed|ing)?\s+from|moved?\s+(?:away\s+)?from|left|leaving|dropped|ditched|replaced)\s+([A-Z][A-Za-z]+(?:\s*[A-Z][A-Za-z]+)?)/g,
  // "compared to X", "vs X", "alternative to X", "better than X"
  /(?:compared?\s+to|vs\.?|versus|alternative\s+to|better\s+than|worse\s+than|cheaper\s+than)\s+([A-Z][A-Za-z]+(?:\s*[A-Z][A-Za-z]+)?)/g,
  // "X is expensive/buggy/slow/etc"
  /([A-Z][A-Za-z]+(?:\s*[A-Z][A-Za-z]+)?)\s+(?:is|was|are|were|feels?|seems?)\s+(?:too\s+)?(?:expensive|overpriced|buggy|slow|clunky|outdated|complicated|confusing|terrible|awful|limited|basic)/gi,
  // "I use X", "we use X", "tried X", "using X"
  /(?:I|we|our\s+team|company)\s+(?:use|used|tried|tested|evaluated)\s+([A-Z][A-Za-z]+(?:\s*[A-Z][A-Za-z]+)?)/g,
  // "$X/mo" pricing mentions near product names
  /([A-Z][A-Za-z]+(?:\s*[A-Z][A-Za-z]+)?)\s+(?:costs?|charges?|pricing|starts?\s+at)\s+\$[\d,]+/g,
  // "X pricing" or "X reviews"
  /([A-Z][A-Za-z]+(?:\s*[A-Z][A-Za-z]+)?)\s+(?:pricing|reviews?|ratings?|alternatives?)/g,
];

// Words that look like competitor names but aren't
const FALSE_POSITIVES = new Set([
  'the', 'this', 'that', 'what', 'when', 'where', 'which', 'who',
  'how', 'why', 'our', 'their', 'its', 'they', 'some', 'any',
  'reddit', 'google', 'youtube', 'facebook', 'twitter', 'linkedin',
  'amazon', 'apple', 'microsoft', 'overall', 'however', 'although',
  'because', 'since', 'after', 'before', 'during', 'about',
  'would', 'could', 'should', 'might', 'very', 'just', 'also',
  'even', 'still', 'already', 'really', 'actually', 'basically',
  'definitely', 'probably', 'honestly', 'currently', 'recently',
  'edit', 'update', 'source', 'note', 'warning', 'error',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]);

// Extract pricing from text near a competitor name
function extractPricing(text: string, compName: string): string | undefined {
  const lower = text.toLowerCase();
  const nameLower = compName.toLowerCase();
  const idx = lower.indexOf(nameLower);
  if (idx < 0) return undefined;

  // Look in a 200-char window around the name
  const window = text.slice(Math.max(0, idx - 100), idx + compName.length + 100);
  const priceMatch = window.match(/\$[\d,]+(?:\.\d{2})?(?:\s*[-/]\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*\/\s*(?:mo|month|yr|year|user))?/i);
  return priceMatch ? priceMatch[0] : undefined;
}

// Extract review score near a competitor name
function extractReviewScore(text: string, compName: string): number | undefined {
  const lower = text.toLowerCase();
  const nameLower = compName.toLowerCase();
  const idx = lower.indexOf(nameLower);
  if (idx < 0) return undefined;

  const window = text.slice(Math.max(0, idx - 80), idx + compName.length + 80);
  const scoreMatch = window.match(/(\d\.\d)\s*(?:\/\s*5|out\s+of\s+5|stars?)/i);
  if (scoreMatch) {
    const score = parseFloat(scoreMatch[1]);
    if (score >= 1.0 && score <= 5.0) return score;
  }
  return undefined;
}

// Extract weakness phrases near a competitor name
function extractWeaknesses(allText: string, compName: string): string[] {
  const lower = allText.toLowerCase();
  const nameLower = compName.toLowerCase();
  const weaknesses: string[] = [];

  const weaknessPatterns = [
    new RegExp(`${nameLower}\\s+(?:is|was|are|were)\\s+(?:too\\s+)?([a-z]+(?:\\s+[a-z]+)?)`, 'gi'),
    new RegExp(`${nameLower}[^.]{0,40}(?:lacks?|missing|doesn'?t\\s+(?:have|support|offer))\\s+([^.]{5,40})`, 'gi'),
    new RegExp(`(?:problem|issue|complaint|downside|con)s?\\s+(?:with|of|about)\\s+${nameLower}[^.]{0,60}`, 'gi'),
  ];

  for (const pattern of weaknessPatterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const weakness = (match[1] || match[0]).trim().slice(0, 80);
      if (weakness.length > 3 && !weaknesses.includes(weakness)) {
        weaknesses.push(weakness);
      }
    }
  }

  return weaknesses.slice(0, 5);
}

function patternExtractCompetitors(candidate: OpportunityCandidate): Competitor[] {
  const allText = candidate.evidence.map(e => e.excerpt).join(' ');
  const nameCounts = new Map<string, number>();

  for (const pattern of NAME_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      const name = (match[1] || '').trim();
      if (name.length < 2 || name.length > 30) continue;
      if (FALSE_POSITIVES.has(name.toLowerCase())) continue;
      // Must start with uppercase (product name)
      if (!/^[A-Z]/.test(name)) continue;

      const normalized = name.replace(/\s+/g, ' ');
      nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
    }
  }

  // Only keep names mentioned 2+ times (reduces false positives)
  const competitors: Competitor[] = [];
  const sorted = Array.from(nameCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  for (const [name] of sorted) {
    competitors.push({
      name,
      weaknesses: extractWeaknesses(allText, name),
      pricingRange: extractPricing(allText, name),
      reviewScore: extractReviewScore(allText, name),
    });
  }

  return competitors;
}

// ─── LLM-based extraction (when API key active) ────────────────────

const COMPETITOR_PROMPT = `You are a market analyst. Extract competitor information from the evidence provided.

Return ONLY a JSON array of competitors. Each competitor object:
{
  "name": "<product/company name>",
  "pricingRange": "<e.g. '$49-199/mo' or null if unknown>",
  "reviewScore": <number 1.0-5.0 or null if unknown>,
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "url": "<website URL if mentioned, or null>"
}

Rules:
- Only include ACTUAL software products/services that compete in this space
- Use your world knowledge to fill in pricing and weaknesses even if not in the evidence
- Do NOT include generic companies (Google, Amazon) unless they have a specific competing product
- Maximum 8 competitors
- If no competitors can be identified, return []`;

async function llmExtractCompetitors(candidate: OpportunityCandidate): Promise<Competitor[]> {
  const evidenceSample = candidate.evidence
    .slice(0, 30)
    .map(e => `[${e.source}] "${e.excerpt}"`)
    .join('\n');

  const prompt = `OPPORTUNITY: ${candidate.jobToBeDone}
VERTICAL: ${candidate.vertical}
TARGET BUYER: ${candidate.targetBuyer}

EVIDENCE:
${evidenceSample}`;

  const response = await callClaude(COMPETITOR_PROMPT, prompt, 1500);
  if (!response) return [];

  try {
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, 8).map((c: Record<string, unknown>) => ({
      name: String(c.name || ''),
      url: c.url ? String(c.url) : undefined,
      weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses.map(String).slice(0, 5) : [],
      pricingRange: c.pricingRange ? String(c.pricingRange) : undefined,
      reviewScore: typeof c.reviewScore === 'number' ? c.reviewScore : undefined,
    })).filter((c: Competitor) => c.name.length > 0);
  } catch {
    return [];
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export async function extractCompetitors(candidate: OpportunityCandidate): Promise<OpportunityCandidate> {
  // Always run pattern extraction
  const patternCompetitors = patternExtractCompetitors(candidate);

  // If LLM available, also run LLM extraction and merge
  let llmCompetitors: Competitor[] = [];
  if (isLLMAvailable()) {
    try {
      llmCompetitors = await llmExtractCompetitors(candidate);
    } catch {
      // Non-fatal
    }
  }

  // Merge: LLM results take priority, pattern results fill gaps
  const byName = new Map<string, Competitor>();

  for (const c of patternCompetitors) {
    byName.set(c.name.toLowerCase(), c);
  }

  for (const c of llmCompetitors) {
    const key = c.name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      // Merge — LLM data fills gaps
      byName.set(key, {
        name: c.name, // LLM usually has better casing
        url: c.url || existing.url,
        weaknesses: c.weaknesses.length > 0 ? c.weaknesses : existing.weaknesses,
        pricingRange: c.pricingRange || existing.pricingRange,
        reviewScore: c.reviewScore ?? existing.reviewScore,
      });
    } else {
      byName.set(key, c);
    }
  }

  const competitors = Array.from(byName.values()).slice(0, 8);

  return { ...candidate, competitors };
}

export async function extractCompetitorsAll(candidates: OpportunityCandidate[]): Promise<OpportunityCandidate[]> {
  return Promise.all(candidates.map(c => extractCompetitors(c)));
}
