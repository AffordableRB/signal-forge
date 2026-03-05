import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class SwitchingFrictionDetector implements Detector {
  id = 'switchingFriction';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const job = candidate.jobToBeDone.toLowerCase();
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    let score = 5; // Moderate by default (higher = easier adoption)
    const reasons: string[] = [];

    // Low friction indicators (easy to adopt)
    const lowFrictionKeywords = ['no setup', 'plug and play', 'instant', 'simple', 'easy switch', 'free trial', 'no commitment'];
    if (lowFrictionKeywords.some(k => allText.includes(k) || job.includes(k))) {
      score += 2;
      reasons.push('Low adoption friction signals');
    }

    // High friction indicators (hard to adopt)
    const highFrictionKeywords = ['migration', 'data transfer', 'training required', 'implementation', 'onboarding', 'complex setup'];
    if (highFrictionKeywords.some(k => allText.includes(k) || job.includes(k))) {
      score -= 2;
      reasons.push('High switching cost signals');
    }

    // New market (no switching needed)
    const newMarketKeywords = ['no existing', 'manual process', 'spreadsheet', 'pen and paper', 'workaround'];
    if (newMarketKeywords.some(k => allText.includes(k))) {
      score += 3;
      reasons.push('Replacing manual process = no switching cost');
    }

    // Integration-heavy = harder switching
    const integrationKeywords = ['integrate', 'connect', 'sync with', 'api', 'compatibility'];
    const integrationCount = integrationKeywords.filter(k => job.includes(k) || allText.includes(k)).length;
    if (integrationCount >= 2) {
      score -= 1;
      reasons.push('Integration dependencies add friction');
    }

    score = Math.max(1, Math.min(10, score));

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'Moderate adoption friction expected.',
    };
  }
}
