// Unit Economics Detector
//
// Estimates whether the business model math works: CAC vs LTV, margins,
// payback period. This catches false positives where demand exists but
// the business can't be built profitably.

import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

// Estimated CAC by distribution channel type
const CAC_BY_CHANNEL: Record<string, number> = {
  'directories': 35,         // SEO + directory listings
  'communities': 50,         // community marketing, content
  'cold outreach': 120,      // email lists, SDR time
  'marketplaces': 25,        // app store presence
  'paid ads': 200,           // Google/FB ads
  'partnerships': 80,        // channel partnerships
  'word of mouth': 15,       // organic referrals
  'content marketing': 60,   // blog, SEO content
};

// Churn rates by buyer type (monthly)
const CHURN_BY_BUYER: Record<string, number> = {
  'enterprise': 0.02,        // 2% monthly = ~24% annual
  'business': 0.04,          // 4% monthly = ~48% annual
  'agency': 0.035,           // 3.5% monthly
  'founder': 0.05,           // 5% monthly
  'freelancer': 0.08,        // 8% monthly = high churn
  'consumer': 0.10,          // 10% monthly
  'default': 0.05,
};

// Average monthly price by vertical
const PRICE_BY_VERTICAL: Record<string, number> = {
  'home-services': 79,
  'healthcare': 199,
  'legal': 149,
  'real-estate': 129,
  'ecommerce': 49,
  'saas': 99,
  'finance': 179,
  'education': 39,
  'recruitment': 129,
  'general': 79,
};

export class UnitEconomicsDetector implements Detector {
  id = 'unitEconomics';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    let score = 5; // Start neutral
    const reasons: string[] = [];

    const vertical = candidate.vertical.toLowerCase();
    const buyer = candidate.targetBuyer.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    // --- Estimate monthly price ---
    let monthlyPrice = PRICE_BY_VERTICAL[vertical] ?? 79;

    // Adjust based on evidence of pricing
    const pricingEvidence = candidate.evidence.filter(e => e.signalType === 'money');
    const priceMatches = allText.match(/\$(\d+)(?:\s*\/?\s*(?:mo|month|per month))/gi);
    if (priceMatches && priceMatches.length > 0) {
      const prices = priceMatches.map(m => {
        const match = m.match(/\$(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }).filter(p => p > 0 && p < 10000);
      if (prices.length > 0) {
        monthlyPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      }
    }

    // Enterprise/business buyers pay more
    if (buyer.includes('enterprise')) monthlyPrice = Math.max(monthlyPrice, 199);
    if (buyer.includes('agency')) monthlyPrice = Math.max(monthlyPrice, 149);

    // --- Estimate CAC ---
    const distributionResult = candidate.detectorResults.find(r => r.detectorId === 'distributionAccess');
    const distributionScore = distributionResult?.score ?? 5;
    const distributionExplanation = distributionResult?.explanation?.toLowerCase() ?? '';

    // Determine primary distribution channel
    let estimatedCAC = 100; // default
    let primaryChannel = 'unknown';

    for (const [channel, cac] of Object.entries(CAC_BY_CHANNEL)) {
      if (distributionExplanation.includes(channel)) {
        if (cac < estimatedCAC || primaryChannel === 'unknown') {
          estimatedCAC = cac;
          primaryChannel = channel;
        }
      }
    }

    // High distribution score = lower CAC multiplier
    if (distributionScore >= 7) {
      estimatedCAC *= 0.7;
    } else if (distributionScore <= 3) {
      estimatedCAC *= 1.8;
    }

    // B2C or freelancers: higher CAC typically
    if (buyer.includes('consumer') || buyer.includes('freelancer')) {
      estimatedCAC *= 1.5;
    }

    // --- Estimate churn ---
    let monthlyChurn = CHURN_BY_BUYER['default'];
    for (const [buyerType, churn] of Object.entries(CHURN_BY_BUYER)) {
      if (buyer.includes(buyerType)) {
        monthlyChurn = churn;
        break;
      }
    }

    // Workflow anchor reduces churn
    const workflowScore = candidate.detectorResults.find(r => r.detectorId === 'workflowAnchor')?.score ?? 5;
    if (workflowScore >= 7) monthlyChurn *= 0.7;
    if (workflowScore <= 3) monthlyChurn *= 1.4;

    // --- Calculate LTV ---
    const avgLifetimeMonths = 1 / monthlyChurn;
    const grossMargin = 0.80; // SaaS typical
    const ltv = monthlyPrice * avgLifetimeMonths * grossMargin;

    // --- LTV:CAC Ratio ---
    const ltvCacRatio = estimatedCAC > 0 ? ltv / estimatedCAC : 0;

    // --- Payback period ---
    const monthlyProfit = (monthlyPrice * grossMargin) - (estimatedCAC / avgLifetimeMonths);
    const paybackMonths = monthlyProfit > 0 ? estimatedCAC / (monthlyPrice * grossMargin) : Infinity;

    // --- Score based on unit economics ---

    // LTV:CAC ratio scoring (most important factor)
    if (ltvCacRatio >= 5) {
      score += 3;
      reasons.push(`Strong LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}x`);
    } else if (ltvCacRatio >= 3) {
      score += 2;
      reasons.push(`Healthy LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}x`);
    } else if (ltvCacRatio >= 2) {
      score += 0;
      reasons.push(`Marginal LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}x`);
    } else if (ltvCacRatio >= 1) {
      score -= 2;
      reasons.push(`Weak LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}x — barely profitable`);
    } else {
      score -= 4;
      reasons.push(`Unsustainable LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}x — will burn cash`);
    }

    // Payback period scoring
    if (paybackMonths <= 3) {
      score += 1;
      reasons.push(`Fast payback: ${paybackMonths.toFixed(1)} months`);
    } else if (paybackMonths <= 12) {
      score += 0;
      reasons.push(`Acceptable payback: ${paybackMonths.toFixed(1)} months`);
    } else if (paybackMonths <= 24) {
      score -= 1;
      reasons.push(`Slow payback: ${paybackMonths.toFixed(1)} months`);
    } else {
      score -= 2;
      reasons.push(`Very slow payback: ${paybackMonths > 100 ? 'never' : paybackMonths.toFixed(1) + ' months'}`);
    }

    // Monthly revenue at 100 customers sanity check
    const revenueAt100 = monthlyPrice * 100;
    if (revenueAt100 >= 10000) {
      score += 1;
      reasons.push(`$${Math.round(revenueAt100).toLocaleString()}/mo at 100 customers`);
    } else {
      score -= 1;
      reasons.push(`Only $${Math.round(revenueAt100).toLocaleString()}/mo at 100 customers — need volume`);
    }

    // Evidence-based pricing signals boost confidence
    if (pricingEvidence.length >= 2) {
      score += 0.5;
      reasons.push('Pricing validated by market evidence');
    }

    score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') +
        `. Est. CAC: $${Math.round(estimatedCAC)}, LTV: $${Math.round(ltv)}, Price: $${Math.round(monthlyPrice)}/mo, Churn: ${(monthlyChurn * 100).toFixed(1)}%/mo.`,
      confidence: pricingEvidence.length >= 2 ? 60 : 35,
    };
  }
}
