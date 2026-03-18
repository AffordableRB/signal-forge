// Founder Fit Detector
//
// Assesses how accessible this opportunity is for a solo founder or small team.
// High scores = can be started without deep domain expertise, existing network,
// or massive capital. Low scores = requires specific unfair advantages to win.

import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

// Verticals requiring regulatory knowledge or professional credentials
const REGULATED_VERTICALS = ['healthcare', 'finance', 'legal', 'insurance'];

// Verticals where relationships are the primary distribution channel
const RELATIONSHIP_VERTICALS = ['enterprise', 'government', 'defense'];

// Technical patterns that require specialized expertise
const SPECIALIST_PATTERNS = [
  'machine learning model', 'train.*model', 'custom ai',
  'blockchain', 'smart contract', 'hardware',
  'biotech', 'pharma', 'clinical',
  'regulatory compliance', 'sox', 'hipaa',
  'embedded system', 'firmware',
];

// Patterns suggesting solo-founder accessibility
const ACCESSIBLE_PATTERNS = [
  'saas', 'dashboard', 'notifications', 'alerts',
  'booking', 'scheduling', 'crm', 'form',
  'automation', 'workflow', 'integration',
  'report', 'analytics', 'tracking',
  'template', 'generator', 'calculator',
];

// Buyer types that are harder to sell to
const HARD_BUYERS = ['enterprise', 'government', 'hospital system', 'fortune 500'];
const EASY_BUYERS = ['freelancer', 'small business', 'solopreneur', 'creator', 'contractor', 'agency'];

export class FounderFitDetector implements Detector {
  id = 'founderFit';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    let score = 5; // Start neutral
    const reasons: string[] = [];

    const vertical = candidate.vertical.toLowerCase();
    const buyer = candidate.targetBuyer.toLowerCase();
    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    // --- Regulatory complexity ---
    if (REGULATED_VERTICALS.includes(vertical)) {
      score -= 1.5;
      reasons.push(`Regulated vertical (${vertical}) — domain expertise required`);
    }

    if (RELATIONSHIP_VERTICALS.some(v => vertical.includes(v) || buyer.includes(v))) {
      score -= 2;
      reasons.push('Relationship-driven sales — hard without existing network');
    }

    // --- Technical accessibility ---
    const specialistMatch = SPECIALIST_PATTERNS.some(p => new RegExp(p, 'i').test(job + ' ' + allText));
    if (specialistMatch) {
      score -= 1.5;
      reasons.push('Requires specialized technical expertise');
    }

    const accessibleMatch = ACCESSIBLE_PATTERNS.some(p => new RegExp(p, 'i').test(job));
    if (accessibleMatch) {
      score += 1;
      reasons.push('Standard SaaS pattern — well-understood tech stack');
    }

    // --- Ease to build crosscheck ---
    const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;
    if (easeScore >= 7) {
      score += 1;
      reasons.push('MVP buildable quickly by a generalist developer');
    } else if (easeScore <= 3) {
      score -= 1;
      reasons.push('Complex build — may need specialized team');
    }

    // --- Buyer accessibility ---
    if (HARD_BUYERS.some(b => buyer.includes(b))) {
      score -= 1.5;
      reasons.push(`${candidate.targetBuyer} requires enterprise sales motion`);
    }
    if (EASY_BUYERS.some(b => buyer.includes(b))) {
      score += 1.5;
      reasons.push(`${candidate.targetBuyer} reachable via self-serve or lightweight sales`);
    }

    // --- Sales cycle length ---
    // Enterprise + high price = long sales cycle
    const priceIndicators = candidate.evidence.filter(e => e.signalType === 'money');
    const hasHighPrice = priceIndicators.some(e => {
      const match = e.excerpt.match(/\$(\d+)/);
      return match && parseInt(match[1], 10) > 500;
    });

    if (hasHighPrice && (buyer.includes('enterprise') || buyer.includes('business'))) {
      score -= 1;
      reasons.push('High price + business buyer = longer sales cycle');
    }

    // --- Capital requirements ---
    // Marketplaces and platforms need both sides
    if (job.includes('marketplace') || job.includes('platform connecting')) {
      score -= 2;
      reasons.push('Marketplace/platform — chicken-and-egg problem requires capital');
    }

    // --- Community validation ---
    // If evidence comes from communities the founder can participate in, that's a plus
    const hasRedditEvidence = candidate.evidence.some(e => e.source.includes('reddit'));
    const hasHNEvidence = candidate.evidence.some(e => e.source.includes('hacker-news'));
    if (hasRedditEvidence || hasHNEvidence) {
      score += 0.5;
      reasons.push('Active communities exist for customer discovery');
    }

    // --- Competition landscape ---
    const compScore = candidate.detectorResults.find(r => r.detectorId === 'competitionWeakness')?.score ?? 5;
    if (compScore >= 7) {
      score += 1;
      reasons.push('Weak competition — room for a new entrant without massive resources');
    } else if (compScore <= 2) {
      score -= 1;
      reasons.push('Strong incumbents — need significant differentiation or resources to compete');
    }

    score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') + '.',
      confidence: 45, // Founder fit is inherently subjective
    };
  }
}
