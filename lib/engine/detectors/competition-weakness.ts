import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class CompetitionWeaknessDetector implements Detector {
  id = 'competitionWeakness';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const compSignals = candidate.evidence.filter(e => e.signalType === 'competition');
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    let score = 0;
    const reasons: string[] = [];

    // 1. Review complaint signals (expanded keywords)
    const complaintKeywords = [
      'clunky', 'overpriced', 'poor support', 'outdated', 'buggy',
      'frustrat', 'terrible', 'awful', 'slow', 'unreliable',
      'confusing', 'complicated', 'difficult', 'annoying', 'broken',
      'lacking', 'limited', 'basic', 'mediocre', 'disappointing',
      'cumbersome', 'unintuitive', 'ugly', 'dated', 'legacy',
      'bloated', 'overkill', 'bad ux', 'bad ui', 'no support',
    ];
    const complaintCount = complaintKeywords.filter(k => allText.includes(k)).length;
    if (complaintCount >= 4) {
      score += 4;
      reasons.push('Strong competitor dissatisfaction');
    } else if (complaintCount >= 2) {
      score += 3;
      reasons.push('Moderate competitor complaints');
    } else if (complaintCount >= 1) {
      score += 2;
      reasons.push('Some competitor complaints');
    }

    // 2. Pricing gap signals
    const pricingGapKeywords = [
      'raised prices', 'expensive', 'pricing gap', 'overpriced',
      'too costly', 'too expensive', 'cost too much', 'high price',
      'pricing issue', 'not affordable', 'budget',
    ];
    if (pricingGapKeywords.some(k => allText.includes(k))) {
      score += 2;
      reasons.push('Pricing gap opportunity');
    }

    // 3. Low review scores
    const lowScoreMatch = allText.match(/(\d\.\d)\/5/);
    if (lowScoreMatch && parseFloat(lowScoreMatch[1]) < 4.0) {
      score += 2;
      reasons.push(`Competitor rating: ${lowScoreMatch[1]}/5`);
    }

    // 4. Competitor weakness data from structured competitor objects
    if (candidate.competitors.length > 0) {
      const allWeaknesses = candidate.competitors
        .flatMap(c => c.weaknesses)
        .map(w => w.toLowerCase());
      const weaknessCount = allWeaknesses.length;

      if (weaknessCount >= 4) {
        score += 3;
        reasons.push(`${weaknessCount} known competitor weaknesses`);
      } else if (weaknessCount >= 2) {
        score += 2;
        reasons.push(`${weaknessCount} known competitor weaknesses`);
      } else if (weaknessCount >= 1) {
        score += 1;
        reasons.push('Some known competitor weaknesses');
      }

      // Low review scores from competitor data
      const lowReviews = candidate.competitors.filter(
        c => c.reviewScore != null && c.reviewScore < 4.0,
      );
      if (lowReviews.length > 0) {
        score += 1;
        reasons.push('Competitors with low review scores');
      }
    }

    // 5. Competition signal volume
    if (compSignals.length >= 3) {
      score += 2;
      reasons.push('Strong competition signal volume');
    } else if (compSignals.length >= 1) {
      score += 1;
      reasons.push('Competition signals present');
    }

    // 6. Feature gap / missing capability patterns
    const gapPatterns = [
      'no ai', 'no automation', 'no integration', 'no api',
      'manual process', 'manual work', 'doesn\'t support',
      'can\'t handle', 'not supported', 'missing feature',
      'no mobile', 'lacks',
    ];
    const gapCount = gapPatterns.filter(k => allText.includes(k)).length;
    if (gapCount >= 2) {
      score += 2;
      reasons.push('Multiple feature gaps in competitors');
    } else if (gapCount >= 1) {
      score += 1;
      reasons.push('Feature gap detected');
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'No clear competitive weakness signals.',
    };
  }
}
