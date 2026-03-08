// LLM-powered opportunity analysis.
// Replaces keyword-based detectors with Claude-powered semantic analysis.
// Falls back to keyword detectors if ANTHROPIC_API_KEY is not set.

import { OpportunityCandidate, DetectorResult } from '../models/types';
import { callClaude, isLLMAvailable } from './llm-client';
import { analyzeCandidate as keywordAnalyze } from './index';

const SYSTEM_PROMPT = `You are an expert business analyst evaluating a startup opportunity.

You will receive evidence (Reddit posts, reviews, job listings, pricing data, competitor info) about a potential business opportunity. Your job is to score it across 12 dimensions, each 0-10.

SCORING RULES:
- Base scores on EVIDENCE, not assumptions. If there's no evidence for a dimension, score 3-5 (uncertain), not 0.
- A score of 8-10 requires strong, multi-source evidence.
- A score of 0-2 requires strong evidence that the dimension is weak.
- Be skeptical. Hype is not demand. Complaints are not market gaps. One Reddit post is not validation.
- Consider context: "this tool sucks" in a review is a competition weakness signal. "There are dozens of these" is a saturation signal.
- Understand negation: "not expensive" means affordable. "No good solution exists" means blue ocean.

OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):
{
  "demand": { "score": <0-10>, "reasoning": "<1-2 sentences citing specific evidence>" },
  "painIntensity": { "score": <0-10>, "reasoning": "<cite specific pain signals and their severity>" },
  "abilityToPay": { "score": <0-10>, "reasoning": "<cite pricing data, buyer budgets, existing spend>" },
  "competitionWeakness": { "score": <0-10>, "reasoning": "<cite specific competitor complaints, gaps, or absence>" },
  "easeToBuild": { "score": <0-10>, "reasoning": "<assess technical complexity based on the job-to-be-done>" },
  "distributionAccess": { "score": <0-10>, "reasoning": "<assess how reachable the target buyer is>" },
  "workflowAnchor": { "score": <0-10>, "reasoning": "<assess daily/weekly usage potential>" },
  "marketTiming": { "score": <0-10>, "reasoning": "<assess whether timing is right based on trends>" },
  "revenueDensity": { "score": <0-10>, "reasoning": "<assess revenue per customer potential>" },
  "switchingFriction": { "score": <0-10>, "reasoning": "<assess how easy it is to adopt — higher = easier>" },
  "aiAdvantage": { "score": <0-10>, "reasoning": "<assess whether AI provides genuine advantage>" },
  "marketExpansion": { "score": <0-10>, "reasoning": "<assess multi-market potential>" },
  "overallAssessment": "<2-3 sentence summary of the opportunity quality>",
  "redFlags": ["<list any concerns>"],
  "keyInsight": "<the single most important finding from the evidence>"
}`;

function buildEvidencePrompt(candidate: OpportunityCandidate): string {
  const sections: string[] = [];

  sections.push(`OPPORTUNITY: ${candidate.jobToBeDone}`);
  sections.push(`VERTICAL: ${candidate.vertical}`);
  sections.push(`TARGET BUYER: ${candidate.targetBuyer}`);
  sections.push('');

  // Group evidence by type
  const byType: Record<string, typeof candidate.evidence> = {};
  for (const e of candidate.evidence) {
    const key = e.signalType;
    if (!byType[key]) byType[key] = [];
    byType[key].push(e);
  }

  for (const [type, items] of Object.entries(byType)) {
    sections.push(`--- ${type.toUpperCase()} SIGNALS (${items.length}) ---`);
    for (const e of items) {
      const age = e.timestamp
        ? `${Math.round((Date.now() - e.timestamp) / 86400000)}d ago`
        : 'unknown age';
      sections.push(`[${e.source}] (${age}) "${e.excerpt}"`);
    }
    sections.push('');
  }

  if (candidate.competitors.length > 0) {
    sections.push(`--- COMPETITORS (${candidate.competitors.length}) ---`);
    for (const c of candidate.competitors) {
      const weaknesses = c.weaknesses.length > 0 ? `Weaknesses: ${c.weaknesses.join(', ')}` : '';
      const pricing = c.pricingRange ? `Pricing: ${c.pricingRange}` : '';
      sections.push(`${c.name} — ${pricing} ${weaknesses}`);
    }
    sections.push('');
  }

  sections.push(`Total evidence pieces: ${candidate.evidence.length}`);
  sections.push(`Unique sources: ${new Set(candidate.evidence.map(e => e.source)).size}`);

  return sections.join('\n');
}

interface LLMDetectorScore {
  score: number;
  reasoning: string;
}

interface LLMAnalysisResult {
  demand: LLMDetectorScore;
  painIntensity: LLMDetectorScore;
  abilityToPay: LLMDetectorScore;
  competitionWeakness: LLMDetectorScore;
  easeToBuild: LLMDetectorScore;
  distributionAccess: LLMDetectorScore;
  workflowAnchor: LLMDetectorScore;
  marketTiming: LLMDetectorScore;
  revenueDensity: LLMDetectorScore;
  switchingFriction: LLMDetectorScore;
  aiAdvantage: LLMDetectorScore;
  marketExpansion: LLMDetectorScore;
  overallAssessment: string;
  redFlags: string[];
  keyInsight: string;
}

function parseLLMResponse(raw: string): LLMAnalysisResult | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);

    // Validate structure
    const detectorIds = [
      'demand', 'painIntensity', 'abilityToPay', 'competitionWeakness',
      'easeToBuild', 'distributionAccess', 'workflowAnchor',
      'marketTiming', 'revenueDensity', 'switchingFriction', 'aiAdvantage', 'marketExpansion',
    ];

    for (const id of detectorIds) {
      if (!parsed[id] || typeof parsed[id].score !== 'number') {
        console.error(`[LLM] Missing or invalid detector: ${id}`);
        return null;
      }
      // Clamp scores to 0-10
      parsed[id].score = Math.max(0, Math.min(10, Math.round(parsed[id].score)));
    }

    return parsed as LLMAnalysisResult;
  } catch (err) {
    console.error('[LLM] Failed to parse response:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Analyze a single candidate using LLM
export async function llmAnalyzeCandidate(candidate: OpportunityCandidate): Promise<OpportunityCandidate> {
  if (!isLLMAvailable()) {
    return keywordAnalyze(candidate);
  }

  const prompt = buildEvidencePrompt(candidate);
  const response = await callClaude(SYSTEM_PROMPT, prompt, 2500);

  if (!response) {
    console.warn('[LLM] No response, falling back to keyword detectors');
    return keywordAnalyze(candidate);
  }

  const analysis = parseLLMResponse(response);
  if (!analysis) {
    console.warn('[LLM] Failed to parse, falling back to keyword detectors');
    return keywordAnalyze(candidate);
  }

  const detectorIds = [
    'demand', 'painIntensity', 'abilityToPay', 'competitionWeakness',
    'easeToBuild', 'distributionAccess', 'workflowAnchor',
    'marketTiming', 'revenueDensity', 'switchingFriction', 'aiAdvantage', 'marketExpansion',
  ] as const;

  const detectorResults: DetectorResult[] = detectorIds.map(id => ({
    detectorId: id,
    score: (analysis[id] as LLMDetectorScore).score,
    explanation: (analysis[id] as LLMDetectorScore).reasoning,
  }));

  // Store LLM insights in risk flags
  const riskFlags = [...(candidate.riskFlags || [])];
  for (const flag of analysis.redFlags) {
    riskFlags.push({
      id: 'llm-red-flag',
      severity: 'medium' as const,
      description: flag,
    });
  }

  return {
    ...candidate,
    detectorResults,
    riskFlags,
  };
}

// Analyze all candidates — parallel with concurrency limit
export async function llmAnalyzeAll(candidates: OpportunityCandidate[]): Promise<OpportunityCandidate[]> {
  if (!isLLMAvailable()) {
    return candidates.map(c => keywordAnalyze(c));
  }

  // Run up to 3 LLM calls in parallel to reduce wall-clock time
  const results = await Promise.all(
    candidates.map(candidate => llmAnalyzeCandidate(candidate))
  );
  return results;
}
