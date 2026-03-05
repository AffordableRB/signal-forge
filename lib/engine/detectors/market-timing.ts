import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

type MarketPhase = 'early' | 'optimal' | 'saturated';

export class MarketTimingDetector implements Detector {
  id = 'marketTiming';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');
    let score = 0;
    let phase: MarketPhase = 'optimal';
    const reasons: string[] = [];

    // Growth signals (optimal timing)
    const growthKeywords = ['growing', 'increasing', 'emerging', 'trending', 'breakout', 'yoy'];
    if (growthKeywords.some(k => allText.includes(k))) {
      score += 4;
      phase = 'optimal';
      reasons.push('Market showing growth signals');
    }

    // Early market signals
    const earlyKeywords = ['new category', 'no good solution', 'emerging', 'early stage', 'first mover'];
    if (earlyKeywords.some(k => allText.includes(k))) {
      score += 3;
      phase = 'early';
      reasons.push('Early market with few solutions');
    }

    // Saturation signals
    const saturatedKeywords = ['crowded', 'commoditized', 'hundreds of', 'red ocean', 'mature market'];
    if (saturatedKeywords.some(k => allText.includes(k))) {
      score -= 3;
      phase = 'saturated';
      reasons.push('Market showing saturation');
    }

    // Disruption signals (re-opens timing window)
    const disruptionKeywords = ['raised prices', 'acquisition', 'shutdown', 'deprecated', 'pivot'];
    if (disruptionKeywords.some(k => allText.includes(k))) {
      score += 3;
      reasons.push('Market disruption creating opportunity window');
    }

    // Demand acceleration
    if (candidate.evidence.filter(e => e.signalType === 'demand').length >= 3) {
      score += 2;
      reasons.push('Accelerating demand');
    }

    score = Math.max(1, Math.min(10, score));

    return {
      detectorId: this.id,
      score,
      explanation: `Market phase: ${phase}. ${reasons.join('. ')}`,
    };
  }
}
