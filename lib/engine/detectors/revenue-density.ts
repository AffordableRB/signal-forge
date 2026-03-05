import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class RevenueDensityDetector implements Detector {
  id = 'revenueDensity';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    let score = 0;
    const reasons: string[] = [];

    // Extract pricing signals
    const priceMatches = allText.match(/\$(\d+)/g);
    if (priceMatches) {
      const prices = priceMatches.map(p => parseInt(p.replace('$', '')));
      const maxPrice = Math.max(...prices);
      if (maxPrice >= 200) {
        score += 4;
        reasons.push(`High price signals: up to $${maxPrice}/mo`);
      } else if (maxPrice >= 50) {
        score += 3;
        reasons.push(`Mid-range pricing: up to $${maxPrice}/mo`);
      } else {
        score += 1;
        reasons.push(`Low price point: $${maxPrice}/mo`);
      }
    }

    // High-value verticals
    const highRevVerticals = ['finance', 'legal', 'healthcare', 'real-estate', 'saas'];
    if (highRevVerticals.includes(candidate.vertical)) {
      score += 3;
      reasons.push(`High-revenue vertical: ${candidate.vertical}`);
    }

    // Business buyer premium
    const buyer = candidate.targetBuyer.toLowerCase();
    if (buyer.includes('enterprise')) {
      score += 3;
      reasons.push('Enterprise buyer = high ARPU');
    } else if (buyer.includes('business') || buyer.includes('agency')) {
      score += 2;
      reasons.push('Business buyer = moderate ARPU');
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'Insufficient revenue density signals.',
    };
  }
}
