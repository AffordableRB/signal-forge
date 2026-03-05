import { Detector } from './base';
import { OpportunityCandidate, DetectorResult } from '../models/types';

export class AbilityToPayDetector implements Detector {
  id = 'abilityToPay';

  analyze(candidate: OpportunityCandidate): DetectorResult {
    const moneySignals = candidate.evidence.filter(e => e.signalType === 'money');
    const allText = candidate.evidence.map(e => e.excerpt.toLowerCase()).join(' ');

    let score = 0;
    const reasons: string[] = [];

    // Check for explicit pricing/payment signals
    if (moneySignals.length >= 2) {
      score += 3;
      reasons.push('Multiple money signals found');
    } else if (moneySignals.length >= 1) {
      score += 2;
      reasons.push('Money signal found');
    }

    // Check for high-budget buyer signals
    const highBudgetKeywords = ['enterprise', 'business', 'company', 'agency', 'firm'];
    if (highBudgetKeywords.some(k => allText.includes(k) || candidate.targetBuyer.toLowerCase().includes(k))) {
      score += 3;
      reasons.push('Business buyer with budget');
    }

    // Check for existing spend signals
    const spendKeywords = ['paying', 'subscription', 'budget', '$', 'pricing', 'per month', '/mo'];
    if (spendKeywords.some(k => allText.includes(k))) {
      score += 2;
      reasons.push('Evidence of existing spend');
    }

    // Check vertical for typical budget
    const highBudgetVerticals = ['finance', 'legal', 'healthcare', 'real-estate', 'saas'];
    if (highBudgetVerticals.includes(candidate.vertical)) {
      score += 2;
      reasons.push(`High-budget vertical: ${candidate.vertical}`);
    }

    score = Math.min(10, score);

    return {
      detectorId: this.id,
      score,
      explanation: reasons.join('. ') || 'No clear payment signals.',
    };
  }
}
