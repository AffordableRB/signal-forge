import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';
import { weightedEvidenceCount, deduplicatedEvidence } from '../scoring/evidence-weight';

export class DemandDetector implements Detector {
  id = 'demand';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const demandSignals = deduplicatedEvidence(
      candidate.evidence.filter(e => e.signalType === 'demand')
    );
    const totalSignals = candidate.evidence.length;
    const uniqueSources = new Set(demandSignals.map(e => e.source)).size;
    const weighted = weightedEvidenceCount(demandSignals);

    let score = 0;

    // Weighted signal count scoring
    if (weighted >= 3.5) score += 4;
    else if (weighted >= 2.0) score += 3;
    else if (weighted >= 0.5) score += 2;

    // Source diversity bonus
    if (uniqueSources >= 3) score += 3;
    else if (uniqueSources >= 2) score += 2;
    else if (uniqueSources >= 1) score += 1;

    // Proportion bonus
    if (totalSignals > 0 && demandSignals.length / totalSignals >= 0.3) score += 2;
    else if (totalSignals > 0 && demandSignals.length / totalSignals >= 0.15) score += 1;

    // Growth language bonus
    const growthKeywords = ['growing', 'increasing', 'breakout', 'trending', 'yoy'];
    const hasGrowthSignal = demandSignals.some(e =>
      growthKeywords.some(k => e.excerpt.toLowerCase().includes(k))
    );
    if (hasGrowthSignal) score += 1;

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: `Found ${demandSignals.length} demand signals (weighted: ${weighted.toFixed(1)}) from ${uniqueSources} sources. ${hasGrowthSignal ? 'Growth trend detected.' : 'No clear growth trend.'}`,
    };
  }
}
