// Defensibility Detector
//
// Assesses moat strength: can this business defend against copycats?
// High score = strong defensibility through network effects, data moats,
// switching costs, brand, or regulatory barriers.
// Low score = easy to replicate, no lock-in, commoditizable.

import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

// Patterns indicating network effects
const NETWORK_EFFECT_PATTERNS = [
  'marketplace', 'platform', 'community', 'network',
  'two-sided', 'multi-sided', 'social',
  'user-generated', 'review', 'rating',
];

// Patterns indicating data moats
const DATA_MOAT_PATTERNS = [
  'proprietary data', 'training data', 'historical data',
  'benchmarks', 'analytics', 'insights from usage',
  'learn from', 'improves with',
  'dataset', 'data advantage',
];

// Patterns indicating high switching costs
const SWITCHING_COST_PATTERNS = [
  'migration', 'import', 'export', 'integration',
  'connected to', 'syncs with', 'embedded in',
  'workflow', 'training', 'onboarding',
  'api', 'webhook', 'plugin',
];

// Patterns indicating regulatory/compliance moats
const REGULATORY_PATTERNS = [
  'certified', 'compliance', 'hipaa', 'sox', 'gdpr',
  'licensed', 'accredited', 'approved',
  'audit', 'regulation',
];

// Easy-to-copy patterns (anti-moat)
const COMMODITY_PATTERNS = [
  'simple crud', 'basic dashboard', 'landing page',
  'notification', 'alert system', 'simple automation',
  'template', 'calculator', 'generator',
  'wrapper', 'api wrapper', 'chatbot',
];

export class DefensibilityDetector implements Detector {
  id = 'defensibility';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    let score = 3; // Start pessimistic — most businesses are copyable
    const moats: string[] = [];
    const risks: string[] = [];

    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    const combined = job + ' ' + allText;

    // --- Network effects ---
    const networkMatches = NETWORK_EFFECT_PATTERNS.filter(p => combined.includes(p));
    if (networkMatches.length >= 2) {
      score += 2;
      moats.push(`Network effects (${networkMatches.join(', ')})`);
    } else if (networkMatches.length === 1) {
      score += 1;
      moats.push(`Potential network effect (${networkMatches[0]})`);
    }

    // --- Data moat ---
    const dataMatches = DATA_MOAT_PATTERNS.filter(p => combined.includes(p));
    if (dataMatches.length >= 2) {
      score += 2;
      moats.push('Data moat — product improves with usage');
    } else if (dataMatches.length === 1) {
      score += 1;
      moats.push('Potential data advantage');
    }

    // --- Switching costs ---
    const switchMatches = SWITCHING_COST_PATTERNS.filter(p => combined.includes(p));
    if (switchMatches.length >= 3) {
      score += 2;
      moats.push('High switching costs (deep integrations)');
    } else if (switchMatches.length >= 1) {
      score += 1;
      moats.push('Moderate switching costs');
    }

    // Crosscheck with switching friction detector
    const switchScore = candidate.detectorResults.find(r => r.detectorId === 'switchingFriction')?.score ?? 5;
    if (switchScore >= 7) {
      score += 1;
      moats.push('Low friction to adopt = customers come easy, but also leave easy');
      risks.push('Low switching costs work both ways — easy to lose customers too');
    }

    // --- Regulatory moat ---
    const regMatches = REGULATORY_PATTERNS.filter(p => combined.includes(p));
    if (regMatches.length >= 2) {
      score += 2;
      moats.push('Regulatory barrier to entry');
    } else if (regMatches.length === 1) {
      score += 1;
      moats.push('Some regulatory complexity (barrier for copycats)');
    }

    // --- Vertical specialization (domain moat) ---
    const vertical = candidate.vertical.toLowerCase();
    const nonGenericVerticals = ['healthcare', 'legal', 'finance', 'insurance', 'real-estate'];
    if (nonGenericVerticals.includes(vertical)) {
      score += 1;
      moats.push(`Vertical specialization in ${vertical} — requires domain knowledge to replicate`);
    }

    // --- Commodity risk (anti-moat) ---
    const commodityMatches = COMMODITY_PATTERNS.filter(p => combined.includes(p));
    if (commodityMatches.length >= 2) {
      score -= 2;
      risks.push(`Commodity risk: easily replicated (${commodityMatches.join(', ')})`);
    } else if (commodityMatches.length === 1) {
      score -= 1;
      risks.push(`Some commodity risk (${commodityMatches[0]})`);
    }

    // --- Ease to build as anti-moat ---
    const easeScore = candidate.detectorResults.find(r => r.detectorId === 'easeToBuild')?.score ?? 5;
    if (easeScore >= 8) {
      score -= 1.5;
      risks.push('Very easy to build = very easy to copy');
    } else if (easeScore >= 7) {
      score -= 0.5;
      risks.push('Easy build reduces barrier for competitors');
    } else if (easeScore <= 3) {
      score += 1;
      moats.push('Technical complexity deters copycats');
    }

    // --- AI advantage as temporary moat ---
    const aiScore = candidate.detectorResults.find(r => r.detectorId === 'aiAdvantage')?.score ?? 0;
    if (aiScore >= 7 && dataMatches.length === 0) {
      score -= 1;
      risks.push('AI advantage without data moat — competitors can replicate with same LLMs');
    } else if (aiScore >= 7 && dataMatches.length >= 1) {
      score += 1;
      moats.push('AI + proprietary data = defensible advantage');
    }

    // --- Brand / community moat (from evidence) ---
    const brandSignals = ['loyal', 'community', 'brand', 'word of mouth', 'referral'];
    const brandMatches = brandSignals.filter(p => combined.includes(p));
    if (brandMatches.length >= 2) {
      score += 1;
      moats.push('Brand/community potential');
    }

    score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

    const explanation = [
      moats.length > 0 ? `Moats: ${moats.join('; ')}` : 'No clear moats identified',
      risks.length > 0 ? `Risks: ${risks.join('; ')}` : '',
    ].filter(Boolean).join('. ');

    return {
      detectorId: this.id,
      score,
      explanation: explanation + '.',
      confidence: 40, // Defensibility is hard to assess from signals alone
    };
  }
}
