import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class CompetitionWeaknessDetector implements Detector {
  id = 'competitionWeakness';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const compSignals = candidate.evidence.filter(e => e.signalType === 'competition');
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    let score = 0;
    const reasons: string[] = [];

    // Review complaint signals
    const complaintKeywords = ['clunky', 'overpriced', 'poor support', 'outdated', 'buggy', 'frustrat', 'terrible', 'awful', 'slow'];
    const complaintCount = complaintKeywords.filter(k => allText.includes(k)).length;
    if (complaintCount >= 3) {
      score += 4;
      reasons.push('Strong competitor dissatisfaction');
    } else if (complaintCount >= 1) {
      score += 2;
      reasons.push('Some competitor complaints');
    }

    // Pricing gap signals
    const pricingGapKeywords = ['raised prices', 'expensive', 'pricing gap', 'overpriced', 'too costly'];
    if (pricingGapKeywords.some(k => allText.includes(k))) {
      score += 3;
      reasons.push('Pricing gap opportunity');
    }

    // Low review scores
    const lowScoreMatch = allText.match(/(\d\.\d)\/5/);
    if (lowScoreMatch && parseFloat(lowScoreMatch[1]) < 4.0) {
      score += 2;
      reasons.push(`Competitor rating: ${lowScoreMatch[1]}/5`);
    }

    // Competitor vulnerability
    if (compSignals.length >= 2) {
      score += 1;
      reasons.push('Multiple competition signals');
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'No clear competitive weakness signals.',
    };
  }
}
