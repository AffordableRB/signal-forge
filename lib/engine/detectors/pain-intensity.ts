import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

type PainLevel = 'revenue-loss' | 'time-waste' | 'inconvenience';

export class PainIntensityDetector implements Detector {
  id = 'painIntensity';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const painSignals = candidate.evidence.filter(e => e.signalType === 'pain');
    const classified = painSignals.map(e => this.classifyPain(e.excerpt));

    const hasRevenueLoss = classified.includes('revenue-loss');
    const hasTimeWaste = classified.includes('time-waste');
    const hasInconvenience = classified.includes('inconvenience');

    let score = 0;

    if (hasRevenueLoss) score += 5;
    if (hasTimeWaste) score += 3;
    if (hasInconvenience) score += 1;

    // Frequency bonus
    if (painSignals.length >= 4) score += 2;
    else if (painSignals.length >= 2) score += 1;

    score = Math.min(10, score);

    const levels = Array.from(new Set(classified));
    return {
      detectorId: this.id,
      score,
      explanation: `Pain levels detected: ${levels.join(', ') || 'none'}. ${painSignals.length} pain signals found.`,
    };
  }

  private classifyPain(excerpt: string): PainLevel {
    const text = excerpt.toLowerCase();

    const revenueLossKeywords = ['revenue', 'lost', 'losing money', 'cost', 'expensive', 'miss', 'missed call', 'missed lead', 'churn'];
    const timeWasteKeywords = ['hours', 'manual', 'tedious', 'time', 'slow', 'waste', 'workaround', 'repetitive'];

    if (revenueLossKeywords.some(k => text.includes(k))) return 'revenue-loss';
    if (timeWasteKeywords.some(k => text.includes(k))) return 'time-waste';
    return 'inconvenience';
  }
}
