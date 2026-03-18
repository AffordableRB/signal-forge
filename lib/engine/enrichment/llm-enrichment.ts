// LLM-powered enrichment.
// Replaces 5 heuristic modules (market-size, economic-impact, market-structure,
// wedge-generator, synthesizer) with a single Claude call that uses world knowledge
// for grounded analysis instead of keyword regex and hardcoded numbers.

import { OpportunityCandidate, MarketSize, PurpleOpportunity, StartupConcept, ValidationPlan } from '../models/types';
import { EconomicImpactV2 } from '../detectors/economic-impact-v2';
import { MarketStructureV2 } from '../market/market-structure-v2';
import { callClaude, isLLMAvailable } from '../detectors/llm-client';

const ENRICHMENT_SYSTEM_PROMPT = `You are a startup analyst with deep knowledge of SaaS markets, pricing, and competitive landscapes. Your job is to provide GROUNDED analysis of a business opportunity using your real-world knowledge.

CRITICAL RULES:
- Use REAL data from your knowledge. If you know Calendly charges $8-16/user/month, say that. Don't make up numbers.
- If you don't know something, say "unknown" rather than guessing.
- Be specific. "~450,000 dental practices in the US" is good. "Many businesses" is useless.
- For market sizing, use real industry data you know (Census, IBISWorld, trade associations).
- For competitor analysis, name REAL competitors you know exist, with REAL pricing.
- For economic impact, estimate based on comparable industries and known labor costs.
- Feasibility and impact scores should reflect REAL technical complexity and market dynamics.

OUTPUT FORMAT:
Return ONLY a JSON object (no markdown fences):
{
  "marketSize": {
    "potentialBuyers": <number — real estimate of businesses/people who need this>,
    "adoptionRate": <0-1 — realistic % who would adopt a new tool>,
    "potentialCustomers": <potentialBuyers * adoptionRate>,
    "avgMonthlyPrice": <realistic SaaS price based on comparable tools>,
    "revenueCeiling": <potentialCustomers * avgMonthlyPrice * 12>,
    "explanation": "<2-3 sentences citing real data sources or comparable markets>"
  },
  "marketStructure": {
    "type": "blue" | "purple" | "red",
    "reason": "<2-3 sentences explaining classification with named competitors>",
    "competitorCount": <number of direct competitors you can name>,
    "maturityLevel": "nascent" | "emerging" | "growing" | "mature" | "declining",
    "innovationGap": <0-10, based on what competitors DON'T do well>,
    "pricingSimilarity": <0-10, how similar are competitor prices>,
    "confidence": <0-100>,
    "adjacentCompetitorDensity": <0-10>,
    "featureOverlapScore": <0-10>,
    "namedCompetitors": ["<real competitor 1>", "<real competitor 2>", "..."],
    "competitorPricing": {"<competitor>": "<their actual pricing>"}
  },
  "economicImpact": {
    "timeCostHoursPerMonth": <realistic hours the problem costs per month>,
    "laborCostPerMonth": <hours * realistic hourly rate for this role>,
    "revenueLossPerMonth": <estimated revenue impact of the problem>,
    "totalMonthlyCost": <labor + revenue loss>,
    "impliedROIMultiple": <totalMonthlyCost / avgMonthlyPrice>,
    "paybackPeriodMonths": <realistic payback period>,
    "economicPainScore": <0-10>,
    "explanation": "<2-3 sentences with real cost data>",
    "confidence": <0-100>
  },
  "wedges": [
    {
      "wedgeType": "<ai-disruption|automation|segment-focus|workflow-redesign|pricing-disruption|integration-bridge|other>",
      "title": "<specific differentiation angle>",
      "explanation": "<why this wedge works against specific named competitors>",
      "feasibility": <0-10, based on real technical complexity>,
      "impact": <0-10, based on real market dynamics>
    }
  ],
  "startupConcepts": [
    {
      "name": "<creative but professional product name>",
      "oneLiner": "<compelling 1-sentence pitch>",
      "wedge": "<which wedge this exploits>",
      "technology": "<realistic tech stack for this specific product>",
      "goToMarket": "<specific GTM strategy with named channels, estimated CAC>"
    }
  ],
  "validationPlan": {
    "interviewQuestions": ["<5-7 questions specific to THIS opportunity, not generic>"],
    "outreachMessages": ["<2-3 outreach messages tailored to the specific buyer persona>"],
    "sevenDayPlan": ["<7 specific daily actions with realistic expectations>"]
  },
  "comparableCompanies": [
    {
      "name": "<real company that solved a similar problem>",
      "whatTheyDid": "<1 sentence>",
      "outcome": "<funding, revenue, acquisition, or failure>",
      "lessonForThisOpportunity": "<what to learn from them>"
    }
  ],
  "contrarian": {
    "bestArgumentAgainst": "<the strongest 2-3 sentence argument for why this will FAIL>",
    "counterArgument": "<why the failure argument might be wrong>",
    "riskLevel": "low" | "medium" | "high"
  }
}`;

function buildEnrichmentPrompt(candidate: OpportunityCandidate): string {
  const sections: string[] = [];

  sections.push(`OPPORTUNITY: ${candidate.jobToBeDone}`);
  sections.push(`VERTICAL: ${candidate.vertical}`);
  sections.push(`TARGET BUYER: ${candidate.targetBuyer}`);
  sections.push(`INITIAL SCORE: ${candidate.scores?.final?.toFixed(1) ?? 'unscored'}/10`);
  sections.push('');

  // Detector scores
  sections.push('--- DETECTOR SCORES ---');
  for (const dr of candidate.detectorResults) {
    sections.push(`${dr.detectorId}: ${dr.score}/10 — ${dr.explanation}`);
  }
  sections.push('');

  // Evidence excerpts (top 20 most relevant)
  const sorted = [...candidate.evidence]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 20);

  if (sorted.length > 0) {
    sections.push(`--- EVIDENCE (${candidate.evidence.length} total, top ${sorted.length} shown) ---`);
    for (const e of sorted) {
      sections.push(`[${e.source}] (${e.signalType}) "${e.excerpt.slice(0, 200)}"`);
    }
    sections.push('');
  }

  // Known competitors
  if (candidate.competitors.length > 0) {
    sections.push(`--- KNOWN COMPETITORS (${candidate.competitors.length}) ---`);
    for (const c of candidate.competitors) {
      const parts = [c.name];
      if (c.pricingRange) parts.push(`Pricing: ${c.pricingRange}`);
      if (c.weaknesses.length > 0) parts.push(`Weaknesses: ${c.weaknesses.join(', ')}`);
      sections.push(parts.join(' | '));
    }
    sections.push('');
  }

  sections.push('Analyze this opportunity using your REAL WORLD KNOWLEDGE. Name real competitors, cite real pricing, use real market data.');

  return sections.join('\n');
}

interface LLMEnrichmentResult {
  marketSize: MarketSize;
  marketStructure: MarketStructureV2;
  economicImpact: {
    timeCostHoursPerMonth: number;
    laborCostPerMonth: number;
    revenueLossPerMonth: number;
    totalMonthlyCost: number;
    impliedROIMultiple: number;
    paybackPeriodMonths: number;
    economicPainScore: number;
    explanation: string;
    confidence: number;
  };
  wedges: PurpleOpportunity[];
  startupConcepts: StartupConcept[];
  validationPlan: ValidationPlan;
  comparableCompanies: Array<{
    name: string;
    whatTheyDid: string;
    outcome: string;
    lessonForThisOpportunity: string;
  }>;
  contrarian: {
    bestArgumentAgainst: string;
    counterArgument: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

function parseEnrichmentResponse(raw: string): LLMEnrichmentResult | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);

    // Validate required top-level fields
    if (!parsed.marketSize || !parsed.marketStructure || !parsed.economicImpact) {
      console.error('[LLMEnrichment] Missing required fields');
      return null;
    }

    // Ensure market structure has valid type
    if (!['blue', 'purple', 'red'].includes(parsed.marketStructure.type)) {
      parsed.marketStructure.type = 'red';
    }

    // Ensure wedges is an array
    if (!Array.isArray(parsed.wedges)) parsed.wedges = [];
    if (!Array.isArray(parsed.startupConcepts)) parsed.startupConcepts = [];
    if (!parsed.validationPlan) {
      parsed.validationPlan = { interviewQuestions: [], outreachMessages: [], sevenDayPlan: [] };
    }
    if (!Array.isArray(parsed.comparableCompanies)) parsed.comparableCompanies = [];
    if (!parsed.contrarian) {
      parsed.contrarian = { bestArgumentAgainst: '', counterArgument: '', riskLevel: 'medium' };
    }

    return parsed as LLMEnrichmentResult;
  } catch (err) {
    console.error('[LLMEnrichment] Parse error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function llmEnrichCandidate(candidate: OpportunityCandidate): Promise<OpportunityCandidate> {
  if (!isLLMAvailable()) {
    return candidate;
  }

  const prompt = buildEnrichmentPrompt(candidate);
  const response = await callClaude(ENRICHMENT_SYSTEM_PROMPT, prompt, 4000);

  if (!response) {
    console.warn('[LLMEnrichment] No response, skipping enrichment');
    return candidate;
  }

  const result = parseEnrichmentResponse(response);
  if (!result) {
    console.warn('[LLMEnrichment] Failed to parse, skipping enrichment');
    return candidate;
  }

  // Map LLM results to existing types
  const marketSize: MarketSize = {
    potentialBuyers: result.marketSize.potentialBuyers || 0,
    adoptionRate: result.marketSize.adoptionRate || 0,
    potentialCustomers: result.marketSize.potentialCustomers || 0,
    avgMonthlyPrice: result.marketSize.avgMonthlyPrice || 0,
    revenueCeiling: result.marketSize.revenueCeiling || 0,
    explanation: result.marketSize.explanation || '',
  };

  const marketStructure: MarketStructureV2 = {
    type: result.marketStructure.type as 'blue' | 'purple' | 'red',
    reason: result.marketStructure.reason || '',
    competitorCount: result.marketStructure.competitorCount || 0,
    maturityLevel: result.marketStructure.maturityLevel || 'growing',
    innovationGap: clamp(result.marketStructure.innovationGap || 5, 0, 10),
    pricingSimilarity: clamp(result.marketStructure.pricingSimilarity || 5, 0, 10),
    confidence: clamp(result.marketStructure.confidence || 50, 0, 100),
    adjacentCompetitorDensity: clamp(result.marketStructure.adjacentCompetitorDensity || 0, 0, 10),
    featureOverlapScore: clamp(result.marketStructure.featureOverlapScore || 0, 0, 10),
  };

  const eco = result.economicImpact;
  const economicImpactV2: EconomicImpactV2 = {
    conservative: {
      timeCostHoursPerMonth: Math.round(eco.timeCostHoursPerMonth * 0.5),
      laborCostPerMonth: Math.round(eco.laborCostPerMonth * 0.5),
      revenueLossPerMonth: Math.round(eco.revenueLossPerMonth * 0.5),
      totalMonthlyCost: Math.round(eco.totalMonthlyCost * 0.5),
    },
    base: {
      timeCostHoursPerMonth: eco.timeCostHoursPerMonth,
      laborCostPerMonth: eco.laborCostPerMonth,
      revenueLossPerMonth: eco.revenueLossPerMonth,
      totalMonthlyCost: eco.totalMonthlyCost,
    },
    aggressive: {
      timeCostHoursPerMonth: Math.round(eco.timeCostHoursPerMonth * 2),
      laborCostPerMonth: Math.round(eco.laborCostPerMonth * 2),
      revenueLossPerMonth: Math.round(eco.revenueLossPerMonth * 2),
      totalMonthlyCost: Math.round(eco.totalMonthlyCost * 2),
    },
    impliedROIMultiple: eco.impliedROIMultiple || 0,
    paybackPeriodMonths: eco.paybackPeriodMonths || 0,
    economicPainScore: clamp(eco.economicPainScore || 5, 0, 10),
    explanation: eco.explanation || '',
    confidence: clamp(eco.confidence || 50, 0, 100),
  };

  // Build the EconomicImpact (v1 format) for backward compatibility
  const economicImpact = {
    timeCostHoursPerMonth: eco.timeCostHoursPerMonth,
    laborCostPerMonth: [Math.round(eco.laborCostPerMonth * 0.5), Math.round(eco.laborCostPerMonth * 2)] as [number, number],
    revenueLossPerMonth: [Math.round(eco.revenueLossPerMonth * 0.5), Math.round(eco.revenueLossPerMonth * 2)] as [number, number],
    totalMonthlyCost: [Math.round(eco.totalMonthlyCost * 0.5), Math.round(eco.totalMonthlyCost * 2)] as [number, number],
    economicPainScore: economicImpactV2.economicPainScore,
    explanation: eco.explanation,
    conservative: economicImpactV2.conservative,
    base: economicImpactV2.base,
    aggressive: economicImpactV2.aggressive,
    impliedROIMultiple: economicImpactV2.impliedROIMultiple,
    paybackPeriodMonths: economicImpactV2.paybackPeriodMonths,
    confidence: economicImpactV2.confidence,
  };

  // Store comparable companies and contrarian analysis in risk flags
  const riskFlags = [...(candidate.riskFlags || [])];

  if (result.contrarian.riskLevel === 'high') {
    riskFlags.push({
      id: 'contrarian-risk',
      severity: 'high' as const,
      description: `Contrarian risk: ${result.contrarian.bestArgumentAgainst}`,
    });
  }

  for (const comp of result.comparableCompanies) {
    if (comp.outcome.toLowerCase().includes('fail') || comp.outcome.toLowerCase().includes('shut down')) {
      riskFlags.push({
        id: 'comparable-failure',
        severity: 'medium' as const,
        description: `${comp.name}: ${comp.outcome}. Lesson: ${comp.lessonForThisOpportunity}`,
      });
    }
  }

  return {
    ...candidate,
    marketSize,
    marketStructure,
    economicImpact,
    purpleOpportunities: result.wedges.slice(0, 4),
    startupConcepts: result.startupConcepts.slice(0, 3),
    validationPlan: result.validationPlan,
    riskFlags,
    // Store extra LLM analysis data
    comparableCompanies: result.comparableCompanies,
    contrarianAnalysis: result.contrarian,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
