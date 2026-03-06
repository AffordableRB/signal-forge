import { OpportunityCandidate, MarketStructure, OceanType } from '../models/types';

export interface MarketStructureV2 extends MarketStructure {
  confidence: number; // 0-100
  adjacentCompetitorDensity: number; // 0-10, how many adjacent/indirect competitors
  featureOverlapScore: number; // 0-10, how similar are features across competitors
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function classifyMarketStructureV2(candidate: OpportunityCandidate): MarketStructureV2 {
  const compScore = candidate.detectorResults.find(r => r.detectorId === 'competitionWeakness')?.score ?? 5;
  const demandScore = candidate.detectorResults.find(r => r.detectorId === 'demand')?.score ?? 5;
  const marketTimingScore = candidate.detectorResults.find(r => r.detectorId === 'marketTiming')?.score ?? 5;
  const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;
  const aiScore = candidate.detectorResults.find(r => r.detectorId === 'aiAdvantage')?.score ?? 0;

  const compSignals = candidate.evidence.filter(e => e.signalType === 'competition');
  const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

  // Core metrics (same helpers as v1)
  const competitorCount = Math.max(
    candidate.competitors.length,
    compSignals.length,
    estimateCompetitorCount(allText),
  );

  const maturityLevel = assessMaturity(allText, marketTimingScore, competitorCount);
  const innovationGap = calculateInnovationGap(candidate, allText, aiScore, easeScore);
  const pricingSimilarity = assessPricingSimilarity(allText, compSignals.length);

  // New v2 metrics
  const adjacentCompetitorDensity = assessAdjacentCompetitorDensity(allText, candidate);
  const featureOverlapScore = assessFeatureOverlap(allText, candidate);

  // Tighter ocean classification
  const { type, reason, confidence: classificationConfidence } = classifyOceanV2({
    competitorCount,
    compScore,
    demandScore,
    innovationGap,
    maturityLevel,
    aiScore,
    pricingSimilarity,
    adjacentCompetitorDensity,
    featureOverlapScore,
    allText,
    candidate,
  });

  // Final confidence incorporates evidence quality
  const evidenceConfidence = assessEvidenceConfidence(candidate);
  const confidence = Math.round(
    classificationConfidence * 0.6 + evidenceConfidence * 0.4,
  );

  return {
    type,
    reason,
    competitorCount,
    maturityLevel,
    innovationGap,
    pricingSimilarity,
    confidence: clamp(confidence, 0, 100),
    adjacentCompetitorDensity,
    featureOverlapScore,
  };
}

// ---------------------------------------------------------------------------
// Adjacent Competitor Density (new)
// ---------------------------------------------------------------------------

export function assessAdjacentCompetitorDensity(
  text: string,
  candidate: OpportunityCandidate,
): number {
  let density = 0;

  // Relational phrases that hint at adjacent / indirect competitors
  const adjacentPatterns = [
    /similar\s+to/gi,
    /alternative\s+to/gi,
    /like\s+[A-Z][a-z]+/g,      // "like Notion", "like Trello"
    /versus\b/gi,
    /\bvs\.?\s/gi,
    /compared\s+to/gi,
  ];

  for (const pat of adjacentPatterns) {
    const hits = text.match(pat);
    if (hits) density += hits.length;
  }

  // Count distinctly-named products / companies (capitalised words after cue phrases)
  const namedEntities = text.match(
    /(?:like|versus|vs\.?|compared\s+to|alternative\s+to|similar\s+to|such\s+as|including)\s+([A-Z][A-Za-z]+)/gi,
  );
  const uniqueNames = new Set(
    (namedEntities ?? []).map(m => {
      const parts = m.split(/\s+/);
      return parts[parts.length - 1].toLowerCase();
    }),
  );
  density += uniqueNames.size;

  // Cross-category tools that solve adjacent problems
  const crossCategoryPatterns =
    /(?:can\s+also|doubles\s+as|works\s+as|functions\s+as|replaces)\s/gi;
  const crossHits = text.match(crossCategoryPatterns);
  if (crossHits) density += crossHits.length;

  // Factor in known competitors from the candidate itself
  const adjacentFromCompetitors = candidate.competitors.filter(c =>
    c.weaknesses.some(w =>
      /adjacent|indirect|partial|tangential/i.test(w),
    ),
  );
  density += adjacentFromCompetitors.length;

  return clamp(Math.round(density), 0, 10);
}

// ---------------------------------------------------------------------------
// Feature Overlap (new)
// ---------------------------------------------------------------------------

export function assessFeatureOverlap(
  text: string,
  candidate: OpportunityCandidate,
): number {
  // Common feature keywords that indicate overlapping functionality
  const featureKeywords = [
    'dashboard',
    'analytics',
    'reporting',
    'integrations',
    'api',
    'automation',
    'notifications',
    'alerts',
    'workflow',
    'collaboration',
    'scheduling',
    'billing',
    'invoicing',
    'crm',
    'templates',
    'export',
    'import',
    'real-time',
    'mobile app',
    'sso',
    'role-based',
    'permissions',
  ];

  // Count how many common feature words appear in evidence text
  let featureHits = 0;
  for (const kw of featureKeywords) {
    if (text.includes(kw)) featureHits++;
  }

  // Phrases that signal competitors share features
  const overlapPhrases = [
    /also\s+does/gi,
    /also\s+offers/gi,
    /includes\s/gi,
    /comes\s+with/gi,
    /\bfeatures?\b/gi,
    /all\s+(?:of\s+them|competitors?)\s+(?:have|offer|provide)/gi,
    /table\s+stakes/gi,
    /must[\s-]have/gi,
    /standard\s+(?:feature|functionality)/gi,
  ];

  let phraseHits = 0;
  for (const pat of overlapPhrases) {
    const matches = text.match(pat);
    if (matches) phraseHits += matches.length;
  }

  // How many competitors offer the same core functionality
  const competitorFeatureSets = candidate.competitors.map(c =>
    c.weaknesses.join(' ').toLowerCase(),
  );
  // If competitor weakness descriptions are very similar to each other, overlap is high
  let pairwiseSimilarity = 0;
  for (let i = 0; i < competitorFeatureSets.length; i++) {
    for (let j = i + 1; j < competitorFeatureSets.length; j++) {
      const wordsA = new Set(competitorFeatureSets[i].split(/\s+/));
      const wordsB = new Set(competitorFeatureSets[j].split(/\s+/));
      let overlap = 0;
      const arrA = Array.from(wordsA);
      for (const w of arrA) {
        if (wordsB.has(w) && w.length > 3) overlap++;
      }
      const unionSize = new Set(arrA.concat(Array.from(wordsB))).size;
      if (unionSize > 0) {
        pairwiseSimilarity += overlap / unionSize;
      }
    }
  }

  // Normalise all signals into 0-10
  const featureScore =
    Math.min(featureHits / featureKeywords.length, 1) * 3 +    // up to 3
    Math.min(phraseHits / 6, 1) * 3 +                          // up to 3
    Math.min(pairwiseSimilarity, 1) * 4;                        // up to 4

  return clamp(Math.round(featureScore), 0, 10);
}

// ---------------------------------------------------------------------------
// Evidence Confidence scoring (new)
// ---------------------------------------------------------------------------

function assessEvidenceConfidence(candidate: OpportunityCandidate): number {
  let confidence = 50; // baseline

  const evidenceCount = candidate.evidence.length;

  // More evidence raises confidence
  if (evidenceCount >= 15) confidence += 20;
  else if (evidenceCount >= 8) confidence += 12;
  else if (evidenceCount >= 4) confidence += 5;
  else confidence -= 15; // very sparse evidence

  // Multiple unique sources raise confidence
  const uniqueSources = new Set(candidate.evidence.map(e => e.source));
  if (uniqueSources.size >= 5) confidence += 15;
  else if (uniqueSources.size >= 3) confidence += 8;
  else if (uniqueSources.size <= 1) confidence -= 20; // single source is unreliable

  // Evidence tier quality (tier 1 is best)
  const tier1Count = candidate.evidence.filter(e => e.sourceTier === 1).length;
  const tier3Count = candidate.evidence.filter(e => e.sourceTier === 3).length;
  if (tier1Count >= 3) confidence += 10;
  if (tier3Count > evidenceCount * 0.6) confidence -= 10;

  // Contradictory signals reduce confidence
  const blueIndicators = countBlueIndicators(candidate);
  const redIndicators = countRedIndicators(candidate);
  if (blueIndicators > 0 && redIndicators > 0) {
    // Contradictory — penalise proportional to the weaker side
    const contradictionPenalty = Math.min(blueIndicators, redIndicators) * 8;
    confidence -= contradictionPenalty;
  }

  return clamp(confidence, 0, 100);
}

function countBlueIndicators(candidate: OpportunityCandidate): number {
  let count = 0;
  const text = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
  if (/no\s+(?:direct\s+)?competitors?/i.test(text)) count++;
  if (/first\s+mover/i.test(text)) count++;
  if (/uncontested/i.test(text)) count++;
  if (/blue\s+ocean/i.test(text)) count++;
  if (/no\s+(?:good\s+)?solution/i.test(text)) count++;
  if (candidate.competitors.length <= 1) count++;
  return count;
}

function countRedIndicators(candidate: OpportunityCandidate): number {
  let count = 0;
  const text = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
  if (/saturated|crowded|red\s+ocean/i.test(text)) count++;
  if (/commodit/i.test(text)) count++;
  if (/many\s+competitors?/i.test(text)) count++;
  if (/price\s+war/i.test(text)) count++;
  if (candidate.competitors.length > 10) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Tighter Ocean classification (v2)
// ---------------------------------------------------------------------------

interface ClassifyInput {
  competitorCount: number;
  compScore: number;
  demandScore: number;
  innovationGap: number;
  maturityLevel: MarketStructure['maturityLevel'];
  aiScore: number;
  pricingSimilarity: number;
  adjacentCompetitorDensity: number;
  featureOverlapScore: number;
  allText: string;
  candidate: OpportunityCandidate;
}

function classifyOceanV2(input: ClassifyInput): {
  type: OceanType;
  reason: string;
  confidence: number;
} {
  const {
    competitorCount,
    demandScore,
    innovationGap,
    maturityLevel,
    aiScore,
    pricingSimilarity,
    adjacentCompetitorDensity,
    featureOverlapScore,
    allText,
    candidate,
  } = input;

  // ----- RED OCEAN (check first — strictest bad-signal rules) -----

  // Rule R1: High competitor count AND high feature overlap
  if (competitorCount > 10 && featureOverlapScore >= 6) {
    return {
      type: 'red',
      reason:
        'Over 10 direct competitors with high feature overlap (commodity territory). Differentiation will be extremely difficult.',
      confidence: 75,
    };
  }

  // Rule R2: Mature market with low innovation gap
  if (maturityLevel === 'mature' && innovationGap < 4) {
    return {
      type: 'red',
      reason:
        'Mature market with minimal innovation gap. Incumbents cover the space and switching costs are high.',
      confidence: 70,
    };
  }

  // Rule R3: Commodity pricing
  if (pricingSimilarity > 7) {
    // Commodity pricing alone pushes toward red, unless a strong wedge exists
    if (innovationGap < 5 && aiScore < 5) {
      return {
        type: 'red',
        reason:
          'Commodity-level pricing similarity across competitors with no clear innovation or AI wedge.',
        confidence: 65,
      };
    }
  }

  // ----- BLUE OCEAN (stricter than v1) -----

  const isNascentOrEmerging =
    maturityLevel === 'nascent' || maturityLevel === 'emerging';

  // Rule B1: Very few direct AND adjacent competitors, early market, high innovation gap
  if (
    competitorCount <= 2 &&
    adjacentCompetitorDensity <= 3 &&
    isNascentOrEmerging &&
    innovationGap >= 6
  ) {
    // Confidence depends on source corroboration
    const blueIndicators = countBlueIndicators(candidate);
    const uniqueSources = new Set(candidate.evidence.map(e => e.source)).size;
    const multipleSourcesConfirm = blueIndicators >= 2 && uniqueSources >= 3;

    return {
      type: 'blue',
      reason:
        'Uncontested market space: very few direct or adjacent competitors, ' +
        'nascent/emerging maturity, and strong innovation gap (>= 6).',
      confidence: multipleSourcesConfirm ? 80 : 55,
    };
  }

  // Rule B2: Strong demand, near-zero competition, confirmed by multiple sources
  if (
    demandScore >= 7 &&
    competitorCount <= 2 &&
    adjacentCompetitorDensity <= 3 &&
    innovationGap >= 6
  ) {
    const uniqueSources = new Set(candidate.evidence.map(e => e.source)).size;
    return {
      type: 'blue',
      reason:
        'Strong validated demand with near-zero competition and a wide innovation gap.',
      confidence: uniqueSources >= 3 ? 75 : 50,
    };
  }

  // ----- PURPLE OCEAN -----

  // Rule P1: Category exists with clear AI / innovation wedge
  if (
    competitorCount > 2 &&
    (innovationGap >= 5 || aiScore >= 5)
  ) {
    // Feature overlap penalises confidence
    const baseConfidence = 70;
    const overlapPenalty = featureOverlapScore > 5 ? (featureOverlapScore - 5) * 6 : 0;

    // Check for specific competitor weaknesses (review complaints, pricing gaps, outdated tech)
    const weaknessSignals = detectCompetitorWeaknesses(allText, candidate);

    return {
      type: 'purple',
      reason:
        `Category exists (${competitorCount} competitors) but a clear wedge is present: ` +
        `innovation gap ${innovationGap}/10` +
        (aiScore >= 5 ? `, AI advantage ${aiScore}/10` : '') +
        (weaknessSignals.length > 0
          ? `. Competitor weaknesses: ${weaknessSignals.join(', ')}`
          : '') +
        (featureOverlapScore > 5
          ? `. Warning: high feature overlap (${featureOverlapScore}/10) makes differentiation harder.`
          : '.'),
      confidence: clamp(baseConfidence - overlapPenalty, 30, 85),
    };
  }

  // Rule P2: Competitors exist but have specific, exploitable weaknesses
  if (competitorCount > 2) {
    const weaknessSignals = detectCompetitorWeaknesses(allText, candidate);
    if (weaknessSignals.length >= 2) {
      const overlapPenalty = featureOverlapScore > 5 ? (featureOverlapScore - 5) * 5 : 0;
      return {
        type: 'purple',
        reason:
          `Competitors present but exploitable weaknesses found: ${weaknessSignals.join(', ')}. ` +
          'A focused entrant can capture underserved segments.',
        confidence: clamp(60 - overlapPenalty, 25, 75),
      };
    }
  }

  // ----- FALLBACK -----

  // If innovation gap is decent, lean purple with low confidence
  if (innovationGap >= 5) {
    return {
      type: 'purple',
      reason:
        'Moderate innovation gap in an active market. Purple classification is tentative — validate the wedge.',
      confidence: 40,
    };
  }

  // Otherwise red
  return {
    type: 'red',
    reason:
      'Competitive market with limited differentiation opportunity. No strong innovation, AI, or weakness-based wedge detected.',
    confidence: 55,
  };
}

// ---------------------------------------------------------------------------
// Competitor weakness detection (new helper)
// ---------------------------------------------------------------------------

function detectCompetitorWeaknesses(
  text: string,
  candidate: OpportunityCandidate,
): string[] {
  const signals: string[] = [];

  // Review complaints
  if (/bad\s+reviews?|poor\s+reviews?|1[\s-]star|low\s+rating/i.test(text)) {
    signals.push('poor reviews');
  }
  if (/complaint|frustrated|hate|terrible\s+ux|awful/i.test(text)) {
    signals.push('user frustration');
  }

  // Pricing gaps
  if (/overpriced|too\s+expensive|pricing\s+(?:issue|problem|complaint)/i.test(text)) {
    signals.push('pricing dissatisfaction');
  }
  if (/no\s+free\s+(?:tier|plan)|expensive\s+for\s+small/i.test(text)) {
    signals.push('lack of affordable tier');
  }

  // Outdated tech
  if (/outdated|legacy|old[\s-]school|hasn.t\s+(?:been\s+)?updated/i.test(text)) {
    signals.push('outdated technology');
  }
  if (/clunky|slow|buggy|unreliable|downtime/i.test(text)) {
    signals.push('poor product quality');
  }

  // Missing features from competitor weakness lists
  const allWeaknesses = candidate.competitors.flatMap(c => c.weaknesses);
  if (allWeaknesses.some(w => /no\s+api|no\s+integration|limited\s+api/i.test(w))) {
    signals.push('limited integrations');
  }
  if (allWeaknesses.some(w => /no\s+mobile|mobile/i.test(w))) {
    signals.push('weak mobile experience');
  }

  // De-duplicate
  return Array.from(new Set(signals));
}

// ---------------------------------------------------------------------------
// Copied helper functions from v1 (unchanged logic)
// ---------------------------------------------------------------------------

function estimateCompetitorCount(text: string): number {
  let count = 0;
  if (/hundreds?\s+of/i.test(text)) count = 50;
  else if (/dozens?\s+of/i.test(text)) count = 20;
  else if (/many\s+(competitors?|alternatives?|options?)/i.test(text)) count = 15;
  else if (/several\s+(competitors?|alternatives?|options?)/i.test(text)) count = 6;
  else if (/few\s+(competitors?|alternatives?)/i.test(text)) count = 3;

  const namedProducts = text.match(/(?:like|such as|including|versus|vs\.?)\s+\w+/gi);
  if (namedProducts) count = Math.max(count, namedProducts.length * 2);

  return count;
}

function assessMaturity(
  text: string,
  timingScore: number,
  competitorCount: number,
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
  easeScore: number,
): number {
  let gap = 5;

  if (aiScore >= 6) gap += 2;
  else if (aiScore >= 3) gap += 1;

  const autoPatterns = /automat|streamlin|simplif|moderniz|digitaliz/gi;
  const autoHits = (text.match(autoPatterns) || []).length;
  if (autoHits >= 3) gap += 2;
  else if (autoHits >= 1) gap += 1;

  const complaintPatterns = /outdated|clunky|manual|spreadsheet|paper|fax|phone\s+tag/gi;
  const complaints = (text.match(complaintPatterns) || []).length;
  if (complaints >= 2) gap += 2;

  if (easeScore >= 7) gap += 1;

  return Math.min(10, gap);
}

function assessPricingSimilarity(text: string, _compSignals: number): number {
  const prices = text.match(/\$\d+/g);
  if (!prices || prices.length < 2) return 5;

  const nums = prices
    .map(p => parseInt(p.replace('$', '')))
    .filter(n => n > 0 && n < 10000);
  if (nums.length < 2) return 5;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const spread = max / Math.max(1, min);

  if (spread > 10) return 2;
  if (spread > 5) return 4;
  if (spread > 2) return 6;
  return 8;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
