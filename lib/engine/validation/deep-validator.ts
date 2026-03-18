// Deep Validation Engine
//
// Only runs on the top 1-2 opportunities after initial scoring.
// Uses Claude to perform thorough analysis that goes beyond signal detection
// into actual business viability assessment.
//
// This is the difference between "interesting signals" and "go build this."

import {
  OpportunityCandidate,
  DeepValidation,
  ValidationVerdict,
  ValidationCheck,
} from '../models/types';
import { callClaude, isLLMAvailable } from '../detectors/llm-client';

const VALIDATION_SYSTEM_PROMPT = `You are a ruthlessly honest startup advisor. Your job is to determine if a business opportunity is worth pursuing. You are NOT a cheerleader. Your reputation depends on giving advice people can bet their savings on.

RULES:
- If the evidence is weak, say so. Do not fill gaps with optimism.
- If you see a fatal flaw, the verdict is NO-GO regardless of how good other signals are.
- "CONDITIONAL" means there are specific things that MUST be true for this to work, and they haven't been verified yet.
- "GO" means the evidence strongly supports this being a viable business. You'd personally advise someone to spend 2 weeks building an MVP.
- Be specific. "Good market" is useless. "14,000 plumbing businesses in the US spend $200-400/mo on call management, and the top 3 solutions all have <4.0 ratings on G2" is useful.
- Every claim must trace back to evidence provided. If you can't cite evidence, say "unverified assumption."

OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure (no markdown fences, no explanation outside JSON):
{
  "verdict": "GO" | "CONDITIONAL" | "NO-GO",
  "verdictReasoning": "<3-5 sentences explaining the verdict with specific evidence citations>",
  "confidencePercent": <0-100>,
  "checks": [
    {
      "name": "Real pain with economic consequence",
      "passed": <true/false>,
      "evidence": "<specific quote or data point that proves/disproves this>",
      "confidence": <0-100>
    },
    {
      "name": "Buyers actively spending money on alternatives",
      "passed": <true/false>,
      "evidence": "<pricing data, job postings, or existing spend>",
      "confidence": <0-100>
    },
    {
      "name": "Competition is beatable (not just weak)",
      "passed": <true/false>,
      "evidence": "<specific gap you can exploit, not just 'they have bad reviews'>",
      "confidence": <0-100>
    },
    {
      "name": "You can reach buyers without a sales team",
      "passed": <true/false>,
      "evidence": "<specific distribution channel and why it works>",
      "confidence": <0-100>
    },
    {
      "name": "Market is large enough (>$10M TAM)",
      "passed": <true/false>,
      "evidence": "<buyer count x price point calculation>",
      "confidence": <0-100>
    },
    {
      "name": "Timing is right (not too early, not too late)",
      "passed": <true/false>,
      "evidence": "<market trend data, regulatory changes, technology shifts>",
      "confidence": <0-100>
    },
    {
      "name": "Can build MVP in 4 weeks or less",
      "passed": <true/false>,
      "evidence": "<technical assessment of core functionality needed>",
      "confidence": <0-100>
    },
    {
      "name": "Clear retention mechanism (not one-time use)",
      "passed": <true/false>,
      "evidence": "<why customers would use this weekly/daily>",
      "confidence": <0-100>
    }
  ],
  "unitEconomics": {
    "estimatedCAC": "<dollar amount with reasoning>",
    "estimatedLTV": "<dollar amount with reasoning>",
    "estimatedMargin": "<percentage with reasoning>",
    "monthlyRevenueAt100Customers": "<dollar amount>",
    "breakEvenCustomers": <number>,
    "reasoning": "<2-3 sentences on whether the economics work>"
  },
  "competitorDeepDive": [
    {
      "name": "<competitor name>",
      "estimatedRevenue": "<estimate if possible, or 'unknown'>",
      "mainWeakness": "<specific exploitable weakness>",
      "whyYouWin": "<what a new entrant does better>",
      "switchingCost": "<how hard is it for their customers to leave>"
    }
  ],
  "first10Customers": {
    "segment": "<the specific sub-group of buyers to target first>",
    "howToReach": "<specific channel: subreddit, Facebook group, trade show, cold email list>",
    "estimatedConversionRate": "<percentage and reasoning>",
    "exampleOutreach": "<a 2-sentence cold outreach message>"
  },
  "exactGap": "<1-2 sentences: the specific thing existing solutions don't do that buyers need>",
  "unfairAdvantage": "<what would make a specific founder able to win this — domain expertise, technical skill, existing audience, etc.>",
  "biggestRisk": "<the single most likely reason this fails>",
  "validationTests": [
    {
      "testType": "landing-page" | "cold-outreach" | "pre-sale" | "manual-service" | "waitlist",
      "description": "<what to do>",
      "successCriteria": "<what proves the idea works>",
      "timeRequired": "<hours or days>",
      "costRequired": "<dollar amount>"
    }
  ],
  "killReasons": ["<reason 1 this could fail even with good signals>", "<reason 2>", "<reason 3>"],
  "comparableCompanies": [
    {
      "name": "<real company that tackled a similar problem>",
      "whatTheyDid": "<1 sentence>",
      "outcome": "<funding raised, revenue, acquisition, or failure — use real data you know>",
      "lessonForThisOpportunity": "<what to learn from their success or failure>"
    }
  ],
  "contrarian": {
    "bestArgumentAgainst": "<the strongest 2-3 sentence case for why this will FAIL — steelman the opposition>",
    "counterArgument": "<why the failure argument might be wrong — only if you genuinely believe it>",
    "riskLevel": "low" | "medium" | "high"
  }
}`;

function buildValidationPrompt(candidate: OpportunityCandidate): string {
  const sections: string[] = [];

  sections.push('=== OPPORTUNITY TO VALIDATE ===');
  sections.push(`Job to be done: ${candidate.jobToBeDone}`);
  sections.push(`Vertical: ${candidate.vertical}`);
  sections.push(`Target buyer: ${candidate.targetBuyer}`);
  sections.push(`Initial score: ${candidate.scores.final.toFixed(1)}/10`);
  sections.push('');

  // Detector results
  sections.push('=== DETECTOR SCORES ===');
  for (const dr of candidate.detectorResults) {
    sections.push(`${dr.detectorId}: ${dr.score}/10 — ${dr.explanation}`);
  }
  sections.push('');

  // All evidence grouped by type
  const byType: Record<string, typeof candidate.evidence> = {};
  for (const e of candidate.evidence) {
    const key = e.signalType;
    if (!byType[key]) byType[key] = [];
    byType[key].push(e);
  }

  for (const [type, items] of Object.entries(byType)) {
    sections.push(`=== ${type.toUpperCase()} EVIDENCE (${items.length} pieces) ===`);
    for (const e of items) {
      const age = e.timestamp
        ? `${Math.round((Date.now() - e.timestamp) / 86400000)}d ago`
        : 'unknown age';
      const tier = e.sourceTier ? `tier-${e.sourceTier}` : '';
      sections.push(`[${e.source}] (${age}, ${tier}) "${e.excerpt}"`);
    }
    sections.push('');
  }

  // Competitors
  if (candidate.competitors.length > 0) {
    sections.push(`=== COMPETITORS (${candidate.competitors.length}) ===`);
    for (const c of candidate.competitors) {
      const parts = [c.name];
      if (c.pricingRange) parts.push(`Pricing: ${c.pricingRange}`);
      if (c.reviewScore) parts.push(`Rating: ${c.reviewScore}/5`);
      if (c.weaknesses.length > 0) parts.push(`Weaknesses: ${c.weaknesses.join(', ')}`);
      sections.push(parts.join(' | '));
    }
    sections.push('');
  }

  // Market structure
  if (candidate.marketStructure) {
    const ms = candidate.marketStructure;
    sections.push('=== MARKET STRUCTURE ===');
    sections.push(`Classification: ${ms.type} ocean`);
    sections.push(`Maturity: ${ms.maturityLevel}`);
    sections.push(`Innovation gap: ${ms.innovationGap}/10`);
    sections.push(`Competitor count: ${ms.competitorCount}`);
    sections.push(`Reason: ${ms.reason}`);
    sections.push('');
  }

  // Economic impact
  if (candidate.economicImpact) {
    const eco = candidate.economicImpact;
    sections.push('=== ECONOMIC IMPACT ESTIMATE ===');
    sections.push(`Monthly cost to buyer: $${eco.totalMonthlyCost[0]} - $${eco.totalMonthlyCost[1]}`);
    sections.push(`Revenue loss/mo: $${eco.revenueLossPerMonth[0]} - $${eco.revenueLossPerMonth[1]}`);
    if (eco.impliedROIMultiple) sections.push(`Implied ROI: ${eco.impliedROIMultiple}x`);
    if (eco.paybackPeriodMonths) sections.push(`Payback: ${eco.paybackPeriodMonths} months`);
    sections.push('');
  }

  // Risk flags
  if (candidate.riskFlags.length > 0) {
    sections.push('=== RISK FLAGS ===');
    for (const rf of candidate.riskFlags) {
      sections.push(`[${rf.severity}] ${rf.description}`);
    }
    sections.push('');
  }

  // Confidence
  if (candidate.confidence) {
    sections.push('=== CONFIDENCE METRICS ===');
    sections.push(`Overall: ${candidate.confidence.overall}%`);
    sections.push(`Evidence quality: ${candidate.confidence.evidenceQuality}%`);
    sections.push(`Signal relevance: ${candidate.confidence.signalRelevance}%`);
    sections.push(`Contradictions: ${candidate.confidence.contradictionScore}%`);
    sections.push('');
  }

  sections.push('=== YOUR TASK ===');
  sections.push('Analyze ALL the evidence above. Determine if this is a real business opportunity worth pursuing.');
  sections.push('Be brutally honest. If the evidence is thin, say so. If there are fatal flaws, call them out.');
  sections.push('Your verdict will determine if someone invests their time and money into this.');

  return sections.join('\n');
}

function parseValidationResponse(raw: string): DeepValidation | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.verdict || !['GO', 'CONDITIONAL', 'NO-GO'].includes(parsed.verdict)) {
      console.error('[DeepValidator] Invalid verdict:', parsed.verdict);
      return null;
    }

    // Ensure checks array has valid structure
    const checks: ValidationCheck[] = (parsed.checks || []).map((c: Record<string, unknown>) => ({
      name: String(c.name || ''),
      passed: Boolean(c.passed),
      evidence: String(c.evidence || 'No evidence cited'),
      confidence: Math.max(0, Math.min(100, Number(c.confidence) || 50)),
    }));

    return {
      verdict: parsed.verdict as ValidationVerdict,
      verdictReasoning: String(parsed.verdictReasoning || ''),
      confidencePercent: Math.max(0, Math.min(100, Number(parsed.confidencePercent) || 50)),
      checks,
      unitEconomics: {
        estimatedCAC: String(parsed.unitEconomics?.estimatedCAC || 'Unknown'),
        estimatedLTV: String(parsed.unitEconomics?.estimatedLTV || 'Unknown'),
        estimatedMargin: String(parsed.unitEconomics?.estimatedMargin || 'Unknown'),
        monthlyRevenueAt100Customers: String(parsed.unitEconomics?.monthlyRevenueAt100Customers || 'Unknown'),
        breakEvenCustomers: Number(parsed.unitEconomics?.breakEvenCustomers) || 0,
        reasoning: String(parsed.unitEconomics?.reasoning || ''),
      },
      competitorDeepDive: (parsed.competitorDeepDive || []).map((c: Record<string, unknown>) => ({
        name: String(c.name || ''),
        estimatedRevenue: String(c.estimatedRevenue || 'Unknown'),
        mainWeakness: String(c.mainWeakness || ''),
        whyYouWin: String(c.whyYouWin || ''),
        switchingCost: String(c.switchingCost || ''),
      })),
      first10Customers: {
        segment: String(parsed.first10Customers?.segment || ''),
        howToReach: String(parsed.first10Customers?.howToReach || ''),
        estimatedConversionRate: String(parsed.first10Customers?.estimatedConversionRate || ''),
        exampleOutreach: String(parsed.first10Customers?.exampleOutreach || ''),
      },
      exactGap: String(parsed.exactGap || ''),
      unfairAdvantage: String(parsed.unfairAdvantage || ''),
      biggestRisk: String(parsed.biggestRisk || ''),
      validationTests: (parsed.validationTests || []).map((t: Record<string, unknown>) => ({
        testType: String(t.testType || ''),
        description: String(t.description || ''),
        successCriteria: String(t.successCriteria || ''),
        timeRequired: String(t.timeRequired || ''),
        costRequired: String(t.costRequired || ''),
      })),
      killReasons: (parsed.killReasons || []).map(String),
      comparableCompanies: (parsed.comparableCompanies || []).map((c: Record<string, unknown>) => ({
        name: String(c.name || ''),
        whatTheyDid: String(c.whatTheyDid || ''),
        outcome: String(c.outcome || ''),
        lessonForThisOpportunity: String(c.lessonForThisOpportunity || ''),
      })),
      contrarian: parsed.contrarian ? {
        bestArgumentAgainst: String(parsed.contrarian.bestArgumentAgainst || ''),
        counterArgument: String(parsed.contrarian.counterArgument || ''),
        riskLevel: ['low', 'medium', 'high'].includes(parsed.contrarian?.riskLevel) ? parsed.contrarian.riskLevel : 'medium',
      } : undefined,
    };
  } catch (err) {
    console.error('[DeepValidator] Parse error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Run deep validation on a single opportunity
export async function deepValidate(candidate: OpportunityCandidate): Promise<OpportunityCandidate> {
  if (!isLLMAvailable()) {
    console.warn('[DeepValidator] No API key — skipping deep validation');
    return candidate;
  }

  console.log(`[DeepValidator] Validating: ${candidate.jobToBeDone}`);

  const prompt = buildValidationPrompt(candidate);
  const response = await callClaude(VALIDATION_SYSTEM_PROMPT, prompt, 4000);

  if (!response) {
    console.warn('[DeepValidator] No response from Claude');
    return candidate;
  }

  const validation = parseValidationResponse(response);
  if (!validation) {
    console.warn('[DeepValidator] Failed to parse validation response');
    return candidate;
  }

  console.log(`[DeepValidator] Verdict: ${validation.verdict} (${validation.confidencePercent}% confidence)`);

  // Merge comparable companies and contrarian from both enrichment and validation
  const comparableCompanies = [
    ...(candidate.comparableCompanies || []),
    ...(validation.comparableCompanies || []),
  ];
  const contrarianAnalysis = validation.contrarian || candidate.contrarianAnalysis;

  return {
    ...candidate,
    deepValidation: validation,
    comparableCompanies: comparableCompanies.length > 0 ? comparableCompanies : undefined,
    contrarianAnalysis,
  };
}

// Run deep validation on top N candidates
export async function deepValidateTop(
  candidates: OpportunityCandidate[],
  topN: number = 2,
): Promise<OpportunityCandidate[]> {
  if (!isLLMAvailable()) return candidates;

  // Sort by score, validate top N
  const sorted = [...candidates].sort((a, b) => b.scores.final - a.scores.final);
  const toValidate = sorted.filter(c => !c.rejected).slice(0, topN);
  const toValidateIds = new Set(toValidate.map(c => c.id));

  const results: OpportunityCandidate[] = [];
  for (const candidate of sorted) {
    if (toValidateIds.has(candidate.id)) {
      results.push(await deepValidate(candidate));
    } else {
      results.push(candidate);
    }
  }

  return results;
}
