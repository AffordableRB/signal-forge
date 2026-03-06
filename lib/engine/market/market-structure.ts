import { OpportunityCandidate, MarketStructure, OceanType } from '../models/types';

export function classifyMarketStructure(candidate: OpportunityCandidate): MarketStructure {
  const compScore = candidate.detectorResults.find(r => r.detectorId === 'competitionWeakness')?.score ?? 5;
  const demandScore = candidate.detectorResults.find(r => r.detectorId === 'demand')?.score ?? 5;
  const marketTimingScore = candidate.detectorResults.find(r => r.detectorId === 'marketTiming')?.score ?? 5;
  const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;
  const aiScore = candidate.detectorResults.find(r => r.detectorId === 'aiAdvantage')?.score ?? 0;

  const compSignals = candidate.evidence.filter(e => e.signalType === 'competition');
  const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

  // Competitor count estimation from evidence
  const competitorCount = Math.max(
    candidate.competitors.length,
    compSignals.length,
    estimateCompetitorCount(allText)
  );

  // Maturity assessment
  const maturityLevel = assessMaturity(allText, marketTimingScore, competitorCount);

  // Innovation gap: how much room for innovation exists
  const innovationGap = calculateInnovationGap(candidate, allText, aiScore, easeScore);

  // Pricing similarity: how similar are all competitors' pricing
  const pricingSimilarity = assessPricingSimilarity(allText, compSignals.length);

  // Ocean classification
  const { type, reason } = classifyOcean(
    competitorCount, compScore, demandScore, innovationGap,
    maturityLevel, aiScore, allText
  );

  return {
    type,
    reason,
    competitorCount,
    maturityLevel,
    innovationGap,
    pricingSimilarity,
  };
}

function estimateCompetitorCount(text: string): number {
  let count = 0;
  if (/hundreds?\s+of/i.test(text)) count = 50;
  else if (/dozens?\s+of/i.test(text)) count = 20;
  else if (/many\s+(competitors?|alternatives?|options?)/i.test(text)) count = 15;
  else if (/several\s+(competitors?|alternatives?|options?)/i.test(text)) count = 6;
  else if (/few\s+(competitors?|alternatives?)/i.test(text)) count = 3;

  // Count named products/companies
  const namedProducts = text.match(/(?:like|such as|including|versus|vs\.?)\s+\w+/gi);
  if (namedProducts) count = Math.max(count, namedProducts.length * 2);

  return count;
}

function assessMaturity(
  text: string,
  timingScore: number,
  competitorCount: number
): MarketStructure['maturityLevel'] {
  const nascentPatterns = /no\s+(?:good\s+)?solution|doesn.t\s+exist|first\s+mover/i;
  const emergingPatterns = /emerging|new\s+category|early\s+stage|just\s+starting/i;
  const maturePatterns = /established|mature|commodit|saturated|red\s+ocean/i;
  const decliningPatterns = /dying|declining|obsolete|replaced\s+by/i;

  if (decliningPatterns.test(text)) return 'declining';
  if (maturePatterns.test(text) || competitorCount > 20) return 'mature';
  if (nascentPatterns.test(text) && competitorCount < 3) return 'nascent';
  if (emergingPatterns.test(text) || (timingScore >= 7 && competitorCount < 5)) return 'emerging';
  if (competitorCount >= 8 || timingScore < 4) return 'mature';
  return 'growing';
}

function calculateInnovationGap(
  candidate: OpportunityCandidate,
  text: string,
  aiScore: number,
  easeScore: number
): number {
  let gap = 5; // base

  // AI creates innovation gap
  if (aiScore >= 6) gap += 2;
  else if (aiScore >= 3) gap += 1;

  // Automation keywords suggest gap
  const autoPatterns = /automat|streamlin|simplif|moderniz|digitaliz/gi;
  const autoHits = (text.match(autoPatterns) || []).length;
  if (autoHits >= 3) gap += 2;
  else if (autoHits >= 1) gap += 1;

  // Complaint patterns suggest competitors aren't innovating
  const complaintPatterns = /outdated|clunky|manual|spreadsheet|paper|fax|phone\s+tag/gi;
  const complaints = (text.match(complaintPatterns) || []).length;
  if (complaints >= 2) gap += 2;

  // Easy to build suggests technical gap is exploitable
  if (easeScore >= 7) gap += 1;

  return Math.min(10, gap);
}

function assessPricingSimilarity(text: string, _compSignals: number): number {
  // Extract price patterns
  const prices = text.match(/\$\d+/g);
  if (!prices || prices.length < 2) return 5; // unknown

  const nums = prices.map(p => parseInt(p.replace('$', ''))).filter(n => n > 0 && n < 10000);
  if (nums.length < 2) return 5;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const spread = max / Math.max(1, min);

  // High spread = low similarity
  if (spread > 10) return 2;
  if (spread > 5) return 4;
  if (spread > 2) return 6;
  return 8; // very similar pricing
}

function classifyOcean(
  competitorCount: number,
  compScore: number,
  demandScore: number,
  innovationGap: number,
  maturity: MarketStructure['maturityLevel'],
  aiScore: number,
  text: string
): { type: OceanType; reason: string } {
  // Blue Ocean: very few competitors, new category
  if (competitorCount <= 2 && (maturity === 'nascent' || maturity === 'emerging')) {
    return {
      type: 'blue',
      reason: 'Uncontested market space with few or no direct competitors. First-mover opportunity.',
    };
  }

  if (demandScore >= 7 && competitorCount <= 3 && innovationGap >= 7) {
    return {
      type: 'blue',
      reason: 'Strong demand with minimal competition and significant innovation gap.',
    };
  }

  // Red Ocean: many competitors, mature, low innovation gap
  if (competitorCount > 15 && innovationGap < 4 && maturity === 'mature') {
    return {
      type: 'red',
      reason: 'Highly competitive mature market with little room for differentiation.',
    };
  }

  if (compScore < 3 && maturity === 'mature' && innovationGap < 5) {
    return {
      type: 'red',
      reason: 'Strong incumbents with established moats. Price competition dominates.',
    };
  }

  // Purple Ocean: crowded but with automation/AI/innovation gap
  const hasAutomationGap = /manual|spreadsheet|paper|outdated|clunky/i.test(text);
  const hasAIWedge = aiScore >= 4;

  if (competitorCount > 5 && (hasAutomationGap || hasAIWedge) && innovationGap >= 5) {
    return {
      type: 'purple',
      reason: `Crowded category but clear ${hasAIWedge ? 'AI/automation' : 'automation'} gap. Incumbents haven't modernized.`,
    };
  }

  if (maturity === 'growing' && innovationGap >= 6) {
    return {
      type: 'purple',
      reason: 'Growing market with an innovation gap that creates space for a differentiated entrant.',
    };
  }

  if (compScore >= 6 && innovationGap >= 5) {
    return {
      type: 'purple',
      reason: 'Competitor weaknesses create a purple ocean wedge despite active market.',
    };
  }

  // Default: purple if innovation gap is moderate, red otherwise
  if (innovationGap >= 5) {
    return {
      type: 'purple',
      reason: 'Active market with enough innovation gap for a differentiated approach.',
    };
  }

  return {
    type: 'red',
    reason: 'Competitive market with limited differentiation opportunity. Validate wedge carefully.',
  };
}
